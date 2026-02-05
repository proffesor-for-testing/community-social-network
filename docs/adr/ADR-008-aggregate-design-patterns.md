# ADR-008: Aggregate Design Patterns

**Status**: Accepted
**Date**: 2025-12-16
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-006 (DDD Architecture), ADR-007 (Bounded Contexts)

## Context

With bounded contexts defined (ADR-007), we need to establish aggregate design patterns for each context. Aggregates are the primary building blocks for enforcing domain invariants and defining transactional boundaries.

Key considerations from the architecture specifications:

1. **Performance targets**: p50 < 100ms, p95 < 500ms, p99 < 1000ms
2. **Scale**: 10,000+ users, 300,000+ posts, 1,000 concurrent users
3. **Caching**: 3-tier caching strategy (Memory → Redis → PostgreSQL)
4. **Concurrency**: Optimistic locking for conflict resolution

## Decision

We define aggregates for each bounded context following these principles:

1. **Small Aggregates**: Prefer smaller aggregates to reduce lock contention
2. **Reference by ID**: Aggregates reference other aggregates by ID, not direct references
3. **Single Transaction**: One aggregate per transaction
4. **Eventual Consistency**: Cross-aggregate consistency via domain events

### Aggregate Catalog

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Aggregate Catalog                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  IDENTITY CONTEXT                                                            │
│  ┌──────────────────┐                                                        │
│  │   Member (AR)    │  AR = Aggregate Root                                   │
│  │   ├─ Credential  │  Entity inside aggregate                              │
│  │   └─ Session*    │  * = Separate aggregate (referenced by ID)            │
│  └──────────────────┘                                                        │
│                                                                              │
│  PROFILE CONTEXT                                                             │
│  ┌──────────────────┐   ┌──────────────────┐                                │
│  │   Profile (AR)   │   │   MediaAsset (AR)│                                │
│  │   ├─ Avatar (VO) │   │   ├─ Variant     │                                │
│  │   └─ Settings    │   │   └─ Metadata    │                                │
│  └──────────────────┘   └──────────────────┘                                │
│                                                                              │
│  CONTENT CONTEXT                                                             │
│  ┌──────────────────┐   ┌──────────────────┐                                │
│  │ Publication (AR) │   │  Discussion (AR) │                                │
│  │   ├─ Content     │   │   ├─ Thread      │                                │
│  │   ├─ Media*      │   │   ├─ Mention     │                                │
│  │   └─ Reaction*   │   │   └─ Reaction*   │                                │
│  └──────────────────┘   └──────────────────┘                                │
│                                                                              │
│  SOCIAL GRAPH CONTEXT                                                        │
│  ┌──────────────────┐   ┌──────────────────┐                                │
│  │ Connection (AR)  │   │    Block (AR)    │                                │
│  │   └─ Status      │   │                  │                                │
│  └──────────────────┘   └──────────────────┘                                │
│                                                                              │
│  COMMUNITY CONTEXT                                                           │
│  ┌──────────────────┐   ┌──────────────────┐                                │
│  │   Group (AR)     │   │ Membership (AR)  │                                │
│  │   ├─ Settings    │   │   ├─ Role        │                                │
│  │   └─ Rules       │   │   └─ Permissions │                                │
│  └──────────────────┘   └──────────────────┘                                │
│                                                                              │
│  NOTIFICATION CONTEXT                                                        │
│  ┌──────────────────┐   ┌──────────────────┐                                │
│  │   Alert (AR)     │   │ Preference (AR)  │                                │
│  │   └─ Delivery    │   │   └─ Channel     │                                │
│  └──────────────────┘   └──────────────────┘                                │
│                                                                              │
│  ADMIN CONTEXT                                                               │
│  ┌──────────────────┐   ┌──────────────────┐                                │
│  │Administrator(AR) │   │ AuditEntry (AR)  │                                │
│  │   ├─ TwoFactor   │   │                  │                                │
│  │   └─ IPWhitelist │   │                  │                                │
│  └──────────────────┘   └──────────────────┘                                │
│                                                                              │
│  Legend: AR = Aggregate Root, VO = Value Object, * = Reference by ID        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Detailed Aggregate Designs

#### 1. Identity Context

##### Member Aggregate

```typescript
// src/domain/identity/aggregates/Member.ts

export class Member {
  private readonly _id: MemberId;
  private _email: Email;
  private _credential: Credential;
  private _status: MemberStatus;
  private _failedLoginCount: number;
  private _lockedUntil: Timestamp | null;
  private _domainEvents: DomainEvent[] = [];

  private constructor(/* ... */) {}

  // Factory method
  static register(
    id: MemberId,
    email: Email,
    password: PlainPassword
  ): Member {
    const member = new Member(
      id,
      email,
      Credential.create(password),
      MemberStatus.Active,
      0,
      null
    );
    member.addDomainEvent(new MemberRegisteredEvent(id, email));
    return member;
  }

  // Invariant enforcement
  authenticate(password: PlainPassword): boolean {
    if (this._status !== MemberStatus.Active) {
      throw new MemberNotActiveError(this._id);
    }
    if (this.isLocked()) {
      throw new MemberLockedError(this._id, this._lockedUntil);
    }

    const valid = this._credential.verify(password);

    if (!valid) {
      this._failedLoginCount++;
      if (this._failedLoginCount >= 5) {
        this._lockedUntil = Timestamp.now().addMinutes(15);
        this.addDomainEvent(new MemberLockedEvent(this._id));
      }
      return false;
    }

    this._failedLoginCount = 0;
    // MemberAuthenticatedEvent is raised at application layer
    // where HTTP context (ipAddress, userAgent) is available
    this.addDomainEvent(new MemberAuthenticationSucceededEvent(this._id));
    return true;
  }

  // State transitions
  suspend(reason: string): void {
    if (this._status === MemberStatus.Suspended) {
      throw new AlreadySuspendedError(this._id);
    }
    this._status = MemberStatus.Suspended;
    this.addDomainEvent(new MemberSuspendedEvent(this._id, reason));
  }

  private isLocked(): boolean {
    return this._lockedUntil !== null &&
           this._lockedUntil.isAfter(Timestamp.now());
  }
}
```

> **Note**: `MemberAuthenticationSucceededEvent` is a domain-level event containing only the `memberId`. The application layer handler enriches this into a `MemberAuthenticatedEvent` (ADR-009) that includes `ipAddress` and `userAgent` from the HTTP context.

**Invariants**:
- Email must be unique (enforced at repository level)
- Password must meet complexity requirements: minimum 12 characters, at least one uppercase letter, one lowercase letter, one digit, and one special character (`!@#$%^&*()_+-=[]{}|;:,.<>?`). Maximum 128 characters.
- Failed login count triggers 15-minute lockout at 5 attempts
- Suspended members cannot authenticate

---

#### 2. Profile Context

##### Profile Aggregate

```typescript
// src/domain/profile/aggregates/Profile.ts

export class Profile {
  private readonly _id: ProfileId;
  private readonly _memberId: MemberId;  // Reference by ID
  private _displayName: DisplayName;
  private _bio: Bio;
  private _avatar: AvatarId | null;  // Reference to MediaAsset by ID
  private _location: Location | null;
  private _privacySettings: PrivacySettings;
  private _domainEvents: DomainEvent[] = [];

  // Factory
  static create(id: ProfileId, memberId: MemberId): Profile {
    const profile = new Profile(
      id,
      memberId,
      DisplayName.empty(),
      Bio.empty(),
      null,
      null,
      PrivacySettings.default()
    );
    profile.addDomainEvent(new ProfileCreatedEvent(id, memberId));
    return profile;
  }

  // Behavior
  updateDisplayName(name: DisplayName): void {
    if (name.containsProfanity()) {
      throw new ProfanityNotAllowedError();
    }
    this._displayName = name;
    this.addDomainEvent(new ProfileUpdatedEvent(this._id, { displayName: name }));
  }

  // Profanity detection uses a curated word list (src/domain/shared/filters/profanity-list.ts)
  // with Levenshtein distance matching (threshold: 1) for common evasion patterns

  setAvatar(mediaId: AvatarId): void {
    this._avatar = mediaId;
    this.addDomainEvent(new AvatarChangedEvent(this._id, mediaId));
  }

  updatePrivacy(settings: PrivacySettings): void {
    this._privacySettings = settings;
    this.addDomainEvent(new PrivacySettingsChangedEvent(this._id, settings));
  }
}
```

##### MediaAsset Aggregate (Separate)

```typescript
// src/domain/profile/aggregates/MediaAsset.ts

export class MediaAsset {
  private readonly _id: MediaId;
  private readonly _ownerId: MemberId;
  private _originalUrl: Url;
  private _variants: MediaVariant[];
  private _metadata: MediaMetadata;
  private _status: MediaStatus;

  // Invariants
  static create(
    id: MediaId,
    ownerId: MemberId,
    file: UploadedFile
  ): MediaAsset {
    // Validate magic bytes
    if (!file.hasValidMagicBytes()) {
      throw new InvalidFileTypeError(file.mimeType);
    }

    // Check file size
    if (file.size > MediaLimits.MAX_FILE_SIZE) {
      throw new FileTooLargeError(file.size, MediaLimits.MAX_FILE_SIZE);
    }

    return new MediaAsset(/* ... */);
  }

  generateVariants(): void {
    // Variants: thumbnail (100px), small (200px), medium (400px), large (800px)
    this._variants = [
      MediaVariant.create('thumbnail', 100),
      MediaVariant.create('small', 200),
      MediaVariant.create('medium', 400),
      MediaVariant.create('large', 800),
    ];
    this._status = MediaStatus.Processing;
  }
}
```

**Design Decision**: MediaAsset is a separate aggregate because:
- It has its own lifecycle (upload, process, delete)
- Media can be shared across multiple entities
- Processing is asynchronous

---

#### 3. Content Context

##### Publication Aggregate

```typescript
// src/domain/content/aggregates/Publication.ts

export class Publication {
  private readonly _id: PublicationId;
  private readonly _authorId: MemberId;
  private _content: PublicationContent;
  private _mediaIds: MediaId[];  // References by ID
  private _visibility: Visibility;
  private _status: PublicationStatus;
  private _reactionCounts: ReactionCounts;  // Denormalized for reads
  private _createdAt: Timestamp;
  private _domainEvents: DomainEvent[] = [];

  static create(
    id: PublicationId,
    authorId: MemberId,
    content: PublicationContent,
    visibility: Visibility
  ): Publication {
    if (content.isEmpty()) {
      throw new EmptyContentError();
    }
    if (content.length > ContentLimits.MAX_POST_LENGTH) {
      throw new ContentTooLongError(content.length);
    }

    const publication = new Publication(/* ... */);
    publication.addDomainEvent(new PublicationCreatedEvent(id, authorId));
    return publication;
  }

  // Reactions handled via events from separate aggregate
  incrementReaction(type: ReactionType): void {
    this._reactionCounts = this._reactionCounts.increment(type);
  }

  edit(newContent: PublicationContent): void {
    if (this._status !== PublicationStatus.Published) {
      throw new CannotEditError(this._status);
    }
    this._content = newContent;
    this.addDomainEvent(new PublicationEditedEvent(this._id, newContent));
  }

  delete(): void {
    this._status = PublicationStatus.Deleted;
    this.addDomainEvent(new PublicationDeletedEvent(this._id));
  }
}
```

##### Discussion Aggregate (Comments)

```typescript
// src/domain/content/aggregates/Discussion.ts

export class Discussion {
  private readonly _id: DiscussionId;
  private readonly _publicationId: PublicationId;
  private readonly _authorId: MemberId;
  private _parentId: DiscussionId | null;
  private _path: MaterializedPath;  // For hierarchy
  private _depth: number;
  private _content: DiscussionContent;
  private _mentions: Mention[];
  private _status: DiscussionStatus;

  static create(
    id: DiscussionId,
    publicationId: PublicationId,
    authorId: MemberId,
    content: DiscussionContent,
    parentId: DiscussionId | null,
    parentPath: MaterializedPath | null
  ): Discussion {
    // Calculate depth from parent
    const depth = parentPath ? parentPath.depth + 1 : 0;

    // Invariant: max depth 3 (0, 1, 2)
    if (depth > 2) {
      throw new MaxDepthExceededError(depth);
    }

    // Calculate path
    const path = parentPath
      ? parentPath.append(id)
      : MaterializedPath.root(id);

    // Extract mentions
    const mentions = Mention.extractFrom(content);

    const discussion = new Discussion(/* ... */);
    discussion.addDomainEvent(new DiscussionCreatedEvent(id, publicationId, authorId));

    // Emit mention events
    mentions.forEach(m =>
      discussion.addDomainEvent(new MemberMentionedEvent(m.memberId, id))
    );

    return discussion;
  }
}
```

**Design Decision**: Discussion (Comment) is a separate aggregate from Publication because:
- Comments have their own lifecycle
- Comments can be independently moderated
- Loading all comments with a post would be too expensive

##### Reaction Aggregate

```typescript
// src/domain/content/aggregates/Reaction.ts

export class Reaction {
  private readonly _id: ReactionId;
  private readonly _targetType: 'publication' | 'discussion';
  private readonly _targetId: PublicationId | DiscussionId;
  private readonly _memberId: MemberId;
  private _type: ReactionType;  // 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry'
  private _createdAt: Timestamp;

  static create(
    id: ReactionId,
    targetType: 'publication' | 'discussion',
    targetId: PublicationId | DiscussionId,
    memberId: MemberId,
    type: ReactionType
  ): Reaction {
    const reaction = new Reaction(id, targetType, targetId, memberId, type);
    reaction.addDomainEvent(new ReactionAddedEvent(targetType, targetId.value, memberId.value, type.value));
    return reaction;
  }

  changeType(newType: ReactionType): void {
    this._type = newType;
    this.addDomainEvent(new ReactionChangedEvent(this._id.value, newType.value));
  }

  remove(): void {
    this.addDomainEvent(new ReactionRemovedEvent(this._targetType, this._targetId.value, this._memberId.value));
  }
}
```

**Invariants**:
- One reaction per member per target (enforced at repository level)
- Reaction type must be from allowed set

---

#### 4. Social Graph Context

##### Connection Aggregate

```typescript
// src/domain/social-graph/aggregates/Connection.ts

export class Connection {
  private readonly _id: ConnectionId;
  private readonly _followerId: MemberId;
  private readonly _followingId: MemberId;
  private _status: ConnectionStatus;
  private _createdAt: Timestamp;

  static request(
    id: ConnectionId,
    followerId: MemberId,
    followingId: MemberId,
    targetIsPrivate: boolean
  ): Connection {
    // Invariant: cannot follow self
    if (followerId.equals(followingId)) {
      throw new CannotFollowSelfError();
    }

    const status = targetIsPrivate
      ? ConnectionStatus.Pending
      : ConnectionStatus.Active;

    const connection = new Connection(id, followerId, followingId, status);

    if (targetIsPrivate) {
      connection.addDomainEvent(new FollowRequestedEvent(id, followerId, followingId));
    } else {
      connection.addDomainEvent(new FollowedEvent(id, followerId, followingId));
    }

    return connection;
  }

  approve(): void {
    if (this._status !== ConnectionStatus.Pending) {
      throw new InvalidStatusTransitionError(this._status, ConnectionStatus.Active);
    }
    this._status = ConnectionStatus.Active;
    this.addDomainEvent(new FollowApprovedEvent(this._id, this._followerId, this._followingId));
  }

  reject(): void {
    if (this._status !== ConnectionStatus.Pending) {
      throw new InvalidStatusTransitionError(this._status, ConnectionStatus.Rejected);
    }
    this._status = ConnectionStatus.Rejected;
    this.addDomainEvent(new FollowRejectedEvent(this._id, this._followerId, this._followingId));
  }
}
```

##### Block Aggregate

```typescript
// src/domain/social-graph/aggregates/Block.ts

export class Block {
  private readonly _id: BlockId;
  private readonly _blockerId: MemberId;
  private readonly _blockedId: MemberId;
  private _createdAt: Timestamp;

  static create(
    id: BlockId,
    blockerId: MemberId,
    blockedId: MemberId
  ): Block {
    // Invariant: cannot block self
    if (blockerId.equals(blockedId)) {
      throw new CannotBlockSelfError();
    }

    const block = new Block(id, blockerId, blockedId);

    // Block is bidirectional - emit event for content filtering
    block.addDomainEvent(new MemberBlockedEvent(id, blockerId, blockedId));

    return block;
  }
}
```

---

#### 5. Community Context

##### Group Aggregate

```typescript
// src/domain/community/aggregates/Group.ts

export class Group {
  private readonly _id: GroupId;
  private _name: GroupName;
  private _description: GroupDescription;
  private _ownerId: MemberId;
  private _settings: GroupSettings;
  private _rules: GroupRule[];
  private _status: GroupStatus;

  static create(
    id: GroupId,
    name: GroupName,
    ownerId: MemberId
  ): Group {
    const group = new Group(
      id,
      name,
      GroupDescription.empty(),
      ownerId,
      GroupSettings.default(),
      [],
      GroupStatus.Active
    );

    group.addDomainEvent(new GroupCreatedEvent(id, ownerId));
    return group;
  }

  // Only owner can transfer ownership
  transferOwnership(newOwnerId: MemberId, currentOwnerId: MemberId): void {
    if (!this._ownerId.equals(currentOwnerId)) {
      throw new OnlyOwnerCanTransferError();
    }
    this._ownerId = newOwnerId;
    this.addDomainEvent(new OwnershipTransferredEvent(this._id, currentOwnerId, newOwnerId));
  }

  addRule(rule: GroupRule): void {
    if (this._rules.length >= 10) {
      throw new MaxRulesExceededError();
    }
    this._rules.push(rule);
  }
}
```

##### Membership Aggregate (Separate)

```typescript
// src/domain/community/aggregates/Membership.ts

export class Membership {
  private readonly _id: MembershipId;
  private readonly _groupId: GroupId;
  private readonly _memberId: MemberId;
  private _role: MembershipRole;
  private _joinedAt: Timestamp;
  private _permissions: Permission[];  // Cached from role

  static join(
    id: MembershipId,
    groupId: GroupId,
    memberId: MemberId
  ): Membership {
    const membership = new Membership(
      id,
      groupId,
      memberId,
      MembershipRole.Member,
      Timestamp.now(),
      MembershipRole.Member.defaultPermissions()
    );

    membership.addDomainEvent(new MemberJoinedGroupEvent(id, groupId, memberId));
    return membership;
  }

  promote(newRole: MembershipRole, promoterId: MemberId): void {
    // Invariant: can only promote to lower or equal role
    if (newRole.isHigherThan(MembershipRole.Moderator)) {
      throw new CannotPromoteToOwnerError();
    }

    this._role = newRole;
    this._permissions = newRole.defaultPermissions();
    this.addDomainEvent(new MemberPromotedEvent(this._id, newRole, promoterId));
  }

  hasPermission(permission: Permission): boolean {
    return this._permissions.includes(permission);
  }
}
```

**Design Decision**: Membership is separate from Group because:
- A group can have thousands of members
- Membership has its own lifecycle (join, promote, leave)
- Permission checks are per-membership

---

#### 6. Notification Context

##### Alert Aggregate

```typescript
// src/domain/notification/aggregates/Alert.ts

export class Alert {
  private readonly _id: AlertId;
  private readonly _recipientId: MemberId;
  private _type: AlertType;
  private _content: AlertContent;
  private _sourceId: EntityId;  // Generic reference to triggering entity
  private _status: AlertStatus;
  private _deliveries: Delivery[];

  static create(
    id: AlertId,
    recipientId: MemberId,
    type: AlertType,
    content: AlertContent,
    sourceId: EntityId
  ): Alert {
    return new Alert(
      id,
      recipientId,
      type,
      content,
      sourceId,
      AlertStatus.Pending,
      []
    );
  }

  markDelivered(channel: DeliveryChannel): void {
    this._deliveries.push(Delivery.successful(channel, Timestamp.now()));

    if (this._status === AlertStatus.Pending) {
      this._status = AlertStatus.Delivered;
    }
  }

  markRead(): void {
    this._status = AlertStatus.Read;
    this.addDomainEvent(new AlertReadEvent(this._id, this._recipientId));
  }
}
```

---

#### 7. Admin Context

##### Administrator Aggregate

```typescript
// src/domain/admin/aggregates/Administrator.ts

export class Administrator {
  private readonly _id: AdminId;
  private _email: Email;
  private _credential: Credential;
  private _role: AdminRole;
  private _twoFactor: TwoFactorAuth | null;
  private _ipWhitelist: IPAddress[];
  private _status: AdminStatus;

  // Invariant: 2FA must be enabled
  enable2FA(secret: TwoFactorSecret): void {
    this._twoFactor = TwoFactorAuth.setup(secret);
    this.addDomainEvent(new Admin2FAEnabledEvent(this._id));
  }

  verify2FA(code: TOTPCode): boolean {
    if (!this._twoFactor) {
      throw new TwoFactorNotEnabledError();
    }
    return this._twoFactor.verify(code);
  }

  // IP whitelist management
  addWhitelistedIP(ip: IPAddress): void {
    if (this._ipWhitelist.some(existing => existing.equals(ip))) {
      throw new IPAlreadyWhitelistedError(ip);
    }
    this._ipWhitelist.push(ip);
    this.addDomainEvent(new IPWhitelistedEvent(this._id, ip));
  }

  isIPAllowed(ip: IPAddress): boolean {
    if (this._ipWhitelist.length === 0) {
      return true;  // No whitelist = all allowed
    }
    return this._ipWhitelist.some(allowed => allowed.contains(ip));
  }
}
```

---

### Aggregate Design Guidelines

### Domain Constants

```typescript
// src/domain/shared/constants/DomainConstants.ts

export const ContentLimits = {
  MAX_POST_LENGTH: 5000,          // Maximum characters per publication
  MAX_COMMENT_LENGTH: 2000,       // Maximum characters per discussion
  MAX_MENTIONS_PER_CONTENT: 10,   // Maximum @mentions per post/comment
} as const;

export const MediaLimits = {
  MAX_FILE_SIZE: 10 * 1024 * 1024,      // 10 MB maximum file size
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  MAX_MEDIA_PER_POST: 4,                 // Maximum media attachments per post
} as const;

export const SecurityLimits = {
  MAX_FAILED_LOGINS: 5,           // Lockout threshold
  LOCKOUT_DURATION_MINUTES: 15,   // Lockout duration
  PASSWORD_MIN_LENGTH: 8,         // Minimum password length
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]).{8,128}$/,
  MAX_ACTIVE_SESSIONS: 5,         // Maximum concurrent refresh tokens per user
} as const;

export const GroupLimits = {
  MAX_RULES: 10,                  // Maximum rules per group
  MAX_NAME_LENGTH: 100,           // Maximum group name length
  MAX_DESCRIPTION_LENGTH: 1000,   // Maximum group description length
} as const;
```

#### Size Guidelines

| Aggregate | Estimated Size | Rationale |
|-----------|---------------|-----------|
| Member | Small (1 entity) | Auth-focused, no nested entities |
| Profile | Small (1 entity + VOs) | User-specific, rarely shared |
| Publication | Small-Medium | Content + references |
| Discussion | Small | Single comment + metadata |
| Connection | Small | Single relationship |
| Group | Medium | Settings + rules (no members) |
| Membership | Small | Single role assignment |
| Alert | Small | Single notification |

#### Concurrency Strategy

```typescript
// All aggregates use optimistic locking
export abstract class AggregateRoot {
  private _version: number = 0;

  get version(): number {
    return this._version;
  }

  incrementVersion(): void {
    this._version++;
  }
}

// Repository implementation checks version
async save(aggregate: T): Promise<void> {
  const result = await this.db.query(`
    UPDATE ${this.tableName}
    SET data = $1, version = version + 1
    WHERE id = $2 AND version = $3
  `, [aggregate.toData(), aggregate.id, aggregate.version]);

  if (result.rowCount === 0) {
    throw new OptimisticLockError(aggregate.id);
  }
}
```

## Consequences

### Positive

- **Clear Boundaries**: Each aggregate has well-defined invariants
- **Performance**: Small aggregates reduce lock contention
- **Scalability**: Aggregates can be partitioned independently
- **Testability**: Aggregates can be unit tested in isolation

### Negative

- **Eventual Consistency**: Cross-aggregate queries may show stale data
- **Complexity**: More aggregates = more coordination via events
- **Duplication**: Some denormalization for read performance

### Mitigation

- **Eventual Consistency**: Use CQRS read models for queries
- **Complexity**: Document event flows in ADR-009
- **Duplication**: Accept controlled denormalization; sync via events

## References

- Vernon, V. (2013). Implementing Domain-Driven Design - Chapter 10: Aggregates
- Evans, E. (2003). Domain-Driven Design - Chapter 6: Aggregates
- System Architecture Specification - Database Schema sections

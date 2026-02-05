# ADR-009: Domain Events Strategy

**Status**: Accepted
**Date**: 2025-12-16
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-006 (DDD Architecture), ADR-007 (Bounded Contexts), ADR-008 (Aggregates)

## Context

With bounded contexts and aggregates defined, we need a strategy for cross-context communication and eventual consistency. The architecture specifications reveal several integration requirements:

1. **Social Graph → Content**: Block events must filter content visibility
2. **Content → Notification**: New posts/comments trigger notifications
3. **Community → Notification**: Group activities trigger alerts
4. **Identity → All Contexts**: User status changes affect all features
5. **All Contexts → Admin**: Audit logging for security monitoring

Key technical constraints:
- **Performance**: p95 < 500ms for synchronous operations
- **Real-time**: WebSocket notifications via Socket.IO
- **Reliability**: At-least-once delivery for critical events
- **Scale**: 1,000 concurrent users, eventual consistency acceptable

## Decision

We adopt a **hybrid domain events strategy** with:

1. **In-Process Events**: For same-context and synchronous cross-context communication
2. **Message Queue Events**: For asynchronous cross-context communication (Bull Queue + Redis)
3. **WebSocket Events**: For real-time client notifications (Socket.IO)

### Event Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Domain Events Architecture                           │
└─────────────────────────────────────────────────────────────────────────────┘

                          ┌──────────────────┐
                          │  Domain Aggregate │
                          │    (Publisher)    │
                          └────────┬─────────┘
                                   │ raises
                                   ▼
                          ┌──────────────────┐
                          │  Domain Event    │
                          │  (Immutable)     │
                          └────────┬─────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
           │ In-Process   │ │ Message Queue│ │ WebSocket    │
           │ Dispatcher   │ │ Publisher    │ │ Emitter      │
           │              │ │ (Bull Queue) │ │ (Socket.IO)  │
           └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
                  │                │                │
                  ▼                ▼                ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
           │ Same-Context │ │ Cross-Context│ │ Real-Time    │
           │ Handlers     │ │ Consumers    │ │ Clients      │
           └──────────────┘ └──────────────┘ └──────────────┘
```

### Event Categories

| Category | Delivery | Guarantee | Use Case |
|----------|----------|-----------|----------|
| **Domain Events** | In-process | At-most-once | Same-context side effects |
| **Integration Events** | Bull Queue | At-least-once | Cross-context communication |
| **Notification Events** | Socket.IO | At-most-once | Real-time UI updates |
| **Audit Events** | Bull Queue | At-least-once | Security logging |

---

### Domain Event Design

#### Base Event Structure

```typescript
// src/domain/shared/events/DomainEvent.ts

export abstract class DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly version: number;

  constructor(aggregateId: string, aggregateType: string, version: number = 1) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
    this.version = version;
    Object.freeze(this);
  }

  abstract get eventType(): string;

  toJSON(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      occurredOn: this.occurredOn.toISOString(),
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      version: this.version,
      payload: this.getPayload(),
    };
  }

  protected abstract getPayload(): Record<string, unknown>;
}
```

#### Event Naming Convention

```
[Context].[Aggregate][PastTenseVerb]Event

Examples:
- identity.member_registered
- identity.member_authenticated
- identity.member_suspended
- content.publication_created
- content.publication_deleted
- content.discussion_created
- social_graph.member_followed
- social_graph.member_blocked
- community.member_joined_group
- community.member_promoted
- notification.alert_delivered
- admin.audit_entry_created
```

#### Naming Convention Exceptions

Events that span multiple aggregates or reference external entities follow a relaxed pattern:

| Event | Rationale for Deviation |
|-------|------------------------|
| `content.member_mentioned` | Cross-aggregate: mentions are extracted from content but target members |
| `community.member_kicked` | Shortened from `community.member_kicked_from_group` for readability |

All other events MUST follow the `[Context].[Aggregate][PastTenseVerb]` convention strictly.

---

### Event Catalog by Bounded Context

#### Identity Context Events

```typescript
// src/domain/identity/events/

export class MemberRegisteredEvent extends DomainEvent {
  constructor(
    readonly memberId: string,
    readonly email: string
  ) {
    super(memberId, 'Member');
  }

  get eventType(): string {
    return 'identity.member_registered';
  }

  protected getPayload() {
    return { memberId: this.memberId, email: this.email };
  }
}

export class MemberAuthenticatedEvent extends DomainEvent {
  constructor(
    readonly memberId: string,
    readonly ipAddress: string,
    readonly userAgent: string
  ) {
    super(memberId, 'Member');
  }

  get eventType(): string {
    return 'identity.member_authenticated';
  }
}

> **Implementation Note**: The `ipAddress` and `userAgent` fields are populated at the application layer by the authentication handler, NOT by the domain aggregate. The `Member` aggregate raises a simpler `MemberAuthenticationSucceededEvent(memberId)` which the handler enriches with HTTP context before publishing as `MemberAuthenticatedEvent`. See ADR-008 for the aggregate-level event.

export class MemberSuspendedEvent extends DomainEvent {
  constructor(
    readonly memberId: string,
    readonly reason: string,
    readonly suspendedBy: string
  ) {
    super(memberId, 'Member');
  }

  get eventType(): string {
    return 'identity.member_suspended';
  }
}

export class MemberLockedEvent extends DomainEvent {
  constructor(
    readonly memberId: string,
    readonly lockedUntil: Date
  ) {
    super(memberId, 'Member');
  }

  get eventType(): string {
    return 'identity.member_locked';
  }
}
```

#### Profile Context Events

```typescript
// src/domain/profile/events/

export class ProfileCreatedEvent extends DomainEvent {
  get eventType(): string { return 'profile.profile_created'; }
}

export class ProfileUpdatedEvent extends DomainEvent {
  constructor(
    readonly profileId: string,
    readonly changes: Record<string, unknown>
  ) {
    super(profileId, 'Profile');
  }

  get eventType(): string { return 'profile.profile_updated'; }
}

export class AvatarChangedEvent extends DomainEvent {
  constructor(
    readonly profileId: string,
    readonly mediaId: string
  ) {
    super(profileId, 'Profile');
  }

  get eventType(): string { return 'profile.avatar_changed'; }
}

export class MediaUploadedEvent extends DomainEvent {
  constructor(
    readonly mediaId: string,
    readonly ownerId: string,
    readonly mimeType: string,
    readonly size: number
  ) {
    super(mediaId, 'MediaAsset');
  }

  get eventType(): string { return 'profile.media_uploaded'; }
}
```

#### Content Context Events

```typescript
// src/domain/content/events/

export class PublicationCreatedEvent extends DomainEvent {
  constructor(
    readonly publicationId: string,
    readonly authorId: string,
    readonly visibility: string,
    readonly mentionedUserIds: string[]
  ) {
    super(publicationId, 'Publication');
  }

  get eventType(): string { return 'content.publication_created'; }
}

export class PublicationEditedEvent extends DomainEvent {
  get eventType(): string { return 'content.publication_edited'; }
}

export class PublicationDeletedEvent extends DomainEvent {
  get eventType(): string { return 'content.publication_deleted'; }
}

export class DiscussionCreatedEvent extends DomainEvent {
  constructor(
    readonly discussionId: string,
    readonly publicationId: string,
    readonly authorId: string,
    readonly parentId: string | null,
    readonly mentionedUserIds: string[]
  ) {
    super(discussionId, 'Discussion');
  }

  get eventType(): string { return 'content.discussion_created'; }
}

export class MemberMentionedEvent extends DomainEvent {
  constructor(
    readonly mentionedMemberId: string,
    readonly sourceType: 'publication' | 'discussion',
    readonly sourceId: string,
    readonly mentionedBy: string
  ) {
    super(sourceId, sourceType === 'publication' ? 'Publication' : 'Discussion');
  }

  // Note: Follows [Context].[Subject][Verb] pattern rather than aggregate-prefix pattern for cross-aggregate events
  get eventType(): string { return 'content.member_mentioned'; }
}

export class ReactionAddedEvent extends DomainEvent {
  constructor(
    readonly targetType: 'publication' | 'discussion',
    readonly targetId: string,
    readonly memberId: string,
    readonly reactionType: string
  ) {
    super(targetId, targetType === 'publication' ? 'Publication' : 'Discussion');
  }

  get eventType(): string { return 'content.reaction_added'; }
}
```

#### Social Graph Context Events

```typescript
// src/domain/social-graph/events/

export class FollowedEvent extends DomainEvent {
  constructor(
    readonly connectionId: string,
    readonly followerId: string,
    readonly followingId: string
  ) {
    super(connectionId, 'Connection');
  }

  get eventType(): string { return 'social_graph.member_followed'; }
}

export class FollowRequestedEvent extends DomainEvent {
  constructor(
    readonly connectionId: string,
    readonly followerId: string,
    readonly followingId: string
  ) {
    super(connectionId, 'Connection');
  }

  get eventType(): string { return 'social_graph.follow_requested'; }
}

export class FollowApprovedEvent extends DomainEvent {
  get eventType(): string { return 'social_graph.follow_approved'; }
}

export class FollowRejectedEvent extends DomainEvent {
  get eventType(): string { return 'social_graph.follow_rejected'; }
}

export class UnfollowedEvent extends DomainEvent {
  constructor(
    readonly followerId: string,
    readonly followingId: string
  ) {
    super(followerId, 'Connection');
  }

  get eventType(): string { return 'social_graph.member_unfollowed'; }
}

export class MemberBlockedEvent extends DomainEvent {
  constructor(
    readonly blockId: string,
    readonly blockerId: string,
    readonly blockedId: string
  ) {
    super(blockId, 'Block');
  }

  get eventType(): string { return 'social_graph.member_blocked'; }
}

export class MemberUnblockedEvent extends DomainEvent {
  get eventType(): string { return 'social_graph.member_unblocked'; }
}
```

#### Community Context Events

```typescript
// src/domain/community/events/

export class GroupCreatedEvent extends DomainEvent {
  constructor(
    readonly groupId: string,
    readonly ownerId: string,
    readonly name: string
  ) {
    super(groupId, 'Group');
  }

  get eventType(): string { return 'community.group_created'; }
}

export class MemberJoinedGroupEvent extends DomainEvent {
  constructor(
    readonly membershipId: string,
    readonly groupId: string,
    readonly memberId: string
  ) {
    super(membershipId, 'Membership');
  }

  get eventType(): string { return 'community.member_joined_group'; }
}

export class MemberLeftGroupEvent extends DomainEvent {
  get eventType(): string { return 'community.member_left_group'; }
}

export class MemberPromotedEvent extends DomainEvent {
  constructor(
    readonly membershipId: string,
    readonly groupId: string,
    readonly memberId: string,
    readonly newRole: string,
    readonly promotedBy: string
  ) {
    super(membershipId, 'Membership');
  }

  get eventType(): string { return 'community.member_promoted'; }
}

export class MemberDemotedEvent extends DomainEvent {
  get eventType(): string { return 'community.member_demoted'; }
}

export class MemberKickedFromGroupEvent extends DomainEvent {
  constructor(
    readonly groupId: string,
    readonly memberId: string,
    readonly kickedBy: string,
    readonly reason: string
  ) {
    super(groupId, 'Group');
  }

  // Full form: community.member_kicked_from_group (shortened for readability)
  get eventType(): string { return 'community.member_kicked'; }
}

export class GroupSettingsUpdatedEvent extends DomainEvent {
  get eventType(): string { return 'community.group_settings_updated'; }
}
```

#### Notification Context Events

```typescript
// src/domain/notification/events/

export class AlertCreatedEvent extends DomainEvent {
  constructor(
    readonly alertId: string,
    readonly recipientId: string,
    readonly alertType: string
  ) {
    super(alertId, 'Alert');
  }

  get eventType(): string { return 'notification.alert_created'; }
}

export class AlertDeliveredEvent extends DomainEvent {
  constructor(
    readonly alertId: string,
    readonly channel: string
  ) {
    super(alertId, 'Alert');
  }

  get eventType(): string { return 'notification.alert_delivered'; }
}

export class AlertReadEvent extends DomainEvent {
  get eventType(): string { return 'notification.alert_read'; }
}

export class PreferencesUpdatedEvent extends DomainEvent {
  get eventType(): string { return 'notification.preferences_updated'; }
}
```

#### Admin Context Events

```typescript
// src/domain/admin/events/

export class AuditEntryCreatedEvent extends DomainEvent {
  constructor(
    readonly entryId: string,
    readonly adminId: string,
    readonly action: string,
    readonly resourceType: string,
    readonly resourceId: string
  ) {
    super(entryId, 'AuditEntry');
  }

  get eventType(): string { return 'admin.audit_entry_created'; }
}

export class Admin2FAEnabledEvent extends DomainEvent {
  get eventType(): string { return 'admin.2fa_enabled'; }
}

export class Admin2FADisabledEvent extends DomainEvent {
  get eventType(): string { return 'admin.2fa_disabled'; }
}

export class SecurityAlertRaisedEvent extends DomainEvent {
  constructor(
    readonly alertId: string,
    readonly alertType: string,
    readonly severity: 'low' | 'medium' | 'high' | 'critical',
    readonly description: string
  ) {
    super(alertId, 'SecurityAlert');
  }

  get eventType(): string { return 'admin.security_alert_raised'; }
}

export class IPWhitelistedEvent extends DomainEvent {
  get eventType(): string { return 'admin.ip_whitelisted'; }
}

export class IPRemovedFromWhitelistEvent extends DomainEvent {
  get eventType(): string { return 'admin.ip_removed_from_whitelist'; }
}
```

---

### Event Flow Diagrams

#### Publication Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Publication Creation Event Flow                           │
└─────────────────────────────────────────────────────────────────────────────┘

User creates post
       │
       ▼
┌──────────────────┐
│   Content API    │
│   Controller     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ CreatePublication│
│    Handler       │
└────────┬─────────┘
         │ 1. Create aggregate
         ▼
┌──────────────────┐
│   Publication    │
│   Aggregate      │──────────────────────────────────────────────┐
└────────┬─────────┘                                              │
         │ 2. Save + events                                       │
         ▼                                                        │
┌──────────────────┐                                              │
│   Repository     │                                              │
│   (PostgreSQL)   │                                              │
└────────┬─────────┘                                              │
         │                                                        │
         ▼                                                        │
┌──────────────────┐     ┌──────────────────┐     ┌──────────────┴───────┐
│  Event Dispatcher│────►│  Bull Queue      │────►│ Notification Handler │
└──────────────────┘     │  (Redis)         │     │                      │
                         └────────┬─────────┘     │ - Create alerts for: │
                                  │               │   - Mentioned users  │
                                  │               │   - Followers        │
                                  │               └──────────┬───────────┘
                                  │                          │
                                  ▼                          ▼
                         ┌──────────────────┐     ┌──────────────────┐
                         │ Feed Handler     │     │ Socket.IO        │
                         │                  │     │ (WebSocket)      │
                         │ - Update feeds   │     │                  │
                         │ - Invalidate     │     │ - Real-time push │
                         │   cache          │     │   to followers   │
                         └──────────────────┘     └──────────────────┘
```

#### Member Block Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Member Block Event Flow                                │
└─────────────────────────────────────────────────────────────────────────────┘

User blocks another user
       │
       ▼
┌──────────────────┐
│ Social Graph API │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  CreateBlock     │
│  Handler         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐      MemberBlockedEvent
│  Block Aggregate │──────────────┐
└────────┬─────────┘              │
         │                        │
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│  Block           │     │  Bull Queue      │
│  Repository      │     │  (Integration)   │
└──────────────────┘     └────────┬─────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Connection       │     │ Feed             │     │ Notification     │
│ Handler          │     │ Handler          │     │ Handler          │
│                  │     │                  │     │                  │
│ - Remove any     │     │ - Filter blocked │     │ - Block future   │
│   existing       │     │   user's content │     │   notifications  │
│   follow         │     │   from blocker's │     │   from blocked   │
│   relationship   │     │   feed           │     │   user           │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

---

### Event Infrastructure

#### In-Process Event Dispatcher

```typescript
// src/infrastructure/shared/events/InProcessEventDispatcher.ts

export class InProcessEventDispatcher implements EventDispatcher {
  private handlers: Map<string, EventHandler<DomainEvent>[]> = new Map();

  register<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void {
    const existing = this.handlers.get(eventType) || [];
    this.handlers.set(eventType, [...existing, handler as EventHandler<DomainEvent>]);
  }

  async dispatch(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      const handlers = this.handlers.get(event.eventType) || [];

      await Promise.all(
        handlers.map(handler => handler.handle(event))
      );
    }
  }
}
```

#### Bull Queue Integration Event Publisher

```typescript
// src/infrastructure/shared/events/BullQueueEventPublisher.ts

import Queue from 'bull';

export class BullQueueEventPublisher implements IntegrationEventPublisher {
  private queue: Queue.Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue('integration-events', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.queue.add(event.eventType, event.toJSON(), {
      priority: this.getPriority(event),
    });
  }

  private getPriority(event: DomainEvent): number {
    // Critical events get higher priority
    if (event.eventType.startsWith('admin.security')) {
      return 1;
    }
    if (event.eventType.includes('blocked')) {
      return 2;
    }
    return 3;
  }
}
```

#### Socket.IO Real-Time Event Emitter

```typescript
// src/infrastructure/notification/events/SocketIOEventEmitter.ts

export class SocketIOEventEmitter implements RealTimeEventEmitter {
  constructor(private io: Server) {}

  async emitToUser(userId: string, event: DomainEvent): Promise<void> {
    const room = `user:${userId}`;
    this.io.to(room).emit(event.eventType, event.toJSON());
  }

  async emitToGroup(groupId: string, event: DomainEvent): Promise<void> {
    const room = `group:${groupId}`;
    this.io.to(room).emit(event.eventType, event.toJSON());
  }

  async emitToFollowers(userId: string, event: DomainEvent): Promise<void> {
    const room = `followers:${userId}`;
    this.io.to(room).emit(event.eventType, event.toJSON());
  }
}
```

### Dead Letter Queue (DLQ) Strategy

Events that fail all retry attempts (3 retries with exponential backoff) are moved to a Dead Letter Queue for manual inspection and replay.

#### DLQ Configuration

```typescript
// src/infrastructure/shared/events/DeadLetterQueue.ts

export class DeadLetterQueueHandler {
  private dlqQueue: Queue.Queue;

  constructor(redisUrl: string) {
    this.dlqQueue = new Queue('dead-letter-queue', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: false,  // Keep for inspection
        removeOnFail: false,      // Never auto-remove failed DLQ entries
      },
    });
  }

  async moveToDeadLetter(event: DomainEvent, error: Error, attempts: number): Promise<void> {
    await this.dlqQueue.add('failed-event', {
      event: event.toJSON(),
      error: {
        message: error.message,
        stack: error.stack,
      },
      failedAt: new Date().toISOString(),
      attempts,
      originalQueue: 'integration-events',
    });
  }

  async replay(jobId: string): Promise<void> {
    const job = await this.dlqQueue.getJob(jobId);
    if (!job) throw new Error(`DLQ job ${jobId} not found`);

    const integrationQueue = new Queue('integration-events', this.redisUrl);
    await integrationQueue.add(job.data.event.eventType, job.data.event);
    await job.remove();
  }

  async listFailed(limit: number = 50): Promise<DLQEntry[]> {
    const jobs = await this.dlqQueue.getWaiting(0, limit);
    return jobs.map(job => ({
      id: job.id,
      eventType: job.data.event.eventType,
      failedAt: job.data.failedAt,
      error: job.data.error.message,
      attempts: job.data.attempts,
    }));
  }
}
```

#### DLQ Monitoring

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| DLQ depth | > 10 events | WARNING: Investigate failing handlers |
| DLQ depth | > 50 events | CRITICAL: Page on-call engineer |
| DLQ event age | > 24 hours | WARNING: Stale events need replay or discard |
| Same event type failures | > 5 in 1 hour | CRITICAL: Likely systematic handler bug |

### Event Schema Versioning

Events evolve over time. We adopt **additive-only** versioning to maintain backward compatibility.

#### Versioning Rules

1. **Adding fields**: Always backward-compatible. New fields are optional with defaults.
2. **Removing fields**: NEVER remove fields. Deprecate by adding `@deprecated` JSDoc.
3. **Changing field types**: NEVER change existing field types. Add a new field instead.
4. **Renaming fields**: NEVER rename. Add new field, deprecate old.

#### Version Negotiation

```typescript
// Events carry a version number (default: 1)
export abstract class DomainEvent {
  readonly version: number;

  constructor(aggregateId: string, aggregateType: string, version: number = 1) {
    // ...
  }
}

// Consumers check version and handle accordingly
export class VersionAwareHandler<T extends DomainEvent> implements EventHandler<T> {
  private handlers: Map<number, (event: T) => Promise<void>> = new Map();

  registerVersion(version: number, handler: (event: T) => Promise<void>): void {
    this.handlers.set(version, handler);
  }

  async handle(event: T): Promise<void> {
    const handler = this.handlers.get(event.version)
      || this.handlers.get(this.latestVersion());

    if (!handler) {
      throw new UnsupportedEventVersionError(event.eventType, event.version);
    }

    await handler(event);
  }

  private latestVersion(): number {
    return Math.max(...this.handlers.keys());
  }
}
```

#### Example: Adding a field to PublicationCreatedEvent

```typescript
// Version 1 (original)
// payload: { publicationId, authorId, visibility, mentionedUserIds }

// Version 2 (added groupId for group posts)
export class PublicationCreatedEvent extends DomainEvent {
  constructor(
    readonly publicationId: string,
    readonly authorId: string,
    readonly visibility: string,
    readonly mentionedUserIds: string[],
    readonly groupId: string | null = null  // New field, optional, defaults to null
  ) {
    super(publicationId, 'Publication', 2);  // Version bumped to 2
  }
}
// V1 consumers continue working -- they ignore groupId
// V2 consumers can use groupId if present
```

---

### Event Handler Registration

```typescript
// src/application/bootstrap/EventHandlerRegistry.ts

export function registerEventHandlers(
  dispatcher: EventDispatcher,
  container: Container
): void {
  // Content Context handlers
  dispatcher.register(
    'content.publication_created',
    container.get(PublicationCreatedHandler)
  );
  dispatcher.register(
    'content.member_mentioned',
    container.get(MemberMentionedHandler)
  );

  // Social Graph Context handlers
  dispatcher.register(
    'social_graph.member_followed',
    container.get(MemberFollowedHandler)
  );
  dispatcher.register(
    'social_graph.member_blocked',
    container.get(MemberBlockedHandler)
  );

  // Cross-context handlers (via Bull Queue consumers)
  // Registered separately in queue worker
}
```

---

### Delivery Guarantees

| Event Category | Guarantee | Implementation |
|----------------|-----------|----------------|
| Domain Events | At-most-once | In-process dispatch, no retry |
| Integration Events | At-least-once | Bull Queue with 3 retries |
| Notification Events | At-most-once (WS), At-least-once (Email) | Socket.IO + Bull Queue |
| Audit Events | At-least-once | Bull Queue with persistent storage |

### Processing Latency SLAs

| Event Category | Max Processing Latency | Monitoring |
|----------------|----------------------|------------|
| Domain Events | < 50ms (in-process) | Application metrics |
| Integration Events | < 5 seconds (p95) | Bull Queue dashboard |
| Notification Events | < 2 seconds (WebSocket) | Socket.IO metrics |
| Audit Events | < 10 seconds (p95) | Bull Queue dashboard |

### Idempotency

```typescript
// Integration event handlers must be idempotent
export class MemberBlockedHandler implements EventHandler<MemberBlockedEvent> {
  constructor(
    private feedService: FeedService,
    private idempotencyStore: IdempotencyStore
  ) {}

  async handle(event: MemberBlockedEvent): Promise<void> {
    // Check if already processed
    const processed = await this.idempotencyStore.isProcessed(event.eventId);
    if (processed) {
      return; // Skip duplicate
    }

    // Process event
    await this.feedService.filterBlockedContent(
      event.blockerId,
      event.blockedId
    );

    // Mark as processed
    await this.idempotencyStore.markProcessed(event.eventId, '24h');
  }
}
```

## Consequences

### Positive

- **Loose Coupling**: Contexts communicate via events, not direct calls
- **Scalability**: Bull Queue enables horizontal scaling of consumers
- **Auditability**: All events are logged and traceable
- **Real-time**: Socket.IO provides immediate user feedback
- **Resilience**: Queue-based delivery survives temporary failures

### Negative

- **Eventual Consistency**: Cross-context queries may show stale data
- **Complexity**: Event infrastructure requires careful management
- **Debugging**: Event flows are harder to trace than direct calls
- **Duplication**: Consumers must handle duplicate events

### Mitigation

- **Eventual Consistency**: Document expected delays; use optimistic UI
- **Complexity**: Implement event monitoring and dead letter queues
- **Debugging**: Add correlation IDs and distributed tracing
- **Duplication**: All handlers implement idempotency checks

## References

- M7 Notifications Architecture - WebSocket and Queue design
- Bull Queue Documentation - https://github.com/OptimalBits/bull
- Socket.IO Documentation - https://socket.io/docs/v4/
- Vaughn Vernon - Implementing Domain-Driven Design, Chapter 8: Domain Events

# ADR-007: Bounded Contexts Definition

**Status**: Accepted
**Date**: 2025-12-16
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-006 (DDD Architecture), ADR-002 (Modular Monolith)

## Context

Following the adoption of Domain-Driven Design (ADR-006), we need to define clear bounded context boundaries for the Community Social Network platform. The system specification identifies 8 milestones (M1-M8) that map to distinct business capabilities:

- M1: Authentication & Authorization
- M2: User Profiles & Media
- M3: Posts & Feed
- M4: Comments & Discussions
- M5: Groups & RBAC
- M6: Social Graph (Follow/Block)
- M7: Notifications
- M8: Admin Panel & Security

Each milestone has its own architectural documentation with detailed domain models, database schemas, and API contracts.

## Decision

We define **7 bounded contexts** aligned with business capabilities, consolidating closely related milestones where appropriate.

### Bounded Context Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Community Social Network                               │
│                           Bounded Context Map                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌───────────────────┐              ┌───────────────────┐
    │                   │              │                   │
    │     IDENTITY      │◄────────────►│     PROFILE       │
    │     CONTEXT       │   Shared     │     CONTEXT       │
    │                   │   Kernel     │                   │
    │ - Authentication  │   (UserId)   │ - User Profiles   │
    │ - Authorization   │              │ - Media Storage   │
    │ - Sessions        │              │ - Privacy Settings│
    │ - Tokens          │              │                   │
    └─────────┬─────────┘              └─────────┬─────────┘
              │                                  │
              │ Customer-Supplier                │ Customer-Supplier
              │                                  │
              ▼                                  ▼
    ┌───────────────────────────────────────────────────────┐
    │                                                        │
    │                    CONTENT CONTEXT                     │
    │                                                        │
    │ - Posts (Publications)                                 │
    │ - Comments (Discussions)                               │
    │ - Feed Generation                                      │
    │ - Reactions                                            │
    │ - Mentions                                             │
    │                                                        │
    └─────────────────────────┬─────────────────────────────┘
                              │
                              │ Conformist
                              │
    ┌─────────────────────────▼─────────────────────────────┐
    │                                                        │
    │                  SOCIAL GRAPH CONTEXT                  │
    │                                                        │
    │ - Connections (Follow/Unfollow)                        │
    │ - Blocks                                               │
    │ - Follow Suggestions                                   │
    │ - Privacy Enforcement                                  │
    │                                                        │
    └───────────────────────────────────────────────────────┘
              │
              │ Customer-Supplier
              │
    ┌─────────▼─────────┐              ┌───────────────────┐
    │                   │              │                   │
    │    COMMUNITY      │◄────────────►│   NOTIFICATION    │
    │    CONTEXT        │  Anti-       │   CONTEXT         │
    │                   │  Corruption  │                   │
    │ - Groups          │  Layer       │ - Alerts          │
    │ - Memberships     │              │ - Preferences     │
    │ - RBAC            │              │ - Delivery        │
    │ - Moderation      │              │ - WebSocket       │
    │                   │              │                   │
    └───────────────────┘              └───────────────────┘
                                                │
                                                │ Conformist
                                                │
                              ┌─────────────────▼───────────┐
                              │                             │
                              │       ADMIN CONTEXT         │
                              │                             │
                              │ - Admin Authentication      │
                              │ - 2FA Management            │
                              │ - Audit Logging             │
                              │ - Security Monitoring       │
                              │ - System Configuration      │
                              │                             │
                              └─────────────────────────────┘
```

### Context Definitions

#### 1. Identity Context (M1)

**Purpose**: Manage user identity, authentication, and authorization.

**Core Domain Concepts**:
- `Credential`: Authentication credentials (email/password)
- `Token`: JWT access and refresh tokens
- `Session`: Active user sessions
- `Permission`: Authorization grants

**Ubiquitous Language**:
| Term | Definition |
|------|------------|
| `Member` | A registered user in the system |
| `Credential` | Email/password pair for authentication |
| `AccessToken` | Short-lived JWT for API access (15 min) |
| `RefreshToken` | Long-lived token for session renewal (7 days) |

**Database Tables**: `users`, `refresh_tokens`

**Key Invariants**:
- A member must have a unique email
- Passwords must be bcrypt hashed (cost factor 12)
- Access tokens expire in 15 minutes
- Failed login count triggers lockout at 5 attempts

---

#### 2. Profile Context (M2)

**Purpose**: Manage user profiles, media assets, and privacy settings.

**Core Domain Concepts**:
- `Profile`: Extended user information (bio, avatar, location)
- `Media`: Images and files with variants
- `Quota`: Storage limits per user
- `PrivacySetting`: Visibility controls

**Ubiquitous Language**:
| Term | Definition |
|------|------------|
| `Profile` | Public-facing user information |
| `Avatar` | Profile image with multiple variants |
| `MediaAsset` | Uploaded file with metadata |
| `Quota` | Storage allocation per user |

**Database Tables**: `user_profiles`, `media`, `user_quotas`, `security_incidents`

**Key Invariants**:
- Profile must be linked to exactly one Identity
- Media must pass magic bytes validation
- Users cannot exceed quota limits
- Avatar variants: thumbnail (100px), small (200px), medium (400px), large (800px)

---

#### 3. Content Context (M3 + M4)

**Purpose**: Manage posts, comments, feed generation, and user interactions.

**Core Domain Concepts**:
- `Publication` (Post): User-generated content with optional media
- `Discussion` (Comment): Threaded responses to publications
- `Reaction`: Engagement indicators (likes, etc.)
- `Mention`: User references in content
- `Feed`: Personalized content stream

**Ubiquitous Language**:
| Term | Definition |
|------|------------|
| `Publication` | A post created by a member |
| `Discussion` | A comment thread on a publication |
| `Thread` | Hierarchical comment structure (max depth: 3) |
| `Reaction` | User engagement on content |
| `Feed` | Personalized publication stream |

**Database Tables**: `posts`, `comments`, `comment_mentions`, `comment_reactions`, `post_media`

**Key Invariants**:
- Publications belong to exactly one author
- Discussions use materialized path for hierarchy
- Comment depth limited to 3 levels (0, 1, 2)
- Feed generation uses Redis caching (3-tier)

---

#### 4. Social Graph Context (M6)

**Purpose**: Manage social relationships between users.

**Core Domain Concepts**:
- `Connection`: Follow relationship between members
- `Block`: Bidirectional block enforcement
- `Suggestion`: AI-driven follow recommendations
- `PrivacyMode`: Public vs. private account handling

**Ubiquitous Language**:
| Term | Definition |
|------|------------|
| `Connection` | A follow relationship |
| `Follower` | Member who follows another |
| `Following` | Member being followed |
| `Block` | Bidirectional relationship block |
| `PendingRequest` | Follow request for private accounts |

**Database Tables**: `follows`, `blocks`, `follow_suggestions`

**Key Invariants**:
- Self-follow is prohibited
- Blocks are bidirectional (blocker sees no content from blocked)
- Follow requests require approval for private accounts
- Database triggers maintain follower/following counts

---

#### 5. Community Context (M5)

**Purpose**: Manage groups, memberships, and role-based access control.

**Core Domain Concepts**:
- `Group`: Community container with rules and settings
- `Membership`: Member's role within a group
- `Role`: Permission level (Owner, Moderator, Member)
- `Invitation`: Group join invitations
- `ModerationAction`: Content moderation decisions

**Ubiquitous Language**:
| Term | Definition |
|------|------------|
| `Group` | A community with members and rules |
| `Membership` | Member's association with a group |
| `Role` | Permission tier (Owner > Moderator > Member) |
| `Invitation` | Request to join a group |
| `ModerationLog` | Record of moderation actions |

**Database Tables**: `groups`, `group_members`, `membership_requests`, `group_invitations`, `moderation_logs`

**Key Invariants**:
- Each group has exactly one owner
- Role hierarchy: Owner > Moderator > Member
- Permissions are cached in Redis (<10ms lookup)
- Moderation actions require appropriate role

---

#### 6. Notification Context (M7)

**Purpose**: Manage alerts, preferences, and real-time delivery.

**Core Domain Concepts**:
- `Alert`: Notification message for a member
- `Preference`: Delivery channel settings
- `Channel`: Delivery method (in-app, email, push, WebSocket)
- `Room`: WebSocket subscription group

**Ubiquitous Language**:
| Term | Definition |
|------|------------|
| `Alert` | A notification for a member |
| `Preference` | User's notification settings |
| `Channel` | Delivery method (WebSocket, email, push) |
| `Room` | WebSocket subscription group |

**Database Tables**: `notifications` (partitioned), `notification_preferences`

**Key Invariants**:
- Notifications are partitioned by month
- WebSocket delivery is at-most-once
- Email/push delivery is at-least-once
- Room types: personal, group, post, direct_message, admin

---

#### 7. Admin Context (M8)

**Purpose**: System administration, security monitoring, and audit logging.

**Core Domain Concepts**:
- `Administrator`: Admin user with elevated privileges
- `TwoFactorAuth`: TOTP-based 2FA
- `AuditEntry`: Immutable action log
- `SecurityAlert`: Anomaly detection events
- `IPWhitelist`: Access control by IP

**Ubiquitous Language**:
| Term | Definition |
|------|------------|
| `Administrator` | User with admin privileges |
| `AuditEntry` | Immutable record of admin action |
| `SecurityAlert` | Detected security anomaly |
| `ReauthToken` | Short-lived token for sensitive actions |

**Database Tables**: `admin_users`, `admin_two_factor`, `admin_sessions`, `admin_ip_whitelist`, `audit_logs`, `security_alerts`

> **Note**: The `audit_logs` table is owned exclusively by the Admin Context. Other contexts emit audit events (ADR-009: `admin.audit_entry_created`) which are consumed by the Admin Context for persistence. This avoids shared table ownership across bounded contexts.

**Key Invariants**:
- 2FA is required for all admin users
- Audit logs are immutable and partitioned
- Re-authentication required for sensitive actions (5-minute TTL)
- IP whitelist cached in Redis (1-hour TTL)

---

### Context Relationships

| Upstream | Downstream | Relationship | Integration |
|----------|------------|--------------|-------------|
| Identity | Profile | Shared Kernel | UserId value object |
| Identity | Content | Customer-Supplier | User authentication |
| Identity | Social Graph | Customer-Supplier | User authentication |
| Identity | Community | Customer-Supplier | User authentication |
| Profile | Content | Customer-Supplier | Author information |
| Social Graph | Content | Conformist | Visibility filtering |
| Community | Notification | Anti-Corruption Layer | Event translation |
| All Contexts | Admin | Conformist | Audit logging |

### Shared Kernel

The following value objects are shared across multiple contexts:

```typescript
// src/domain/shared/value-objects/

export class UserId {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }
  static from(value: string): UserId;
  equals(other: UserId): boolean;
}

export class Email {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }
  static from(value: string): Email;
  get normalized(): string;
}

export class Timestamp {
  private constructor(private readonly _value: Date) {
    Object.freeze(this);
  }
  static now(): Timestamp;
  static from(date: Date): Timestamp;
}
```

#### Shared Kernel Constraints

The shared kernel MUST remain minimal. Adding new value objects to the shared kernel requires:
1. Justification that the concept is truly shared across 3+ contexts
2. Architecture team review
3. Update to this ADR

**Enforcement**: An architecture test verifies that `src/domain/shared/` contains ONLY the approved value objects:

```typescript
// tools/architecture-tests/shared-kernel.test.ts

describe('Shared Kernel', () => {
  it('contains only approved value objects', () => {
    const sharedExports = getExportsFrom('src/domain/shared/');
    const approved = ['UserId', 'Email', 'Timestamp', 'DomainEvent', 'AggregateRoot', 'ValueObject'];
    const unapproved = sharedExports.filter(e => !approved.includes(e));
    expect(unapproved).toHaveLength(0);
  });
});
```

## Consequences

### Positive

- **Clear Boundaries**: Each context has well-defined responsibilities
- **Independent Evolution**: Contexts can evolve at different rates
- **Team Alignment**: Teams can own specific contexts
- **Scalability Path**: Contexts can be extracted to microservices
- **Reduced Coupling**: Cross-context communication via events

### Negative

- **Duplication**: Some concepts appear in multiple contexts (by design)
- **Coordination**: Cross-context features require careful orchestration
- **Complexity**: More infrastructure for event publishing

### Mitigation

- **Duplication**: Accept intentional duplication; each context models concepts differently
- **Coordination**: Use sagas for cross-context workflows
- **Complexity**: Start with in-process events, evolve to message broker

## References

- M1 Authentication Architecture (docs/architecture/m1-auth-architecture.md)
- M2 Profiles Architecture (docs/architecture/m2-profiles-architecture.md)
- M4 Comments Architecture (docs/architecture/m4-comments-architecture.md)
- M5 Groups Architecture (docs/architecture/m5-groups-rbac-architecture.md)
- M6 Social Graph Architecture (docs/architecture/m6-social-graph-architecture.md)
- M7 Notifications Architecture (docs/architecture/m7-notifications-architecture.md)
- M8 Admin Security Architecture (docs/architecture/m8-admin-security-architecture.md)

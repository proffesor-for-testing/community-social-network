# M5 Groups & RBAC System - Architecture Design
## SPARC Phase 3: Architecture

**Document Version:** 1.0.0
**Created:** 2025-12-16
**Status:** 🏗️ ARCHITECTURE DRAFT
**Milestone:** M5 - Groups & Communities
**Phase:** SPARC Phase 3 (Architecture)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Architecture](#component-architecture)
4. [Database Architecture](#database-architecture)
5. [RBAC Architecture](#rbac-architecture)
6. [Caching Architecture](#caching-architecture)
7. [API Architecture](#api-architecture)
8. [Security Architecture](#security-architecture)
9. [Sequence Diagrams](#sequence-diagrams)
10. [Performance Considerations](#performance-considerations)
11. [Technology Stack](#technology-stack)

---

## System Overview

### Architecture Goals

1. **Sub-10ms Permission Checks**: Redis-backed caching for high performance
2. **3-Tier RBAC**: Owner > Moderator > Member hierarchy with inheritance
3. **Audit Compliance**: Complete logging of all moderation actions
4. **Privacy Enforcement**: Public, Private, Invite-only group types
5. **Horizontal Scalability**: Stateless services with shared cache

### Key Metrics

- **Target Latency**: <10ms for cached permission checks, <50ms for uncached
- **Target Scale**: 10,000+ groups, 1M+ memberships
- **Cache Hit Rate**: >95% for permission checks
- **Audit Retention**: 2 years for compliance

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Web App │  │ Mobile   │  │  Admin   │  │   API    │        │
│  │          │  │   App    │  │  Portal  │  │ Clients  │        │
│  └─────┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└────────┼────────────┼─────────────┼─────────────┼──────────────┘
         │            │             │             │
         └────────────┴─────────────┴─────────────┘
                           │
         ┌─────────────────▼─────────────────┐
         │       API Gateway (Kong)           │
         │  ┌──────────┐  ┌──────────┐       │
         │  │   Auth   │  │   Rate   │       │
         │  │  Filter  │  │  Limiter │       │
         │  └──────────┘  └──────────┘       │
         └─────────────────┬─────────────────┘
                           │
         ┌─────────────────▼─────────────────┐
         │      Application Services          │
         │                                    │
         │  ┌────────────┐  ┌────────────┐   │
         │  │   Groups   │  │    RBAC    │   │
         │  │  Service   │◄─┤  Service   │   │
         │  └──────┬─────┘  └──────┬─────┘   │
         │         │                │         │
         │  ┌──────▼─────┐  ┌──────▼─────┐   │
         │  │ Moderation │  │   Audit    │   │
         │  │  Service   │  │  Service   │   │
         │  └────────────┘  └────────────┘   │
         └─────────────────┬─────────────────┘
                           │
         ┌─────────────────▼─────────────────┐
         │         Data Layer                 │
         │                                    │
         │  ┌────────────┐  ┌────────────┐   │
         │  │ PostgreSQL │  │   Redis    │   │
         │  │  (Primary) │  │  (Cache)   │   │
         │  └────────────┘  └────────────┘   │
         │                                    │
         │  ┌────────────┐  ┌────────────┐   │
         │  │ PostgreSQL │  │ RabbitMQ   │   │
         │  │ (Replica)  │  │  (Queue)   │   │
         │  └────────────┘  └────────────┘   │
         └────────────────────────────────────┘
```

---

## Component Architecture

### Groups Service Component

```
┌─────────────────────────────────────────────────────────┐
│                    Groups Service                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │           Controllers Layer                   │      │
│  │  ┌────────┐  ┌────────┐  ┌─────────┐         │      │
│  │  │ Group  │  │Member  │  │ Moderation│       │      │
│  │  │ Ctrl   │  │ Ctrl   │  │  Ctrl    │        │      │
│  │  └───┬────┘  └───┬────┘  └────┬────┘         │      │
│  └──────┼───────────┼────────────┼──────────────┘      │
│         │           │            │                      │
│  ┌──────▼───────────▼────────────▼──────────────┐      │
│  │            Services Layer                     │      │
│  │  ┌────────┐  ┌────────┐  ┌──────────┐        │      │
│  │  │ Group  │  │Member  │  │Moderation│        │      │
│  │  │Service │  │Service │  │ Service  │        │      │
│  │  └───┬────┘  └───┬────┘  └────┬─────┘        │      │
│  └──────┼───────────┼────────────┼──────────────┘      │
│         │           │            │                      │
│         └───────────┴────────────┘                      │
│                     │                                   │
│  ┌──────────────────▼──────────────────────────┐       │
│  │            RBAC Service (Internal)           │       │
│  │  ┌────────────┐  ┌──────────┐              │       │
│  │  │Permission  │  │   Role   │              │       │
│  │  │  Checker   │  │ Manager  │              │       │
│  │  └──────┬─────┘  └─────┬────┘              │       │
│  └─────────┼──────────────┼───────────────────┘       │
│            │              │                            │
│  ┌─────────▼──────────────▼───────────────────┐       │
│  │         Repository Layer                    │       │
│  │  ┌────────┐  ┌────────┐  ┌──────────┐      │       │
│  │  │ Group  │  │Member  │  │Permission│      │       │
│  │  │  Repo  │  │  Repo  │  │   Repo   │      │       │
│  │  └───┬────┘  └───┬────┘  └────┬─────┘      │       │
│  └──────┼───────────┼────────────┼────────────┘       │
│         │           │            │                     │
│         └───────────┴────────────┘                     │
│                     │                                  │
│  ┌──────────────────▼──────────────────────────┐      │
│  │            Cache Layer (Redis)               │      │
│  │  ┌────────────┐  ┌──────────┐               │      │
│  │  │Permission  │  │  Group   │               │      │
│  │  │   Cache    │  │  Cache   │               │      │
│  │  └────────────┘  └──────────┘               │      │
│  └──────────────────────────────────────────────┘     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### RBAC Service Component

```
┌─────────────────────────────────────────────────────────┐
│                    RBAC Service                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │         Permission Check Engine               │      │
│  │                                               │      │
│  │  INPUT: (user_id, group_id, action)           │      │
│  │                                               │      │
│  │  ┌────────────────────────────────┐          │      │
│  │  │  1. Cache Lookup (Redis)       │          │      │
│  │  │     Key: "perm:{uid}:{gid}"    │          │      │
│  │  │     TTL: 300s                  │          │      │
│  │  └──────────┬─────────────────────┘          │      │
│  │             │                                 │      │
│  │    ┌────────▼──────────┐                     │      │
│  │    │  Cache Hit?       │                     │      │
│  │    └────┬──────────┬───┘                     │      │
│  │         │ YES      │ NO                      │      │
│  │         │          │                         │      │
│  │  ┌──────▼──┐  ┌───▼──────────────┐          │      │
│  │  │ Return  │  │ 2. DB Lookup      │          │      │
│  │  │Cached   │  │    - Get role     │          │      │
│  │  │ Perms   │  │    - Get status   │          │      │
│  │  └─────────┘  │    - Check expiry │          │      │
│  │               └────────┬───────────┘          │      │
│  │                        │                      │      │
│  │               ┌────────▼───────────┐          │      │
│  │               │ 3. Apply RBAC      │          │      │
│  │               │    - Owner L3      │          │      │
│  │               │    - Moderator L2  │          │      │
│  │               │    - Member L1     │          │      │
│  │               └────────┬───────────┘          │      │
│  │                        │                      │      │
│  │               ┌────────▼───────────┐          │      │
│  │               │ 4. Cache Result    │          │      │
│  │               │    (Write-through) │          │      │
│  │               └────────┬───────────┘          │      │
│  │                        │                      │      │
│  │               ┌────────▼───────────┐          │      │
│  │               │  OUTPUT: Boolean   │          │      │
│  │               └────────────────────┘          │      │
│  └──────────────────────────────────────────────┘      │
│                                                         │
│  ┌──────────────────────────────────────────────┐      │
│  │         Permission Matrix                     │      │
│  │                                               │      │
│  │  Owner (Level 3) - ALL permissions:           │      │
│  │    ✓ delete_group, archive_group             │      │
│  │    ✓ assign_moderator, revoke_moderator      │      │
│  │    ✓ All Moderator permissions                │      │
│  │    ✓ All Member permissions                   │      │
│  │                                               │      │
│  │  Moderator (Level 2):                         │      │
│  │    ✓ remove_member, ban_member, mute_member   │      │
│  │    ✓ delete_post, delete_comment              │      │
│  │    ✓ approve_post, reject_post                │      │
│  │    ✓ approve_member, reject_request           │      │
│  │    ✓ All Member permissions                   │      │
│  │                                               │      │
│  │  Member (Level 1):                            │      │
│  │    ✓ create_post, edit_own_post               │      │
│  │    ✓ create_comment, edit_own_comment         │      │
│  │    ✓ leave_group                              │      │
│  │    ✓ view_group (if allowed)                  │      │
│  └──────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

## Database Architecture

### Entity Relationship Diagram (ERD)

```
┌──────────────────────────┐
│        users             │
│ (from auth service)      │
└───────────┬──────────────┘
            │
            │ 1:N (owner)
            │
┌───────────▼──────────────┐
│        groups            │
├──────────────────────────┤
│ PK  id (UUID)            │
│     name (unique)        │
│     description          │
│     privacy (enum)       │◄─────┐
│     status (enum)        │      │
│ FK  owner_id             │      │
│     require_approval     │      │
│     member_count         │      │ 1:N
│     created_at           │      │
└───────────┬──────────────┘      │
            │                     │
            │ 1:N                 │
            │                     │
┌───────────▼──────────────┐      │
│    group_members         │      │
├──────────────────────────┤      │
│ PK  id (UUID)            │      │
│ FK  group_id             │──────┘
│ FK  user_id              │
│     role (enum)          │
│     status (enum)        │
│     muted_until          │
│     banned_until         │
│     joined_at            │
└───────────┬──────────────┘
            │
            │ 1:N
            │
┌───────────▼──────────────┐       ┌──────────────────────────┐
│   moderation_logs        │       │  membership_requests     │
├──────────────────────────┤       ├──────────────────────────┤
│ PK  id (UUID)            │       │ PK  id (UUID)            │
│ FK  group_id             │       │ FK  group_id             │
│ FK  moderator_id         │       │ FK  user_id              │
│     action (enum)        │       │     status (enum)        │
│     target_user_id       │       │     answers (JSONB)      │
│     target_resource_id   │       │     reviewed_by          │
│     reason               │       │     reviewed_at          │
│     additional_data      │       │     expires_at           │
│     created_at           │       └──────────────────────────┘
└──────────────────────────┘
                                   ┌──────────────────────────┐
                                   │   group_invitations      │
                                   ├──────────────────────────┤
                                   │ PK  id (UUID)            │
                                   │ FK  group_id             │
                                   │ FK  inviter_id           │
                                   │ FK  invitee_id (null)    │
                                   │     invitee_email        │
                                   │     status (enum)        │
                                   │     expires_at           │
                                   └──────────────────────────┘
```

### Database Schema (PostgreSQL)

```sql
-- ============================================================
-- GROUPS TABLE
-- ============================================================
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT CHECK (char_length(description) <= 5000),
    privacy VARCHAR(20) NOT NULL CHECK (privacy IN ('public', 'private', 'invite_only')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    owner_id UUID NOT NULL REFERENCES users(id),
    require_post_approval BOOLEAN DEFAULT FALSE,
    require_member_approval BOOLEAN DEFAULT FALSE,
    member_count INTEGER DEFAULT 0 CHECK (member_count >= 0),
    post_count INTEGER DEFAULT 0 CHECK (post_count >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    archived_at TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_archived_state CHECK (
        (status = 'archived' AND archived_at IS NOT NULL) OR
        (status != 'archived' AND archived_at IS NULL)
    ),
    CONSTRAINT valid_deleted_state CHECK (
        (status = 'deleted' AND deleted_at IS NOT NULL) OR
        (status != 'deleted' AND deleted_at IS NULL)
    )
);

-- Indexes for performance
CREATE INDEX idx_groups_owner ON groups(owner_id);
CREATE INDEX idx_groups_privacy_status ON groups(privacy, status);
CREATE INDEX idx_groups_created_at ON groups(created_at DESC);
CREATE INDEX idx_groups_name ON groups(name) WHERE status = 'active';

-- ============================================================
-- GROUP_MEMBERS TABLE
-- ============================================================
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'moderator', 'member')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'muted', 'banned')),
    muted_until TIMESTAMP,
    mute_reason TEXT,
    banned_until TIMESTAMP,
    ban_reason TEXT,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_group_user UNIQUE (group_id, user_id),
    CONSTRAINT valid_mute_state CHECK (
        (status = 'muted' AND muted_until IS NOT NULL AND mute_reason IS NOT NULL) OR
        (status != 'muted' AND muted_until IS NULL)
    ),
    CONSTRAINT valid_ban_state CHECK (
        (status = 'banned' AND ban_reason IS NOT NULL) OR
        (status != 'banned' AND ban_reason IS NULL)
    )
);

-- Indexes for fast lookups
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_group_role ON group_members(group_id, role);
CREATE INDEX idx_group_members_status ON group_members(status) WHERE status != 'active';

-- ============================================================
-- MEMBERSHIP_REQUESTS TABLE
-- ============================================================
CREATE TABLE membership_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    answers JSONB,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),

    -- Constraints
    CONSTRAINT valid_reviewed_state CHECK (
        (status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL) OR
        (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    )
);

-- Partial unique index for pending requests
CREATE UNIQUE INDEX idx_membership_requests_unique_pending
    ON membership_requests(group_id, user_id)
    WHERE status = 'pending';

CREATE INDEX idx_membership_requests_group_status ON membership_requests(group_id, status);
CREATE INDEX idx_membership_requests_user ON membership_requests(user_id);
CREATE INDEX idx_membership_requests_expires ON membership_requests(expires_at) WHERE status = 'pending';

-- ============================================================
-- GROUP_INVITATIONS TABLE
-- ============================================================
CREATE TABLE group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES users(id),
    invitee_id UUID REFERENCES users(id),
    invitee_email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),

    -- Constraints
    CONSTRAINT has_invitee CHECK (invitee_id IS NOT NULL OR invitee_email IS NOT NULL)
);

CREATE INDEX idx_group_invitations_group_status ON group_invitations(group_id, status);
CREATE INDEX idx_group_invitations_invitee ON group_invitations(invitee_id, status);
CREATE INDEX idx_group_invitations_email ON group_invitations(invitee_email, status);
CREATE INDEX idx_group_invitations_expires ON group_invitations(expires_at) WHERE status = 'pending';

-- ============================================================
-- MODERATION_LOGS TABLE (Partitioned by month)
-- ============================================================
CREATE TABLE moderation_logs (
    id UUID DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id),
    moderator_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'member_removed', 'member_banned', 'member_muted',
        'post_deleted', 'comment_deleted',
        'post_approved', 'post_rejected',
        'role_assigned', 'role_revoked'
    )),
    target_user_id UUID REFERENCES users(id),
    target_resource_id UUID,
    reason TEXT NOT NULL,
    additional_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for current and next 3 months
CREATE TABLE moderation_logs_2025_12 PARTITION OF moderation_logs
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE moderation_logs_2026_01 PARTITION OF moderation_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Indexes on partitioned table
CREATE INDEX idx_moderation_logs_group ON moderation_logs(group_id, created_at DESC);
CREATE INDEX idx_moderation_logs_moderator ON moderation_logs(moderator_id, created_at DESC);
CREATE INDEX idx_moderation_logs_target ON moderation_logs(target_user_id);
CREATE INDEX idx_moderation_logs_action ON moderation_logs(action);
```

### Database Triggers for Denormalization

```sql
-- ============================================================
-- TRIGGER: Update member_count on group_members changes
-- ============================================================
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE groups
        SET member_count = member_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.group_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE groups
        SET member_count = member_count - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.group_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_member_count
    AFTER INSERT OR DELETE ON group_members
    FOR EACH ROW EXECUTE FUNCTION update_group_member_count();

-- ============================================================
-- TRIGGER: Auto-expire pending requests
-- ============================================================
CREATE OR REPLACE FUNCTION expire_membership_requests()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE membership_requests
    SET status = 'expired'
    WHERE expires_at < CURRENT_TIMESTAMP
      AND status = 'pending';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Schedule via pg_cron or application cron job
```

---

## RBAC Architecture

### Role Hierarchy Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    RBAC HIERARCHY                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│     ┌─────────────────────────────────────────┐            │
│     │  OWNER (Level 3)                         │            │
│     │  ┌─────────────────────────────────┐    │            │
│     │  │ • delete_group                   │    │            │
│     │  │ • archive_group                  │    │            │
│     │  │ • transfer_ownership             │    │            │
│     │  │ • assign_moderator               │    │            │
│     │  │ • revoke_moderator               │    │            │
│     │  └─────────────────────────────────┘    │            │
│     │            +                             │            │
│     │  ALL MODERATOR PERMISSIONS               │            │
│     └─────────────────┬───────────────────────┘            │
│                       │ inherits all from                   │
│     ┌─────────────────▼───────────────────────┐            │
│     │  MODERATOR (Level 2)                     │            │
│     │  ┌─────────────────────────────────┐    │            │
│     │  │ • remove_member                  │    │            │
│     │  │ • ban_member                     │    │            │
│     │  │ • mute_member                    │    │            │
│     │  │ • delete_post (any)              │    │            │
│     │  │ • delete_comment (any)           │    │            │
│     │  │ • approve_post                   │    │            │
│     │  │ • reject_post                    │    │            │
│     │  │ • approve_member                 │    │            │
│     │  │ • reject_request                 │    │            │
│     │  └─────────────────────────────────┘    │            │
│     │            +                             │            │
│     │  ALL MEMBER PERMISSIONS                  │            │
│     └─────────────────┬───────────────────────┘            │
│                       │ inherits all from                   │
│     ┌─────────────────▼───────────────────────┐            │
│     │  MEMBER (Level 1)                        │            │
│     │  ┌─────────────────────────────────┐    │            │
│     │  │ • create_post                    │    │            │
│     │  │ • edit_own_post                  │    │            │
│     │  │ • delete_own_post                │    │            │
│     │  │ • create_comment                 │    │            │
│     │  │ • edit_own_comment               │    │            │
│     │  │ • delete_own_comment             │    │            │
│     │  │ • leave_group                    │    │            │
│     │  │ • view_group (if allowed)        │    │            │
│     │  └─────────────────────────────────┘    │            │
│     └──────────────────────────────────────────┘            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Permission Matrix Implementation

```typescript
// TypeScript representation of permission matrix
export const PERMISSION_MATRIX = {
  member: [
    'create_post',
    'edit_own_post',
    'delete_own_post',
    'create_comment',
    'edit_own_comment',
    'delete_own_comment',
    'leave_group',
    'view_group',
    'view_members',
    'invite_members', // if allowed
  ],
  moderator: [
    // Inherits all member permissions
    ...PERMISSION_MATRIX.member,
    // Additional moderator permissions
    'remove_member',
    'ban_member',
    'mute_member',
    'delete_post',
    'delete_comment',
    'approve_post',
    'reject_post',
    'approve_member',
    'reject_request',
    'view_reports',
    'view_moderation_logs',
  ],
  owner: [
    // Inherits all moderator permissions
    ...PERMISSION_MATRIX.moderator,
    // Additional owner permissions
    'delete_group',
    'archive_group',
    'update_group',
    'transfer_ownership',
    'assign_moderator',
    'revoke_moderator',
    'update_settings',
  ],
} as const;

export type Role = 'member' | 'moderator' | 'owner';
export type Permission = typeof PERMISSION_MATRIX[Role][number];
```

---

## Caching Architecture

### Redis Cache Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                   Redis Caching Layer                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Cache Key Patterns:                                         │
│  ─────────────────                                           │
│                                                              │
│  1. Permission Cache (Hot Path)                              │
│     Key: "perm:{user_id}:{group_id}"                         │
│     Value: {                                                 │
│       "role": "moderator",                                   │
│       "permissions": ["create_post", "delete_post", ...],    │
│       "status": "active",                                    │
│       "cached_at": 1734364800                                │
│     }                                                        │
│     TTL: 300 seconds (5 minutes)                             │
│                                                              │
│  2. Group Cache                                              │
│     Key: "group:{group_id}"                                  │
│     Value: { ...group_data }                                 │
│     TTL: 600 seconds (10 minutes)                            │
│                                                              │
│  3. Member Count Cache                                       │
│     Key: "group:{group_id}:members:count"                    │
│     Value: 1234                                              │
│     TTL: 300 seconds (5 minutes)                             │
│                                                              │
│  4. User's Groups List                                       │
│     Key: "user:{user_id}:groups"                             │
│     Value: [group_id1, group_id2, ...]                       │
│     TTL: 300 seconds (5 minutes)                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Cache Invalidation Patterns                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Event: Member Role Changed                                  │
│  ├─ Invalidate: "perm:{user_id}:{group_id}"                  │
│  └─ Invalidate: "group:{group_id}:members:*"                 │
│                                                              │
│  Event: Member Banned/Muted                                  │
│  ├─ Invalidate: "perm:{user_id}:{group_id}"                  │
│  └─ Update: "group:{group_id}:members:count"                 │
│                                                              │
│  Event: Member Joined/Left                                   │
│  ├─ Invalidate: "perm:{user_id}:{group_id}"                  │
│  ├─ Invalidate: "user:{user_id}:groups"                      │
│  └─ Update: "group:{group_id}:members:count"                 │
│                                                              │
│  Event: Group Settings Changed                               │
│  ├─ Invalidate: "group:{group_id}"                           │
│  └─ Invalidate: "group:{group_id}:*"                         │
│                                                              │
│  Event: Group Deleted/Archived                               │
│  └─ Delete All: "group:{group_id}:*"                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Cache-Aside Pattern Implementation

```typescript
// Cache-aside pattern for permission checks
async function checkPermission(
  userId: string,
  groupId: string,
  action: string
): Promise<boolean> {
  const cacheKey = `perm:${userId}:${groupId}`;

  // 1. Try cache first (fast path)
  const cached = await redis.get(cacheKey);
  if (cached) {
    const data = JSON.parse(cached);
    return data.permissions.includes(action);
  }

  // 2. Cache miss - query database
  const membership = await db.query(
    'SELECT role, status FROM group_members WHERE user_id = $1 AND group_id = $2',
    [userId, groupId]
  );

  if (!membership || membership.status !== 'active') {
    return false;
  }

  // 3. Get permissions for role
  const permissions = PERMISSION_MATRIX[membership.role];

  // 4. Cache the result (write-through)
  await redis.setex(
    cacheKey,
    300, // 5 minutes TTL
    JSON.stringify({
      role: membership.role,
      permissions,
      status: membership.status,
      cached_at: Date.now(),
    })
  );

  // 5. Return decision
  return permissions.includes(action);
}
```

---

## API Architecture

### REST API Endpoints

```yaml
openapi: 3.0.0
info:
  title: Groups & RBAC API
  version: 1.0.0
  description: Community Groups with Role-Based Access Control

servers:
  - url: https://api.example.com/v1
    description: Production

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Group:
      type: object
      required: [id, name, privacy, owner_id]
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
          minLength: 3
          maxLength: 255
        description:
          type: string
          maxLength: 5000
        privacy:
          type: string
          enum: [public, private, invite_only]
        status:
          type: string
          enum: [active, archived, deleted]
        owner_id:
          type: string
          format: uuid
        member_count:
          type: integer
        post_count:
          type: integer
        created_at:
          type: string
          format: date-time

    GroupMember:
      type: object
      properties:
        id:
          type: string
          format: uuid
        user_id:
          type: string
          format: uuid
        role:
          type: string
          enum: [owner, moderator, member]
        status:
          type: string
          enum: [active, muted, banned]
        joined_at:
          type: string
          format: date-time

    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object

paths:
  /groups:
    post:
      summary: Create a new group
      tags: [Groups]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, privacy]
              properties:
                name:
                  type: string
                description:
                  type: string
                privacy:
                  type: string
                  enum: [public, private, invite_only]
      responses:
        201:
          description: Group created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Group'
        400:
          description: Invalid request
        409:
          description: Group name already exists

    get:
      summary: List groups
      tags: [Groups]
      parameters:
        - name: privacy
          in: query
          schema:
            type: string
            enum: [public, private, invite_only]
        - name: page
          in: query
          schema:
            type: integer
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        200:
          description: List of groups
          content:
            application/json:
              schema:
                type: object
                properties:
                  groups:
                    type: array
                    items:
                      $ref: '#/components/schemas/Group'
                  total:
                    type: integer
                  page:
                    type: integer

  /groups/{groupId}:
    get:
      summary: Get group details
      tags: [Groups]
      parameters:
        - name: groupId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        200:
          description: Group details
        404:
          description: Group not found

    patch:
      summary: Update group (Owner only)
      tags: [Groups]
      security:
        - bearerAuth: []
      parameters:
        - name: groupId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                description:
                  type: string
                privacy:
                  type: string
      responses:
        200:
          description: Group updated
        403:
          description: Insufficient permissions

    delete:
      summary: Delete group (Owner only)
      tags: [Groups]
      security:
        - bearerAuth: []
      parameters:
        - name: groupId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        204:
          description: Group deleted
        403:
          description: Insufficient permissions

  /groups/{groupId}/members:
    get:
      summary: List group members
      tags: [Members]
      parameters:
        - name: groupId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: role
          in: query
          schema:
            type: string
            enum: [owner, moderator, member]
      responses:
        200:
          description: List of members

    post:
      summary: Join group or request membership
      tags: [Members]
      security:
        - bearerAuth: []
      parameters:
        - name: groupId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        201:
          description: Joined or request created
        409:
          description: Already a member

  /groups/{groupId}/members/{userId}:
    delete:
      summary: Remove member or leave group
      tags: [Members]
      security:
        - bearerAuth: []
      parameters:
        - name: groupId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        204:
          description: Member removed
        403:
          description: Insufficient permissions

  /groups/{groupId}/members/{userId}/role:
    patch:
      summary: Assign or revoke moderator role (Owner only)
      tags: [RBAC]
      security:
        - bearerAuth: []
      parameters:
        - name: groupId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [role]
              properties:
                role:
                  type: string
                  enum: [moderator, member]
      responses:
        200:
          description: Role updated
        403:
          description: Insufficient permissions

  /groups/{groupId}/members/{userId}/ban:
    post:
      summary: Ban member (Moderator+)
      tags: [Moderation]
      security:
        - bearerAuth: []
      parameters:
        - name: groupId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [reason]
              properties:
                reason:
                  type: string
                duration:
                  type: integer
                  description: Duration in hours (null = permanent)
      responses:
        200:
          description: Member banned
        403:
          description: Insufficient permissions

  /groups/{groupId}/moderation-logs:
    get:
      summary: View moderation logs (Moderator+)
      tags: [Moderation]
      security:
        - bearerAuth: []
      parameters:
        - name: groupId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        200:
          description: Moderation logs
        403:
          description: Insufficient permissions
```

---

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                   Security Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: API Gateway                                        │
│  ├─ TLS 1.3 Termination                                      │
│  ├─ Rate Limiting (100 req/min per user)                     │
│  ├─ DDoS Protection                                          │
│  └─ JWT Validation                                           │
│                                                              │
│  Layer 2: Application Authentication                         │
│  ├─ JWT Token Validation                                     │
│  ├─ User Status Check (active/suspended)                     │
│  └─ Session Management                                       │
│                                                              │
│  Layer 3: RBAC Authorization                                 │
│  ├─ Permission Check (cached)                                │
│  ├─ Role Hierarchy Enforcement                               │
│  ├─ Resource Ownership Validation                            │
│  └─ Status Check (muted/banned)                              │
│                                                              │
│  Layer 4: Data Privacy                                       │
│  ├─ Privacy Setting Enforcement                              │
│  │  • Public: Anyone can view                                │
│  │  • Private: Members only                                  │
│  │  • Invite-only: No discovery                              │
│  ├─ Field-level Authorization                                │
│  └─ PII Protection                                           │
│                                                              │
│  Layer 5: Audit & Compliance                                 │
│  ├─ All moderation actions logged                            │
│  ├─ Failed permission checks logged                          │
│  ├─ 2-year retention for compliance                          │
│  └─ GDPR right-to-forget support                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Privacy Enforcement

```typescript
// Privacy enforcement logic
async function canViewGroup(
  userId: string | null,
  group: Group
): Promise<boolean> {
  // Public groups: anyone can view
  if (group.privacy === 'public') {
    return true;
  }

  // Private/Invite-only: must be authenticated
  if (!userId) {
    return false;
  }

  // Check membership
  const membership = await checkMembership(userId, group.id);
  if (membership && membership.status === 'active') {
    return true;
  }

  // Invite-only: only members can view
  if (group.privacy === 'invite_only') {
    return false;
  }

  // Private: authenticated users can view metadata
  // but not content (posts/members)
  return group.privacy === 'private';
}
```

---

## Sequence Diagrams

### 1. Create Group Flow

```
User          API           Groups       RBAC          DB         Cache
 │             │            Service     Service        │           │
 │──POST───────┤             │            │            │           │
 │/groups      │             │            │            │           │
 │             │──validate───▶            │            │           │
 │             │             │            │            │           │
 │             │             │──INSERT────┤            │           │
 │             │             │   group    ▼            │           │
 │             │             │          [groups]       │           │
 │             │             │            │            │           │
 │             │             │──INSERT────┤            │           │
 │             │             │  owner     ▼            │           │
 │             │             │      [group_members]    │           │
 │             │             │            │            │           │
 │             │             │───────grant perms───────▶           │
 │             │             │            │            │           │
 │             │             │            │──SETEX─────▶           │
 │             │             │            │ perm:uid:gid           │
 │             │             │            │            │           │
 │             │◀────────────┘            │            │           │
 │◀────201─────┤                          │            │           │
 │  {group}    │                          │            │           │
```

### 2. Join Group Flow (Public)

```
User          API           Groups       RBAC          DB         Cache
 │             │            Service     Service        │           │
 │──POST───────┤             │            │            │           │
 │/groups/:id/ │             │            │            │           │
 │  members    │             │            │            │           │
 │             │──validate───▶            │            │           │
 │             │             │            │            │           │
 │             │             │──check─────▶            │           │
 │             │             │  privacy   │            │           │
 │             │             │            │            │           │
 │             │             │──INSERT────┤            │           │
 │             │             │  member    ▼            │           │
 │             │             │      [group_members]    │           │
 │             │             │            │            │           │
 │             │             │──UPDATE────┤            │           │
 │             │             │ +member_   ▼            │           │
 │             │             │  count  [groups]        │           │
 │             │             │            │            │           │
 │             │             │───────grant perms───────▶           │
 │             │             │            │            │           │
 │             │             │            │──SETEX─────▶           │
 │             │             │            │ perm:uid:gid           │
 │             │             │            │            │           │
 │             │             │──DEL───────┤            │           │
 │             │             │  user:id:  ▼            │           │
 │             │             │   groups [Redis]        │           │
 │             │             │            │            │           │
 │             │◀────────────┘            │            │           │
 │◀────201─────┤                          │            │           │
 │ {membership}│                          │            │           │
```

### 3. Permission Check Flow (Cached)

```
User          API         Middleware    RBAC         Cache        DB
 │             │             │         Service        │           │
 │──DELETE─────┤             │            │           │           │
 │/groups/:id/ │             │            │           │           │
 │  posts/:pid │             │            │           │           │
 │             │──check──────▶            │           │           │
 │             │  auth       │            │           │           │
 │             │             │            │           │           │
 │             │             │──checkPerm─▶           │           │
 │             │             │ (uid,gid,  │           │           │
 │             │             │"delete_post")          │           │
 │             │             │            │           │           │
 │             │             │            │──GET──────▶           │
 │             │             │            │perm:uid:gid           │
 │             │             │            │           │           │
 │             │             │            │◀─FOUND────┘           │
 │             │             │            │  {role:               │
 │             │             │            │   "moderator"}        │
 │             │             │            │           │           │
 │             │             │            │──check────│           │
 │             │             │            │  matrix   │           │
 │             │             │            │           │           │
 │             │             │◀──ALLOWED──┘           │           │
 │             │             │            │           │           │
 │             │◀──proceed───┘            │           │           │
 │             │             │            │           │           │
 │             │──execute────▶            │           │           │
 │             │  delete     │            │           │           │
 │◀────204─────┘             │            │           │           │
```

### 4. Assign Moderator Role Flow

```
Owner         API           Groups      RBAC         DB         Cache
 │             │            Service    Service       │           │
 │──PATCH──────┤             │           │           │           │
 │/groups/:id/ │             │           │           │           │
 │ members/:uid│             │           │           │           │
 │   /role     │             │           │           │           │
 │             │──checkPerm──▶           │           │           │
 │             │"assign_mod" │           │           │           │
 │             │             │           │           │           │
 │             │             │───────────▶           │           │
 │             │             │  check    │           │           │
 │             │             │ is_owner  │           │           │
 │             │             │           │           │           │
 │             │             │──UPDATE───┤           │           │
 │             │             │  role=    ▼           │           │
 │             │             │'moderator'[members]   │           │
 │             │             │           │           │           │
 │             │             │──INSERT───┤           │           │
 │             │             │  audit    ▼           │           │
 │             │             │    [moderation_logs]  │           │
 │             │             │           │           │           │
 │             │             │───────invalidate──────▶           │
 │             │             │           │  perm:    │           │
 │             │             │           │ uid:gid   │           │
 │             │             │           │           │           │
 │             │◀────────────┘           │           │           │
 │◀────200─────┤                         │           │           │
 │{membership} │                         │           │           │
```

### 5. Ban Member Flow

```
Moderator     API           Groups    Moderation    DB         Cache
 │             │            Service    Service      │           │
 │──POST───────┤             │           │          │           │
 │/groups/:id/ │             │           │          │           │
 │ members/:uid│             │           │          │           │
 │   /ban      │             │           │          │           │
 │{reason,dur} │             │           │          │           │
 │             │──checkPerm──▶           │          │           │
 │             │"ban_member" │           │          │           │
 │             │             │           │          │           │
 │             │             │──validate─▶          │           │
 │             │             │  (cannot  │          │           │
 │             │             │   ban mod)│          │           │
 │             │             │           │          │           │
 │             │             │           │──UPDATE──┤           │
 │             │             │           │ status=  ▼           │
 │             │             │           │'banned',[members]    │
 │             │             │           │ reason,  │           │
 │             │             │           │banned_until          │
 │             │             │           │          │           │
 │             │             │           │──INSERT──┤           │
 │             │             │           │  audit   ▼           │
 │             │             │           │  [moderation_logs]   │
 │             │             │           │          │           │
 │             │             │───────────invalidate─▶           │
 │             │             │           │   perm:  │           │
 │             │             │           │  uid:gid │           │
 │             │             │           │          │           │
 │             │             │───────────publish────▶           │
 │             │             │           │  event   │           │
 │             │             │           │'member.  │           │
 │             │             │           │  banned' │           │
 │             │             │           │          │           │
 │             │◀────────────┘           │          │           │
 │◀────200─────┤                         │          │           │
 │ {success}   │                         │          │           │
```

---

## Performance Considerations

### Optimization Strategies

1. **Permission Check Optimization**
   - Redis cache with 5-minute TTL
   - Target: <10ms for cached checks
   - Batch permission checks for lists
   - Preload common permission sets

2. **Database Query Optimization**
   - Indexed all foreign keys
   - Composite indexes for common queries
   - Denormalized member_count for fast reads
   - Partitioned moderation_logs by month

3. **API Response Optimization**
   - Pagination for all list endpoints
   - Field selection (GraphQL-style)
   - ETag caching for group metadata
   - CDN caching for public groups

4. **Scalability Patterns**
   - Stateless services (horizontal scaling)
   - Read replicas for PostgreSQL
   - Redis Cluster for cache layer
   - Message queue for async operations

### Performance Targets

| Operation | Target Latency | Strategy |
|-----------|----------------|----------|
| Permission check (cached) | <10ms | Redis lookup |
| Permission check (uncached) | <50ms | DB query + cache write |
| Create group | <100ms | Single transaction |
| Join group (public) | <100ms | Insert + counter update |
| List members | <200ms | Indexed query + pagination |
| Ban member | <150ms | Update + audit log + cache invalidation |

---

## Technology Stack

### Backend Services

```yaml
runtime:
  language: TypeScript
  runtime: Node.js 20 LTS
  framework: NestJS 10.x

database:
  primary: PostgreSQL 16
  features:
    - Partitioning (moderation_logs)
    - JSONB support (additional_data)
    - Full-text search (group names/descriptions)
  replication: Primary + 2 read replicas

cache:
  engine: Redis 7.x
  topology: Cluster (3 masters + 3 replicas)
  features:
    - Cache-aside pattern
    - Pub/Sub for cache invalidation
    - TTL-based expiration

message_queue:
  engine: RabbitMQ 3.x
  usage:
    - Async notification sending
    - Audit log processing
    - Analytics events

api_gateway:
  engine: Kong 3.x
  features:
    - JWT validation
    - Rate limiting
    - Request logging
    - CORS handling
```

### Infrastructure

```yaml
deployment:
  platform: Kubernetes
  orchestration: Helm charts

services:
  groups_service:
    replicas: 3-10 (autoscaling)
    resources:
      requests: {cpu: 250m, memory: 512Mi}
      limits: {cpu: 1000m, memory: 1Gi}

  redis_cluster:
    replicas: 6 (3 masters + 3 replicas)
    persistence: AOF + RDB snapshots

  postgresql:
    replicas: 3 (1 primary + 2 read replicas)
    storage: 500GB SSD
    backup: Daily snapshots (30-day retention)

monitoring:
  metrics: Prometheus + Grafana
  logging: ELK Stack (Elasticsearch, Logstash, Kibana)
  tracing: Jaeger
  alerting: PagerDuty

security:
  tls: TLS 1.3 (API Gateway)
  secrets: Kubernetes Secrets + HashiCorp Vault
  network: Network policies (pod isolation)
  scanning: Trivy (container scanning)
```

---

## Architecture Decision Records (ADRs)

### ADR-001: Redis for Permission Caching

**Decision:** Use Redis for permission caching with 5-minute TTL

**Rationale:**
- Sub-10ms latency requirement
- High read-to-write ratio (95%+ reads)
- Acceptable staleness window (5 minutes)
- Horizontal scalability via clustering

**Alternatives Considered:**
- In-memory cache (rejected: no shared state)
- Database query cache (rejected: too slow)
- Longer TTL (rejected: security concerns)

### ADR-002: 3-Tier Role Hierarchy

**Decision:** Implement Owner > Moderator > Member hierarchy with inheritance

**Rationale:**
- Matches common community patterns
- Simplifies permission checks
- Clear escalation path
- Reduces permission matrix complexity

**Alternatives Considered:**
- Flat permissions (rejected: too complex)
- 4+ tiers (rejected: unnecessary complexity)
- Dynamic roles (rejected: phase 2 feature)

### ADR-003: Partitioned Moderation Logs

**Decision:** Partition moderation_logs by month using range partitioning

**Rationale:**
- 2-year retention requirement
- High write volume expected
- Query patterns are time-based
- Easier archival/deletion

**Alternatives Considered:**
- Single table (rejected: performance degradation)
- Separate audit database (rejected: added complexity)
- Hash partitioning (rejected: doesn't match query patterns)

---

## Next Steps (SPARC Phase 4: Refinement)

1. **Test-Driven Development**
   - Write 60+ permission tests
   - Integration tests for all flows
   - Load tests for caching layer
   - Security penetration tests

2. **Implementation**
   - Groups service core
   - RBAC service with caching
   - Moderation service
   - Audit logging

3. **Documentation**
   - API documentation (OpenAPI)
   - Deployment runbooks
   - Monitoring dashboards
   - Incident response procedures

---

**Architecture Status:** ✅ DRAFT COMPLETE
**Ready for:** SPARC Phase 4 (Refinement - TDD)
**Estimated Implementation:** 4-6 sprints

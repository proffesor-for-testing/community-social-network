# M6 Social Graph & Follow System - Architecture

**Project**: Community Social Network MVP
**Milestone**: M6 - Social Features
**Phase**: SPARC Phase 3 - Architecture
**Version**: 1.0.0
**Date**: 2025-12-16
**Status**: ARCHITECTURE DRAFT

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Component Architecture](#2-component-architecture)
3. [Database Architecture](#3-database-architecture)
4. [API Architecture](#4-api-architecture)
5. [Privacy & Security Architecture](#5-privacy--security-architecture)
6. [Performance Architecture](#6-performance-architecture)
7. [Integration Architecture](#7-integration-architecture)
8. [Deployment Architecture](#8-deployment-architecture)

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Web App     │  │  Mobile App  │  │  API Client  │          │
│  │  (React)     │  │  (iOS/Andr)  │  │  (External)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS/REST + WebSocket
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      API Gateway Layer                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Kong/Nginx - Rate Limiting, Auth, Load Balancing       │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼─────────┐  ┌──────▼──────┐  ┌─────────▼────────┐
│  Social Graph   │  │   User      │  │  Notification    │
│  Service        │  │   Service   │  │  Service         │
│                 │  │             │  │                  │
│ - Follows       │  │ - Profiles  │  │ - Follow Events  │
│ - Blocks        │  │ - Privacy   │  │ - Requests       │
│ - Suggestions   │  │ - Settings  │  │ - WebSocket      │
│ - Feed Ranking  │  │             │  │                  │
└───────┬─────────┘  └──────┬──────┘  └─────────┬────────┘
        │                   │                    │
        │                   │                    │
┌───────▼───────────────────▼────────────────────▼────────┐
│                  Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ PostgreSQL   │  │ Redis Cache  │  │  RabbitMQ    │  │
│  │              │  │              │  │              │  │
│  │ - follows    │  │ - Counters   │  │ - Events     │  │
│  │ - blocks     │  │ - Sessions   │  │ - Jobs       │  │
│  │ - profiles   │  │ - Feed cache │  │ - Async ops  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Graph Database Decision: PostgreSQL vs Neo4j

**Selected: PostgreSQL with Graph Extensions**

#### Trade-off Analysis

| Aspect | PostgreSQL | Neo4j | Decision Rationale |
|--------|-----------|-------|-------------------|
| **Graph Traversal** | Good (with recursive CTEs) | Excellent | For MVP scale (<1M users), PostgreSQL sufficient |
| **Query Complexity** | Higher complexity for deep traversals | Native graph queries | Most queries are 1-2 hops (followers, mutual friends) |
| **Existing Infrastructure** | Already in use | New dependency | Reduces operational complexity |
| **Consistency** | ACID guarantees | ACID guarantees | Both adequate |
| **Scaling** | Vertical + read replicas | Horizontal sharding | Vertical scaling sufficient for MVP |
| **Development Speed** | Team expertise | Learning curve | Faster development with PostgreSQL |
| **Cost** | Lower (existing) | Higher (new service) | Budget conscious for MVP |

#### PostgreSQL Graph Query Strategy

```sql
-- Efficient 2-hop traversal for friend suggestions
-- Uses recursive CTE with depth limiting
WITH RECURSIVE friend_network AS (
    -- Base: Direct followers
    SELECT following_id as user_id, 1 as depth
    FROM follows
    WHERE follower_id = :user_id AND status = 'active'

    UNION

    -- Recursive: Friends of friends (limit to 2 hops)
    SELECT f.following_id, fn.depth + 1
    FROM friend_network fn
    JOIN follows f ON fn.user_id = f.follower_id
    WHERE fn.depth < 2 AND f.status = 'active'
)
SELECT user_id, COUNT(*) as mutual_connections
FROM friend_network
WHERE depth = 2
GROUP BY user_id
ORDER BY mutual_connections DESC
LIMIT 20;

-- Complexity: O(n^2) worst case, but limited by depth and LIMIT
-- Performance: <100ms for typical user network (500 followers)
```

---

## 2. Component Architecture

### 2.1 Social Graph Service Components

```
┌──────────────────────────────────────────────────────────────┐
│                  Social Graph Service                         │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              API Controllers                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │  Follow      │  │  Block       │  │  Suggestion │  │  │
│  │  │  Controller  │  │  Controller  │  │  Controller │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │  │
│  └─────────┼──────────────────┼──────────────────┼─────────┘  │
│            │                  │                  │            │
│  ┌─────────▼──────────────────▼──────────────────▼─────────┐  │
│  │              Business Logic Layer                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │  Follow      │  │  Block       │  │  Suggestion │  │  │
│  │  │  Service     │  │  Service     │  │  Service    │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │  │
│  └─────────┼──────────────────┼──────────────────┼─────────┘  │
│            │                  │                  │            │
│  ┌─────────▼──────────────────▼──────────────────▼─────────┐  │
│  │              Data Access Layer                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │  Follow      │  │  Block       │  │  Graph      │  │  │
│  │  │  Repository  │  │  Repository  │  │  Repository │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │  │
│  └─────────┼──────────────────┼──────────────────┼─────────┘  │
│            │                  │                  │            │
│  ┌─────────▼──────────────────▼──────────────────▼─────────┐  │
│  │              Shared Components                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │  Privacy     │  │  Cache       │  │  Event      │  │  │
│  │  │  Enforcer    │  │  Manager     │  │  Publisher  │  │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Component Specifications

#### Follow Service

```yaml
component: FollowService
type: Business Logic Service
language: TypeScript
framework: NestJS

responsibilities:
  - Follow/unfollow operations
  - Follow request management
  - Follower/following list retrieval
  - Privacy enforcement integration
  - Counter cache management

interfaces:
  rest:
    - POST   /api/v1/social/follow/:userId
    - DELETE /api/v1/social/unfollow/:userId
    - POST   /api/v1/social/follow-requests/:userId/approve
    - POST   /api/v1/social/follow-requests/:userId/reject
    - GET    /api/v1/social/followers/:userId
    - GET    /api/v1/social/following/:userId
    - GET    /api/v1/social/follow-requests
    - GET    /api/v1/social/relationship/:userId

  events:
    publishes:
      - follow.created
      - follow.approved
      - follow.removed
      - follow.requested

    subscribes:
      - user.deleted
      - user.blocked

dependencies:
  internal:
    - UserService (profile data)
    - NotificationService (follow events)
    - PrivacyEnforcer (access control)

  external:
    - PostgreSQL (follows table)
    - Redis (counter cache)
    - RabbitMQ (event bus)

scaling:
  horizontal: true
  instances: "2-5"
  metrics:
    - cpu > 70%
    - memory > 80%
    - request_latency_p95 > 200ms
```

#### Block Service

```yaml
component: BlockService
type: Business Logic Service
language: TypeScript
framework: NestJS

responsibilities:
  - Block/unblock operations
  - Bidirectional block enforcement
  - Block list management
  - Cascade operations (remove follows, hide content)

interfaces:
  rest:
    - POST   /api/v1/social/block/:userId
    - DELETE /api/v1/social/unblock/:userId
    - GET    /api/v1/social/blocks
    - GET    /api/v1/social/is-blocked/:userId

  events:
    publishes:
      - block.created
      - block.removed

    subscribes:
      - user.deleted

dependencies:
  internal:
    - FollowService (remove follows)
    - ContentService (hide posts)

  external:
    - PostgreSQL (blocks table)
    - Redis (block cache)

scaling:
  horizontal: true
  instances: "1-3"
  cache_ttl: "5 minutes"
```

#### Suggestion Service

```yaml
component: SuggestionService
type: Business Logic Service
language: TypeScript
framework: NestJS

responsibilities:
  - Friend suggestions algorithm
  - Mutual connection calculation
  - Suggestion scoring
  - Personalized recommendations

interfaces:
  rest:
    - GET /api/v1/social/suggestions
    - POST /api/v1/social/suggestions/refresh

  background_jobs:
    - suggestion_calculation (daily)
    - suggestion_cache_refresh (hourly)

dependencies:
  internal:
    - FollowService (graph data)
    - UserService (profile data)

  external:
    - PostgreSQL (graph queries)
    - Redis (suggestion cache)

scaling:
  horizontal: true
  instances: "1-3"
  cache_ttl: "24 hours"
  computation: "async background jobs"
```

---

## 3. Database Architecture

### 3.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Database Schema                         │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│       users          │
├──────────────────────┤
│ id (PK)             │◄─────────────┐
│ email               │              │
│ password_hash       │              │
│ status              │              │
│ created_at          │              │
│ updated_at          │              │
└──────────────────────┘              │
                                      │
┌──────────────────────┐              │
│   user_profiles      │              │
├──────────────────────┤              │
│ id (PK)             │              │
│ user_id (FK) ───────┼──────────────┘
│ display_name        │
│ bio                 │
│ avatar_url          │
│ is_private          │
│ follow_approval_req │
│ follower_count      │◄─── Maintained by triggers
│ following_count     │◄─── Maintained by triggers
│ created_at          │
│ updated_at          │
└──────────────────────┘

┌──────────────────────┐
│       follows        │
├──────────────────────┤
│ id (PK)             │
│ follower_id (FK) ───┼──────┐
│ following_id (FK)───┼────┐ │
│ status              │    │ │  Status: 'active', 'pending'
│ created_at          │    │ │
│ updated_at          │    │ │
└──────────────────────┘    │ │
        │                   │ │
        │  ┌────────────────┘ │
        │  │  ┌───────────────┘
        │  │  │
        ▼  ▼  ▼
┌──────────────────────┐
│       users          │
│ (reference table)    │
└──────────────────────┘

┌──────────────────────┐
│       blocks         │
├──────────────────────┤
│ id (PK)             │
│ blocker_id (FK) ────┼──────┐
│ blocked_id (FK) ────┼────┐ │
│ created_at          │    │ │
└──────────────────────┘    │ │
        │                   │ │
        │  ┌────────────────┘ │
        │  │  ┌───────────────┘
        ▼  ▼  ▼
┌──────────────────────┐
│       users          │
│ (reference table)    │
└──────────────────────┘

┌──────────────────────────────┐
│   follow_suggestions         │
├──────────────────────────────┤
│ id (PK)                     │
│ user_id (FK) ───────────────┼──────┐
│ suggested_user_id (FK) ─────┼────┐ │
│ mutual_connections          │    │ │
│ score                       │    │ │
│ reason                      │    │ │
│ created_at                  │    │ │
│ expires_at                  │    │ │
└──────────────────────────────┘    │ │
                                    ▼ ▼
                          ┌──────────────────────┐
                          │       users          │
                          └──────────────────────┘
```

### 3.2 Database Schema Definition

```sql
-- ============================================================
-- FOLLOWS TABLE
-- ============================================================
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT follows_no_self_follow CHECK (follower_id != following_id),
    CONSTRAINT follows_unique_pair UNIQUE (follower_id, following_id)
);

-- Indexes for efficient graph queries
CREATE INDEX idx_follows_follower_id ON follows(follower_id) WHERE status = 'active';
CREATE INDEX idx_follows_following_id ON follows(following_id) WHERE status = 'active';
CREATE INDEX idx_follows_pending ON follows(following_id) WHERE status = 'pending';
CREATE INDEX idx_follows_created_at ON follows(created_at DESC);

-- Composite index for relationship checks (critical for privacy)
CREATE INDEX idx_follows_relationship ON follows(follower_id, following_id, status);

COMMENT ON TABLE follows IS 'Social graph follow relationships';
COMMENT ON COLUMN follows.status IS 'active: confirmed follow, pending: awaiting approval';

-- ============================================================
-- BLOCKS TABLE
-- ============================================================
CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT blocks_no_self_block CHECK (blocker_id != blocked_id),
    CONSTRAINT blocks_unique_pair UNIQUE (blocker_id, blocked_id)
);

-- Indexes for bidirectional block checks
CREATE INDEX idx_blocks_blocker_id ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked_id ON blocks(blocked_id);

-- Critical composite index for bidirectional checks
CREATE INDEX idx_blocks_bidirectional ON blocks(blocker_id, blocked_id);

COMMENT ON TABLE blocks IS 'User block relationships for privacy and harassment prevention';

-- ============================================================
-- FOLLOW SUGGESTIONS TABLE (Materialized Cache)
-- ============================================================
CREATE TABLE follow_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    suggested_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mutual_connections INTEGER DEFAULT 0,
    score NUMERIC(5,2) DEFAULT 0.0,
    reason VARCHAR(100), -- 'mutual_friends', 'popular', 'interests'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),

    -- Constraints
    CONSTRAINT suggestions_no_self UNIQUE (user_id, suggested_user_id)
);

-- Indexes for suggestion retrieval
CREATE INDEX idx_suggestions_user_id ON follow_suggestions(user_id, score DESC)
    WHERE expires_at > CURRENT_TIMESTAMP;
CREATE INDEX idx_suggestions_expires ON follow_suggestions(expires_at);

-- Automatic cleanup of expired suggestions
CREATE INDEX idx_suggestions_cleanup ON follow_suggestions(expires_at)
    WHERE expires_at < CURRENT_TIMESTAMP;

COMMENT ON TABLE follow_suggestions IS 'Materialized suggestion cache, refreshed daily';

-- ============================================================
-- USER PROFILES EXTENSION (Counter Columns)
-- ============================================================
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS follow_approval_required BOOLEAN DEFAULT false;

-- Index for privacy enforcement
CREATE INDEX idx_profiles_privacy ON user_profiles(is_private, follow_approval_required);

COMMENT ON COLUMN user_profiles.follower_count IS 'Cached count, maintained by triggers';
COMMENT ON COLUMN user_profiles.following_count IS 'Cached count, maintained by triggers';
COMMENT ON COLUMN user_profiles.is_private IS 'If true, posts visible only to followers';
COMMENT ON COLUMN user_profiles.follow_approval_required IS 'If true, follows require approval';
```

### 3.3 Database Triggers for Counter Maintenance

```sql
-- ============================================================
-- TRIGGER: Update follower/following counts
-- ============================================================
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Only increment on 'active' follows
        IF NEW.status = 'active' THEN
            -- Increment follower count for the followed user
            UPDATE user_profiles
            SET follower_count = follower_count + 1
            WHERE user_id = NEW.following_id;

            -- Increment following count for the follower
            UPDATE user_profiles
            SET following_count = following_count + 1
            WHERE user_id = NEW.follower_id;
        END IF;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Handle status change from pending to active
        IF OLD.status = 'pending' AND NEW.status = 'active' THEN
            UPDATE user_profiles
            SET follower_count = follower_count + 1
            WHERE user_id = NEW.following_id;

            UPDATE user_profiles
            SET following_count = following_count + 1
            WHERE user_id = NEW.follower_id;
        END IF;

    ELSIF (TG_OP = 'DELETE') THEN
        -- Decrement only if was active
        IF OLD.status = 'active' THEN
            UPDATE user_profiles
            SET follower_count = follower_count - 1
            WHERE user_id = OLD.following_id;

            UPDATE user_profiles
            SET following_count = following_count - 1
            WHERE user_id = OLD.follower_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_follow_counts
AFTER INSERT OR UPDATE OR DELETE ON follows
FOR EACH ROW
EXECUTE FUNCTION update_follow_counts();

-- ============================================================
-- TRIGGER: Cascade block operations
-- ============================================================
CREATE OR REPLACE FUNCTION cascade_block_operations()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Remove all follow relationships between blocker and blocked
        DELETE FROM follows
        WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
           OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);

        -- Remove suggestions
        DELETE FROM follow_suggestions
        WHERE (user_id = NEW.blocker_id AND suggested_user_id = NEW.blocked_id)
           OR (user_id = NEW.blocked_id AND suggested_user_id = NEW.blocker_id);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cascade_block
AFTER INSERT ON blocks
FOR EACH ROW
EXECUTE FUNCTION cascade_block_operations();
```

### 3.4 Index Strategy Summary

| Index | Purpose | Type | Query Pattern |
|-------|---------|------|---------------|
| `idx_follows_follower_id` | Fetch following list | B-tree + partial | `WHERE follower_id = ? AND status = 'active'` |
| `idx_follows_following_id` | Fetch followers list | B-tree + partial | `WHERE following_id = ? AND status = 'active'` |
| `idx_follows_relationship` | Privacy checks | B-tree composite | `WHERE follower_id = ? AND following_id = ?` |
| `idx_follows_pending` | Pending requests | B-tree + partial | `WHERE following_id = ? AND status = 'pending'` |
| `idx_blocks_bidirectional` | Block checks | B-tree composite | `WHERE blocker_id IN (?,?) AND blocked_id IN (?,?)` |
| `idx_suggestions_user_id` | Fetch suggestions | B-tree + partial | `WHERE user_id = ? AND expires_at > NOW()` |

**Performance Targets**:
- Follow/unfollow: <50ms p95
- Block check (bidirectional): <20ms p95
- Fetch followers/following (paginated): <100ms p95
- Suggestion retrieval: <150ms p95

---

## 4. API Architecture

### 4.1 RESTful API Contracts

```yaml
openapi: 3.0.0
info:
  title: Social Graph API
  version: 1.0.0
  description: Follow system, blocks, and friend suggestions

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Follow:
      type: object
      properties:
        id:
          type: string
          format: uuid
        follower_id:
          type: string
          format: uuid
        following_id:
          type: string
          format: uuid
        status:
          type: string
          enum: [active, pending]
        created_at:
          type: string
          format: date-time

    Relationship:
      type: object
      properties:
        is_following:
          type: boolean
        is_followed_by:
          type: boolean
        is_blocked:
          type: boolean
        follow_status:
          type: string
          enum: [none, active, pending]

    Suggestion:
      type: object
      properties:
        user_id:
          type: string
          format: uuid
        display_name:
          type: string
        avatar_url:
          type: string
        mutual_connections:
          type: integer
        reason:
          type: string
        score:
          type: number

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
  /social/follow/{userId}:
    post:
      summary: Follow a user
      operationId: followUser
      tags: [Follow System]
      security:
        - bearerAuth: []
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        200:
          description: Follow successful or pending approval
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [followed, pending, already_following]
                  follow:
                    $ref: '#/components/schemas/Follow'
        400:
          description: Bad request (self-follow)
        403:
          description: Blocked by user
        404:
          description: User not found

  /social/unfollow/{userId}:
    delete:
      summary: Unfollow a user
      operationId: unfollowUser
      tags: [Follow System]
      security:
        - bearerAuth: []
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        204:
          description: Unfollow successful
        404:
          description: Follow relationship not found

  /social/follow-requests:
    get:
      summary: Get pending follow requests
      operationId: getFollowRequests
      tags: [Follow System]
      security:
        - bearerAuth: []
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        200:
          description: List of pending follow requests
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Follow'
                  pagination:
                    type: object
                    properties:
                      page:
                        type: integer
                      limit:
                        type: integer
                      total:
                        type: integer

  /social/follow-requests/{userId}/approve:
    post:
      summary: Approve follow request
      operationId: approveFollowRequest
      tags: [Follow System]
      security:
        - bearerAuth: []
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        200:
          description: Follow request approved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Follow'
        404:
          description: Follow request not found

  /social/follow-requests/{userId}/reject:
    post:
      summary: Reject follow request
      operationId: rejectFollowRequest
      tags: [Follow System]
      security:
        - bearerAuth: []
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        204:
          description: Follow request rejected
        404:
          description: Follow request not found

  /social/followers/{userId}:
    get:
      summary: Get user's followers
      operationId: getFollowers
      tags: [Follow System]
      security:
        - bearerAuth: []
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        200:
          description: List of followers
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      type: object
                      properties:
                        user_id:
                          type: string
                          format: uuid
                        display_name:
                          type: string
                        avatar_url:
                          type: string
                        followed_at:
                          type: string
                          format: date-time
                  pagination:
                    type: object
        403:
          description: Private account, not authorized

  /social/relationship/{userId}:
    get:
      summary: Get relationship status with a user
      operationId: getRelationship
      tags: [Follow System]
      security:
        - bearerAuth: []
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        200:
          description: Relationship status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Relationship'

  /social/block/{userId}:
    post:
      summary: Block a user
      operationId: blockUser
      tags: [Block System]
      security:
        - bearerAuth: []
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        200:
          description: User blocked successfully
        400:
          description: Cannot block yourself

  /social/unblock/{userId}:
    delete:
      summary: Unblock a user
      operationId: unblockUser
      tags: [Block System]
      security:
        - bearerAuth: []
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        204:
          description: User unblocked

  /social/suggestions:
    get:
      summary: Get friend suggestions
      operationId: getSuggestions
      tags: [Suggestions]
      security:
        - bearerAuth: []
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
            maximum: 50
      responses:
        200:
          description: List of suggested users
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Suggestion'
```

### 4.2 Sequence Diagrams

#### Follow User Flow

```
Client          API Gateway    Follow Service    Privacy Service    DB          Notification
  │                 │                 │                  │           │                │
  │  POST /follow   │                 │                  │           │                │
  ├────────────────>│                 │                  │           │                │
  │                 │  JWT Verify     │                  │           │                │
  │                 ├─────────────────┤                  │           │                │
  │                 │  followUser()   │                  │           │                │
  │                 ├────────────────>│                  │           │                │
  │                 │                 │  checkBlock()    │           │                │
  │                 │                 ├─────────────────>│           │                │
  │                 │                 │                  │  SELECT   │                │
  │                 │                 │                  ├──────────>│                │
  │                 │                 │                  │<──────────┤                │
  │                 │                 │<─────────────────┤           │                │
  │                 │                 │  not blocked     │           │                │
  │                 │                 │                  │           │                │
  │                 │                 │  getPrivacySettings()        │                │
  │                 │                 ├──────────────────────────────>│                │
  │                 │                 │<──────────────────────────────┤                │
  │                 │                 │  approval_required=true       │                │
  │                 │                 │                  │           │                │
  │                 │                 │  INSERT follows  │           │                │
  │                 │                 │  status='pending'│           │                │
  │                 │                 ├──────────────────────────────>│                │
  │                 │                 │<──────────────────────────────┤                │
  │                 │                 │                  │           │                │
  │                 │                 │  publishEvent()  │           │  sendNotif()   │
  │                 │                 ├──────────────────────────────┼───────────────>│
  │                 │<────────────────┤                  │           │                │
  │<────────────────┤  {status: 'pending'}              │           │                │
  │  200 OK         │                 │                  │           │                │
```

#### Approve Follow Request Flow

```
Client          API Gateway    Follow Service    DB          Notification    WebSocket
  │                 │                 │           │                │              │
  │  POST /approve  │                 │           │                │              │
  ├────────────────>│                 │           │                │              │
  │                 │  approveFollow()│           │                │              │
  │                 ├────────────────>│           │                │              │
  │                 │                 │  UPDATE   │                │              │
  │                 │                 │  status=  │                │              │
  │                 │                 │  'active' │                │              │
  │                 │                 ├──────────>│                │              │
  │                 │                 │ [Trigger] │                │              │
  │                 │                 │  increment│                │              │
  │                 │                 │  counts   │                │              │
  │                 │                 │<──────────┤                │              │
  │                 │                 │           │                │              │
  │                 │                 │  publishEvent()            │              │
  │                 │                 ├────────────────────────────>│              │
  │                 │                 │           │   send 'follow'│              │
  │                 │                 │           │    notification├─────────────>│
  │                 │                 │           │                │  emit event  │
  │                 │<────────────────┤           │                │              │
  │<────────────────┤  200 OK         │           │                │              │
```

#### Block User Flow with Cascade

```
Client          API Gateway    Block Service    Follow Service    DB
  │                 │                 │                │           │
  │  POST /block    │                 │                │           │
  ├────────────────>│                 │                │           │
  │                 │  blockUser()    │                │           │
  │                 ├────────────────>│                │           │
  │                 │                 │  BEGIN TRANSACTION         │
  │                 │                 ├───────────────────────────>│
  │                 │                 │  INSERT blocks │           │
  │                 │                 ├───────────────────────────>│
  │                 │                 │  [Trigger]     │           │
  │                 │                 │  DELETE follows│           │
  │                 │                 │  (both ways)   │           │
  │                 │                 │  [Trigger]     │           │
  │                 │                 │  decrement     │           │
  │                 │                 │  counts        │           │
  │                 │                 │<───────────────────────────┤
  │                 │                 │  COMMIT        │           │
  │                 │                 ├───────────────────────────>│
  │                 │<────────────────┤                │           │
  │<────────────────┤  200 OK         │                │           │
```

---

## 5. Privacy & Security Architecture

### 5.1 Privacy Enforcement Layer

```yaml
privacy_enforcement:
  component: PrivacyEnforcer
  type: Middleware/Service

  rules:
    profile_visibility:
      public_account:
        - Anyone can view profile
        - Anyone can view followers/following
        - Anyone can view posts

      private_account:
        - Only approved followers can view profile details
        - Only approved followers can view posts
        - Follower/following counts visible to all
        - Follow button visible to all (triggers request)

    block_enforcement:
      bidirectional_effect:
        - Blocker cannot see blocked user's content
        - Blocked user cannot see blocker's content
        - Existing follows removed automatically
        - No API responses indicate block status (privacy)

      cascade_operations:
        - Remove follows (both directions)
        - Remove follow requests
        - Remove suggestions
        - Hide posts from feeds
        - Prevent mentions/tags

    follow_requests:
      private_account_flow:
        - Follow creates 'pending' status
        - Notification sent to account owner
        - No follower count increment until approved
        - Requester sees "Requested" state

      approval_actions:
        - Approve: status → 'active', counts increment
        - Reject: record deleted, no notification
        - Timeout: pending requests never expire (manual action)

  implementation:
    middleware:
      - CheckBlockMiddleware (all routes)
      - PrivacyCheckMiddleware (content routes)

    service_methods:
      - canViewProfile(viewerId, targetId) -> boolean
      - canViewPosts(viewerId, targetId) -> boolean
      - isBlocked(userId1, userId2) -> boolean
      - getFollowStatus(followerId, targetId) -> FollowStatus
```

### 5.2 Security Architecture

```yaml
security_measures:
  authentication:
    - JWT bearer tokens (all endpoints)
    - Token expiry: 15 minutes
    - Refresh token: 7 days

  authorization:
    - Resource ownership validation
    - RBAC for admin operations
    - Rate limiting per user

  rate_limiting:
    follow_actions:
      - 30 follows per hour per user
      - 100 follow requests per day per user
      - Prevent follow spam

    block_actions:
      - 50 blocks per day per user
      - Prevent abuse

    api_calls:
      - 1000 requests per hour per user
      - 10000 requests per hour per IP

  input_validation:
    - UUID format validation
    - SQL injection prevention (parameterized queries)
    - XSS prevention (output encoding)

  data_protection:
    - No PII in logs
    - Encrypted database connections (TLS)
    - Audit logging for sensitive operations

  anti_abuse:
    - Follow spam detection
    - Block cycling detection (block/unblock repeatedly)
    - Bot detection (pattern analysis)
```

---

## 6. Performance Architecture

### 6.1 Caching Strategy

```yaml
caching_layers:
  redis_cache:
    counter_cache:
      keys:
        - "user:{userId}:follower_count" → TTL: 5 min
        - "user:{userId}:following_count" → TTL: 5 min

      strategy:
        - Write-through on follow/unfollow
        - Fallback to database if cache miss
        - Periodic sync job (every 5 minutes)

    block_cache:
      keys:
        - "block:{userId1}:{userId2}" → TTL: 5 min

      strategy:
        - Cache block status for frequent checks
        - Invalidate on block/unblock
        - Bidirectional keys (both userId pairs)

    relationship_cache:
      keys:
        - "relationship:{userId1}:{userId2}" → TTL: 2 min

      strategy:
        - Cache complete relationship object
        - Invalidate on any relationship change

    suggestion_cache:
      keys:
        - "suggestions:{userId}" → TTL: 24 hours

      strategy:
        - Pre-computed suggestions (background job)
        - Full list cached
        - Refresh daily or on-demand

    feed_cache:
      keys:
        - "feed:{userId}:page:{n}" → TTL: 5 min

      strategy:
        - Cache personalized feed pages
        - Invalidate on new follows (recalculate)

  cdn_cache:
    - Avatar images: 1 day TTL
    - Profile data: 5 minutes TTL

performance_targets:
  follow_operation: "<50ms p95"
  block_check: "<20ms p95"
  fetch_followers: "<100ms p95"
  suggestions: "<150ms p95"
  relationship_check: "<30ms p95"
```

### 6.2 Query Optimization

```sql
-- ============================================================
-- OPTIMIZED QUERY: Get followers with privacy check
-- ============================================================
-- Uses partial indexes and excludes blocked users
SELECT
    u.id,
    u.display_name,
    u.avatar_url,
    f.created_at as followed_at
FROM follows f
JOIN user_profiles u ON f.follower_id = u.user_id
WHERE f.following_id = :target_user_id
  AND f.status = 'active'
  AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = :viewer_id AND b.blocked_id = f.follower_id)
         OR (b.blocker_id = f.follower_id AND b.blocked_id = :viewer_id)
  )
ORDER BY f.created_at DESC
LIMIT 20 OFFSET :offset;

-- Index usage: idx_follows_following_id (partial index on status='active')
-- Block check: idx_blocks_bidirectional
-- Expected execution time: <100ms for 10K followers

-- ============================================================
-- OPTIMIZED QUERY: Mutual friends for suggestions
-- ============================================================
-- Efficient 2-hop traversal with limits
WITH my_following AS (
    SELECT following_id
    FROM follows
    WHERE follower_id = :user_id AND status = 'active'
),
mutual_friends AS (
    SELECT
        f.following_id as suggested_user_id,
        COUNT(*) as mutual_count
    FROM follows f
    WHERE f.follower_id IN (SELECT following_id FROM my_following)
      AND f.status = 'active'
      AND f.following_id != :user_id
      AND f.following_id NOT IN (SELECT following_id FROM my_following)
      AND NOT EXISTS (
          SELECT 1 FROM blocks b
          WHERE (b.blocker_id = :user_id AND b.blocked_id = f.following_id)
             OR (b.blocker_id = f.following_id AND b.blocked_id = :user_id)
      )
    GROUP BY f.following_id
    HAVING COUNT(*) >= 2
)
SELECT
    u.id,
    u.display_name,
    u.avatar_url,
    mf.mutual_count
FROM mutual_friends mf
JOIN user_profiles u ON mf.suggested_user_id = u.user_id
ORDER BY mf.mutual_count DESC, u.follower_count DESC
LIMIT 20;

-- Expected execution time: <200ms for typical user (500 following)
```

### 6.3 Scaling Strategy

```yaml
horizontal_scaling:
  application_tier:
    instances: "2-5"
    load_balancer: "Round-robin"
    stateless: true

  read_replicas:
    count: 2
    routing:
      - Write operations → Primary database
      - Read operations → Round-robin replicas
      - Follower lists, suggestions → Replicas
      - Follow/unfollow → Primary

  connection_pooling:
    primary:
      min_connections: 10
      max_connections: 50
    replica:
      min_connections: 5
      max_connections: 30

vertical_scaling:
  database:
    current: "4 vCPU, 16GB RAM"
    scale_up_trigger: "CPU > 70% sustained"
    max_size: "16 vCPU, 64GB RAM"

  cache:
    current: "2GB Redis"
    scale_up_trigger: "Memory > 80%"
    max_size: "16GB Redis"

sharding_strategy:
  future_consideration:
    method: "Hash-based sharding on user_id"
    trigger: "> 10M users"
    shards: 4
    routing: "Consistent hashing"
```

---

## 7. Integration Architecture

### 7.1 Service Integration Points

```yaml
integrations:
  user_service:
    purpose: "Profile data, privacy settings"
    endpoints:
      - GET /users/{id}/profile
      - GET /users/{id}/privacy-settings

    data_flow:
      - Follow Service requests privacy settings
      - Block Service requests user existence
      - Suggestion Service requests profile data

  notification_service:
    purpose: "Follow events, follow requests"
    events:
      - follow.created → "X started following you"
      - follow.requested → "X requested to follow you"
      - follow.approved → "X approved your follow request"

    delivery_channels:
      - WebSocket (real-time)
      - Push notifications (mobile)
      - Email (digest)

  content_service:
    purpose: "Feed personalization, post visibility"
    endpoints:
      - GET /feed/personalized
      - POST /feed/recalculate

    data_flow:
      - Content Service queries Follow Service for follower graph
      - Content Service applies privacy rules
      - New follow triggers feed recalculation

  analytics_service:
    purpose: "User engagement metrics"
    events:
      - follow.created
      - follow.removed
      - block.created

    metrics:
      - Follow growth rate
      - Engagement score
      - Suggestion conversion rate
```

### 7.2 Event-Driven Architecture

```yaml
event_bus:
  technology: RabbitMQ
  exchange_type: Topic

  event_definitions:
    follow.created:
      routing_key: "social.follow.created"
      payload:
        follower_id: UUID
        following_id: UUID
        status: "active" | "pending"
        created_at: timestamp

      consumers:
        - Notification Service
        - Analytics Service
        - Feed Service

    follow.approved:
      routing_key: "social.follow.approved"
      payload:
        follower_id: UUID
        following_id: UUID
        approved_at: timestamp

      consumers:
        - Notification Service
        - Feed Service

    block.created:
      routing_key: "social.block.created"
      payload:
        blocker_id: UUID
        blocked_id: UUID
        created_at: timestamp

      consumers:
        - Content Service (hide content)
        - Analytics Service

    user.deleted:
      routing_key: "user.deleted"
      payload:
        user_id: UUID
        deleted_at: timestamp

      consumers:
        - Follow Service (cascade delete)
        - Block Service (cascade delete)

  reliability:
    - Durable queues
    - Message persistence
    - Retry logic (exponential backoff)
    - Dead letter queue for failed messages
```

### 7.3 Feed Integration Architecture

```
┌──────────────────────────────────────────────────────────┐
│               Personalized Feed Generation                │
└──────────────────────────────────────────────────────────┘

Step 1: User requests feed
  │
  ▼
┌─────────────────────────┐
│   Feed Service          │
│   GET /feed             │
└──────────┬──────────────┘
           │
           │ Step 2: Get following list
           ▼
┌─────────────────────────┐
│  Follow Service         │
│  getFollowingIds()      │
└──────────┬──────────────┘
           │
           │ Returns: [uuid1, uuid2, ...]
           ▼
┌─────────────────────────┐
│  Content Service        │
│  getPostsByAuthors()    │
└──────────┬──────────────┘
           │
           │ Step 3: Fetch posts from followed users
           │ Filter by:
           │   - Privacy settings (public posts only for non-followers)
           │   - Block status (exclude blocked users)
           │   - Timestamp (recent posts first)
           ▼
┌─────────────────────────┐
│  Ranking Algorithm      │
│  - Recency score        │
│  - Engagement score     │
│  - Mutual connection    │
│    boost                │
└──────────┬──────────────┘
           │
           │ Step 4: Return ranked feed
           ▼
┌─────────────────────────┐
│  Cache (Redis)          │
│  TTL: 5 minutes         │
└─────────────────────────┘
```

---

## 8. Deployment Architecture

### 8.1 Kubernetes Deployment

```yaml
# ============================================================
# Social Graph Service Deployment
# ============================================================
apiVersion: apps/v1
kind: Deployment
metadata:
  name: social-graph-service
  labels:
    app: social-graph-service
    tier: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: social-graph-service
  template:
    metadata:
      labels:
        app: social-graph-service
    spec:
      containers:
      - name: social-graph-service
        image: social-graph-service:1.0.0
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: rabbitmq-credentials
              key: url

        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"

        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10

        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - social-graph-service
              topologyKey: kubernetes.io/hostname

---
apiVersion: v1
kind: Service
metadata:
  name: social-graph-service
spec:
  selector:
    app: social-graph-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP

---
# ============================================================
# Horizontal Pod Autoscaler
# ============================================================
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: social-graph-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: social-graph-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80

---
# ============================================================
# Background Job for Suggestions (CronJob)
# ============================================================
apiVersion: batch/v1
kind: CronJob
metadata:
  name: suggestion-calculator
spec:
  schedule: "0 2 * * *" # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: suggestion-job
            image: social-graph-service:1.0.0
            command: ["npm", "run", "jobs:suggestions"]
            env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
          restartPolicy: OnFailure
```

### 8.2 Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Cloud Infrastructure (AWS)                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Region: us-east-1                                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Availability Zone 1      Availability Zone 2          │ │
│  │                                                         │ │
│  │  ┌──────────────┐         ┌──────────────┐            │ │
│  │  │ EKS Node 1   │         │ EKS Node 2   │            │ │
│  │  │              │         │              │            │ │
│  │  │ Pods: 2-3    │         │ Pods: 2-3    │            │ │
│  │  └──────────────┘         └──────────────┘            │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  RDS PostgreSQL (Primary + Read Replicas)       │  │ │
│  │  │  - Primary: AZ1                                  │  │ │
│  │  │  - Replica 1: AZ1                                │  │ │
│  │  │  - Replica 2: AZ2                                │  │ │
│  │  │  - Multi-AZ failover enabled                     │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  ElastiCache Redis (Cluster Mode)               │  │ │
│  │  │  - 2 nodes                                       │  │ │
│  │  │  - 2GB each                                      │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  Amazon MQ (RabbitMQ)                            │  │ │
│  │  │  - Active/Standby                                │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Monitoring & Logging                                  │ │
│  │  - CloudWatch Logs                                     │ │
│  │  - CloudWatch Metrics                                  │ │
│  │  - X-Ray (distributed tracing)                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Monitoring & Observability

```yaml
monitoring:
  metrics:
    application_metrics:
      - follow_operations_total (counter)
      - follow_operation_duration_seconds (histogram)
      - block_operations_total (counter)
      - suggestion_generation_duration_seconds (histogram)
      - cache_hit_rate (gauge)
      - active_follows_count (gauge)

    infrastructure_metrics:
      - cpu_utilization (gauge)
      - memory_utilization (gauge)
      - database_connections (gauge)
      - redis_memory_usage (gauge)
      - api_response_time_p95 (gauge)

  logging:
    structured_logs:
      format: JSON
      fields:
        - timestamp
        - level
        - user_id
        - action
        - duration_ms
        - error (if applicable)

    log_levels:
      - ERROR: All errors, exceptions
      - WARN: Rate limit violations, suspicious activity
      - INFO: Follow/unfollow operations, approvals
      - DEBUG: (disabled in production)

  alerting:
    alerts:
      - name: "High Error Rate"
        condition: "error_rate > 5%"
        severity: critical

      - name: "Slow Follow Operations"
        condition: "follow_duration_p95 > 100ms"
        severity: warning

      - name: "Database Connection Pool Exhausted"
        condition: "db_connections > 90% of max"
        severity: critical

      - name: "Cache Miss Rate High"
        condition: "cache_hit_rate < 70%"
        severity: warning

    channels:
      - PagerDuty (critical alerts)
      - Slack (warning alerts)
      - Email (daily summaries)

  distributed_tracing:
    technology: AWS X-Ray
    trace_sampling: "5%"
    trace_retention: "7 days"
```

---

## 9. Technology Stack Summary

```yaml
technology_decisions:
  backend:
    language: TypeScript
    runtime: Node.js 18 LTS
    framework: NestJS
    rationale: "Team expertise, strong typing, excellent scalability"

  database:
    primary: PostgreSQL 14
    rationale: "ACID compliance, recursive CTEs for graph queries, team expertise"
    extensions: ["pg_stat_statements", "pg_trgm"]

  cache:
    technology: Redis 7
    rationale: "Fast key-value store, TTL support, counter operations"

  message_queue:
    technology: RabbitMQ 3.11
    rationale: "Reliable message delivery, topic exchanges, dead letter queues"

  container_orchestration:
    technology: Kubernetes (AWS EKS)
    rationale: "Auto-scaling, self-healing, industry standard"

  monitoring:
    metrics: Prometheus + CloudWatch
    logging: CloudWatch Logs
    tracing: AWS X-Ray
    rationale: "AWS native integration, cost-effective"

  api_gateway:
    technology: Kong
    rationale: "Rate limiting, authentication, load balancing, plugin ecosystem"
```

---

## 10. Migration & Rollout Strategy

```yaml
migration_plan:
  phase_1_database:
    - Create tables (follows, blocks, follow_suggestions)
    - Create indexes
    - Create triggers
    - Seed test data
    - Duration: 2 days

  phase_2_service:
    - Implement Follow Service
    - Implement Block Service
    - Unit tests (>90% coverage)
    - Integration tests
    - Duration: 1 week

  phase_3_integration:
    - Integrate with User Service
    - Integrate with Notification Service
    - Integrate with Content Service
    - End-to-end tests
    - Duration: 3 days

  phase_4_deployment:
    - Deploy to staging
    - Performance testing
    - Security audit
    - Deploy to production (blue-green)
    - Duration: 2 days

rollout_strategy:
  approach: "Blue-Green Deployment"
  steps:
    - Deploy new version to green environment
    - Run smoke tests
    - Gradually shift traffic (10%, 50%, 100%)
    - Monitor error rates and latency
    - Rollback if error rate > 1%

  feature_flags:
    - follow_system_enabled (default: true)
    - suggestions_enabled (default: true)
    - privacy_enforcement_strict (default: true)

rollback_plan:
  triggers:
    - Error rate > 5%
    - p95 latency > 500ms
    - Database connection failures

  process:
    - Shift traffic back to blue environment
    - Investigate root cause
    - Fix and redeploy
```

---

## 11. Appendix

### A. Performance Benchmarks

| Operation | Target | Expected Load | Query Complexity |
|-----------|--------|---------------|------------------|
| Follow user | <50ms p95 | 100 req/sec | O(1) - 3 indexed queries |
| Unfollow user | <30ms p95 | 50 req/sec | O(1) - 1 delete query |
| Get followers | <100ms p95 | 200 req/sec | O(n) - paginated scan |
| Get suggestions | <150ms p95 | 50 req/sec | O(n^2) - limited 2-hop |
| Block check | <20ms p95 | 500 req/sec | O(1) - cached |
| Approve request | <40ms p95 | 20 req/sec | O(1) - 1 update query |

### B. Database Capacity Planning

```yaml
capacity_planning:
  assumptions:
    - Total users: 100,000 (MVP)
    - Average followers per user: 50
    - Average following per user: 50
    - Follow growth rate: 20% per month

  storage_estimates:
    follows_table:
      row_size: ~80 bytes
      total_rows: 5,000,000 (100K users × 50 follows)
      storage: ~400 MB
      indexes: ~800 MB
      total: ~1.2 GB

    blocks_table:
      row_size: ~60 bytes
      total_rows: 50,000 (0.5% block rate)
      storage: ~3 MB
      indexes: ~6 MB
      total: ~10 MB

    suggestions_table:
      row_size: ~100 bytes
      total_rows: 1,000,000 (10 suggestions × 100K users)
      storage: ~100 MB
      indexes: ~200 MB
      total: ~300 MB

    total_database_size: ~2 GB

  scaling_thresholds:
    - Add read replica: > 1000 read QPS
    - Increase instance size: CPU > 70% sustained
    - Consider sharding: > 10M users
```

### C. Security Checklist

- [x] All API endpoints require authentication
- [x] Input validation on all user inputs
- [x] SQL injection prevention (parameterized queries)
- [x] Rate limiting on all endpoints
- [x] Bidirectional block enforcement
- [x] Privacy settings enforced at database level
- [x] Audit logging for sensitive operations
- [x] No PII in application logs
- [x] TLS encryption for all connections
- [x] Secrets stored in secure vault (AWS Secrets Manager)

---

**Document Status**: ARCHITECTURE DRAFT
**Next Phase**: SPARC Phase 4 - Refinement (TDD Implementation)
**Review Required**: Yes
**Stakeholders**: Backend Team, DevOps Team, Security Team
**Last Updated**: 2025-12-16

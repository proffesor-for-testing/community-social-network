# M4 Comments System - Architecture Design
## SPARC Phase 3: Architecture

**Document Version:** 1.0.0
**Created:** 2025-12-16
**Status:** 🏗️ ARCHITECTURE DRAFT
**Milestone:** M4 - Comments & Nested Discussions
**Phase:** SPARC Phase 3 (Architecture)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Architecture](#data-architecture)
4. [API Architecture](#api-architecture)
5. [Sequence Diagrams](#sequence-diagrams)
6. [Security Architecture](#security-architecture)
7. [Performance Architecture](#performance-architecture)
8. [Scalability Design](#scalability-design)

---

## System Overview

### Architecture Goals

- **Single-Query Tree Loading**: Load entire comment tree with one recursive CTE
- **Atomic Operations**: Ensure counter consistency with database-level atomicity
- **Soft Delete Integrity**: Preserve tree structure when comments are deleted
- **Real-time Ready**: Design for WebSocket notification integration
- **High Performance**: Load 100 comments in <1 second

### Key Architectural Patterns

1. **Materialized Path Pattern**: Store ancestor path for efficient tree queries
2. **Recursive CTE**: Single query to load entire comment hierarchy
3. **Atomic Counters**: Database-level increment/decrement for consistency
4. **Soft Delete with Tree Preservation**: Mark as deleted without breaking replies
5. **Mention System Integration**: Parse @mentions and trigger notifications
6. **Event-Driven Notifications**: Publish events for real-time updates

---

## Component Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Web App    │  │  Mobile App  │  │  API Client  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │         API GATEWAY LAYER            │
          │  ┌────────────────────────────────┐  │
          │  │  Rate Limiter (100 req/min)    │  │
          │  │  Authentication (JWT)          │  │
          │  │  Request Validation            │  │
          │  └────────────────────────────────┘  │
          └──────────────────┬──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │      COMMENT SERVICE LAYER           │
          │                                      │
          │  ┌───────────────────────────────┐  │
          │  │   CommentController           │  │
          │  │   - POST /comments            │  │
          │  │   - GET /comments/:id/tree    │  │
          │  │   - PATCH /comments/:id       │  │
          │  │   - DELETE /comments/:id      │  │
          │  └──────────┬────────────────────┘  │
          │             │                        │
          │  ┌──────────▼────────────────────┐  │
          │  │   CommentService              │  │
          │  │   - createComment()           │  │
          │  │   - getCommentTree()          │  │
          │  │   - updateComment()           │  │
          │  │   - softDeleteComment()       │  │
          │  │   - validateDepth()           │  │
          │  └──────────┬────────────────────┘  │
          │             │                        │
          │  ┌──────────▼────────────────────┐  │
          │  │   MentionProcessor            │  │
          │  │   - extractMentions()         │  │
          │  │   - validateMentions()        │  │
          │  │   - createMentions()          │  │
          │  └──────────┬────────────────────┘  │
          │             │                        │
          │  ┌──────────▼────────────────────┐  │
          │  │   ReactionService             │  │
          │  │   - addReaction()             │  │
          │  │   - removeReaction()          │  │
          │  │   - updateReactionCount()     │  │
          │  └───────────────────────────────┘  │
          └──────────────────┬──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │      DATA ACCESS LAYER               │
          │  ┌───────────────────────────────┐  │
          │  │   CommentRepository           │  │
          │  │   - findByIdWithAncestors()   │  │
          │  │   - findTreeByPostId()        │  │
          │  │   - incrementRepliesCount()   │  │
          │  │   - decrementRepliesCount()   │  │
          │  └──────────┬────────────────────┘  │
          │             │                        │
          │  ┌──────────▼────────────────────┐  │
          │  │   MentionRepository           │  │
          │  │   - createBatch()             │  │
          │  │   - findByCommentId()         │  │
          │  └──────────┬────────────────────┘  │
          │             │                        │
          │  ┌──────────▼────────────────────┐  │
          │  │   ReactionRepository          │  │
          │  │   - upsertReaction()          │  │
          │  │   - findUserReactions()       │  │
          │  └───────────────────────────────┘  │
          └──────────────────┬──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │         DATABASE LAYER               │
          │  ┌───────────────────────────────┐  │
          │  │   PostgreSQL 14+              │  │
          │  │   - comments table            │  │
          │  │   - comment_mentions table    │  │
          │  │   - comment_reactions table   │  │
          │  │   - Recursive CTEs            │  │
          │  │   - Materialized Paths        │  │
          │  └───────────────────────────────┘  │
          └──────────────────┬──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │      EXTERNAL SERVICES               │
          │  ┌───────────────────────────────┐  │
          │  │   Notification Service        │  │
          │  │   (M3 Integration)            │  │
          │  │   - commentCreated event      │  │
          │  │   - mentionCreated event      │  │
          │  │   - reactionAdded event       │  │
          │  └───────────────────────────────┘  │
          │  ┌───────────────────────────────┐  │
          │  │   WebSocket Server            │  │
          │  │   - Real-time updates         │  │
          │  │   - Live comment feed         │  │
          │  └───────────────────────────────┘  │
          └──────────────────────────────────────┘
```

### Component Responsibilities

#### CommentController
- HTTP request/response handling
- Input validation and sanitization
- Authorization checks (can user comment on this post?)
- Response formatting with pagination

#### CommentService
- Business logic orchestration
- Depth validation (max 3 levels)
- Content sanitization (XSS prevention)
- Transaction management
- Event publishing

#### MentionProcessor
- Extract @username patterns from content
- Validate mentioned users exist
- Limit to 10 mentions per comment
- Create mention records
- Trigger mention notifications

#### ReactionService
- Add/remove/update reactions
- Atomic counter updates
- One reaction per user per comment
- Reaction type validation

#### CommentRepository
- Database query execution
- Recursive CTE for tree loading
- Atomic counter operations
- Materialized path management

---

## Data Architecture

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           USERS                                  │
│  - id (PK, UUID)                                                 │
│  - username (UNIQUE)                                             │
│  - email (UNIQUE)                                                │
│  - created_at                                                    │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ 1:N (author)
             │
┌────────────▼────────────────────────────────────────────────────┐
│                           POSTS                                  │
│  - id (PK, UUID)                                                 │
│  - author_id (FK → users.id)                                     │
│  - content (TEXT)                                                │
│  - comments_count (INTEGER, default 0)                           │
│  - is_deleted (BOOLEAN, default FALSE)                           │
│  - created_at                                                    │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ 1:N
             │
┌────────────▼────────────────────────────────────────────────────┐
│                         COMMENTS                                 │
│  - id (PK, UUID)                                                 │
│  - post_id (FK → posts.id) [INDEXED]                             │
│  - author_id (FK → users.id) [INDEXED]                           │
│  - parent_comment_id (FK → comments.id, NULLABLE) [INDEXED]      │
│  - content (TEXT, max 5000 chars)                                │
│  - path (VARCHAR(500)) [INDEXED] ← MATERIALIZED PATH            │
│  - depth (INTEGER, 0-2) [INDEXED]                                │
│  - likes_count (INTEGER, default 0) [INDEXED]                    │
│  - replies_count (INTEGER, default 0)                            │
│  - is_deleted (BOOLEAN, default FALSE)                           │
│  - deleted_by (ENUM: 'author', 'post_owner', 'moderator')       │
│  - edited_at (TIMESTAMP, NULLABLE)                               │
│  - created_at                                                    │
│  - updated_at                                                    │
│                                                                   │
│  INDEXES:                                                        │
│    - pk_comments (id)                                            │
│    - idx_comments_post_created (post_id, created_at DESC)        │
│    - idx_comments_post_path (post_id, path)                      │
│    - idx_comments_author (author_id)                             │
│    - idx_comments_parent (parent_comment_id)                     │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ 1:N                            ┌─────────────────────┐
             │                                │       USERS         │
             │                                │  (mentioned users)  │
             │                                └──────────┬──────────┘
             │                                           │
             │ 1:N                                       │ N:1
             │                                           │
┌────────────▼───────────────────────────────────────────▼─────────┐
│                      COMMENT_MENTIONS                             │
│  - id (PK, UUID)                                                  │
│  - comment_id (FK → comments.id) [INDEXED]                        │
│  - mentioned_user_id (FK → users.id) [INDEXED]                    │
│  - created_at                                                     │
│                                                                   │
│  UNIQUE CONSTRAINT (comment_id, mentioned_user_id)               │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                      COMMENT_REACTIONS                             │
│  - id (PK, UUID)                                                   │
│  - comment_id (FK → comments.id) [INDEXED]                         │
│  - user_id (FK → users.id) [INDEXED]                               │
│  - reaction_type (ENUM: 'like', 'love', 'laugh', 'wow',          │
│                         'sad', 'angry')                           │
│  - created_at                                                      │
│                                                                    │
│  UNIQUE CONSTRAINT (comment_id, user_id)                          │
│  INDEX (comment_id, reaction_type)                                │
└───────────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Comments Table with Materialized Path
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 5000),

    -- Tree Structure (Materialized Path Pattern)
    path VARCHAR(500) NOT NULL, -- Format: "uuid/uuid/uuid" or just "uuid" for top-level
    depth INTEGER NOT NULL CHECK (depth >= 0 AND depth <= 2),

    -- Counters
    likes_count INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
    replies_count INTEGER NOT NULL DEFAULT 0 CHECK (replies_count >= 0),

    -- Soft Delete
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by VARCHAR(20) CHECK (deleted_by IN ('author', 'post_owner', 'moderator')),

    -- Timestamps
    edited_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_deleted_by_when_deleted
        CHECK (is_deleted = FALSE OR deleted_by IS NOT NULL),
    CONSTRAINT check_parent_in_same_post
        CHECK (parent_comment_id IS NULL OR
               (SELECT post_id FROM comments WHERE id = parent_comment_id) = post_id)
);

-- Indexes for Performance
CREATE INDEX idx_comments_post_created ON comments(post_id, created_at DESC);
CREATE INDEX idx_comments_post_path ON comments(post_id, path);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_comments_likes ON comments(likes_count DESC) WHERE is_deleted = FALSE;

-- Comment Mentions Table
CREATE TABLE comment_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- One mention per user per comment
    UNIQUE (comment_id, mentioned_user_id)
);

CREATE INDEX idx_comment_mentions_comment ON comment_mentions(comment_id);
CREATE INDEX idx_comment_mentions_user ON comment_mentions(mentioned_user_id);

-- Comment Reactions Table
CREATE TABLE comment_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(10) NOT NULL CHECK (
        reaction_type IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry')
    ),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- One reaction per user per comment
    UNIQUE (comment_id, user_id)
);

CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX idx_comment_reactions_comment_type ON comment_reactions(comment_id, reaction_type);
CREATE INDEX idx_comment_reactions_user ON comment_reactions(user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comment_timestamp
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_comment_updated_at();
```

### Recursive CTE Query Architecture

```sql
-- Load Complete Comment Tree with Single Query
-- This query loads all comments for a post in one database roundtrip

WITH RECURSIVE comment_tree AS (
    -- Base case: Top-level comments (depth = 0)
    SELECT
        c.id,
        c.post_id,
        c.author_id,
        c.parent_comment_id,
        c.content,
        c.path,
        c.depth,
        c.likes_count,
        c.replies_count,
        c.is_deleted,
        c.deleted_by,
        c.edited_at,
        c.created_at,
        c.updated_at,
        u.username AS author_username,
        u.avatar_url AS author_avatar,
        -- For sorting: top-level comments by created_at DESC
        c.created_at AS sort_date,
        -- Array to track the path for ordering
        ARRAY[c.created_at] AS sort_path
    FROM comments c
    JOIN users u ON c.author_id = u.id
    WHERE c.post_id = $1  -- Post ID parameter
        AND c.parent_comment_id IS NULL
        AND c.is_deleted = FALSE

    UNION ALL

    -- Recursive case: Replies to comments
    SELECT
        c.id,
        c.post_id,
        c.author_id,
        c.parent_comment_id,
        c.content,
        c.path,
        c.depth,
        c.likes_count,
        c.replies_count,
        c.is_deleted,
        c.deleted_by,
        c.edited_at,
        c.created_at,
        c.updated_at,
        u.username AS author_username,
        u.avatar_url AS author_avatar,
        c.created_at AS sort_date,
        -- Append to path for proper ordering
        ct.sort_path || c.created_at
    FROM comments c
    JOIN users u ON c.author_id = u.id
    JOIN comment_tree ct ON c.parent_comment_id = ct.id
    WHERE c.is_deleted = FALSE
        AND ct.depth < 2  -- Max depth of 2 (3 levels total: 0, 1, 2)
)
SELECT
    ct.*,
    -- Get mentions for each comment
    COALESCE(
        json_agg(
            DISTINCT jsonb_build_object(
                'user_id', cm.mentioned_user_id,
                'username', mu.username
            )
        ) FILTER (WHERE cm.id IS NOT NULL),
        '[]'::json
    ) AS mentions,
    -- Get user's reaction if authenticated
    cr.reaction_type AS user_reaction
FROM comment_tree ct
LEFT JOIN comment_mentions cm ON ct.id = cm.comment_id
LEFT JOIN users mu ON cm.mentioned_user_id = mu.id
LEFT JOIN comment_reactions cr ON ct.id = cr.comment_id
    AND cr.user_id = $2  -- Current user ID parameter (NULL if not authenticated)
GROUP BY
    ct.id, ct.post_id, ct.author_id, ct.parent_comment_id,
    ct.content, ct.path, ct.depth, ct.likes_count, ct.replies_count,
    ct.is_deleted, ct.deleted_by, ct.edited_at, ct.created_at, ct.updated_at,
    ct.author_username, ct.author_avatar, ct.sort_date, ct.sort_path,
    cr.reaction_type
ORDER BY ct.sort_path;

-- Query Complexity: O(n) where n is total comments
-- Single database roundtrip loads entire tree
```

### Materialized Path Pattern

The materialized path stores the full ancestor chain in a single column:

```
Example Comment Tree:
- Comment A (id: aaa-111) → path: "aaa-111"
  - Reply B (id: bbb-222) → path: "aaa-111/bbb-222"
    - Reply C (id: ccc-333) → path: "aaa-111/bbb-222/ccc-333"
  - Reply D (id: ddd-444) → path: "aaa-111/ddd-444"

Benefits:
1. Single query to find all descendants: WHERE path LIKE 'aaa-111%'
2. Direct depth calculation: depth = count('/') in path
3. No recursive queries needed for ancestor lookup
4. Efficient indexing with B-tree on (post_id, path)
```

---

## API Architecture

### REST API Endpoints

```yaml
openapi: 3.0.0
info:
  title: Comments API
  version: 1.0.0
  description: Nested comments and discussions API

paths:
  /api/v1/posts/{postId}/comments:
    post:
      summary: Create a new comment or reply
      operationId: createComment
      tags: [Comments]
      security:
        - bearerAuth: []
      parameters:
        - name: postId
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
              required: [content]
              properties:
                content:
                  type: string
                  minLength: 1
                  maxLength: 5000
                  example: "Great post! @johndoe what do you think?"
                parent_comment_id:
                  type: string
                  format: uuid
                  nullable: true
                  description: "Null for top-level comment, UUID for reply"
      responses:
        201:
          description: Comment created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Comment'
        400:
          description: Validation error (max depth, invalid parent, etc.)
        401:
          description: Unauthorized
        404:
          description: Post not found
        429:
          description: Rate limit exceeded (100 comments per hour)

    get:
      summary: Get comment tree for a post
      operationId: getCommentTree
      tags: [Comments]
      parameters:
        - name: postId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: sort
          in: query
          schema:
            type: string
            enum: [newest, oldest, popular]
            default: newest
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 50
        - name: offset
          in: query
          schema:
            type: integer
            minimum: 0
            default: 0
      responses:
        200:
          description: Comment tree loaded successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  comments:
                    type: array
                    items:
                      $ref: '#/components/schemas/CommentTree'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
                  total_count:
                    type: integer

  /api/v1/comments/{commentId}:
    get:
      summary: Get single comment with context
      operationId: getComment
      tags: [Comments]
      parameters:
        - name: commentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        200:
          description: Comment retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Comment'
        404:
          description: Comment not found

    patch:
      summary: Edit comment (within 5 minutes)
      operationId: updateComment
      tags: [Comments]
      security:
        - bearerAuth: []
      parameters:
        - name: commentId
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
              required: [content]
              properties:
                content:
                  type: string
                  minLength: 1
                  maxLength: 5000
      responses:
        200:
          description: Comment updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Comment'
        400:
          description: Edit window expired (>5 minutes)
        401:
          description: Unauthorized
        403:
          description: Not the comment author
        404:
          description: Comment not found

    delete:
      summary: Soft delete comment
      operationId: deleteComment
      tags: [Comments]
      security:
        - bearerAuth: []
      parameters:
        - name: commentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        200:
          description: Comment deleted successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                    example: "Comment deleted successfully"
                  deleted_by:
                    type: string
                    enum: [author, post_owner, moderator]
        401:
          description: Unauthorized
        403:
          description: Forbidden (not author, post owner, or moderator)
        404:
          description: Comment not found

  /api/v1/comments/{commentId}/reactions:
    post:
      summary: Add or update reaction to comment
      operationId: addReaction
      tags: [Reactions]
      security:
        - bearerAuth: []
      parameters:
        - name: commentId
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
              required: [reaction_type]
              properties:
                reaction_type:
                  type: string
                  enum: [like, love, laugh, wow, sad, angry]
      responses:
        200:
          description: Reaction added/updated successfully
        401:
          description: Unauthorized
        404:
          description: Comment not found

    delete:
      summary: Remove reaction from comment
      operationId: removeReaction
      tags: [Reactions]
      security:
        - bearerAuth: []
      parameters:
        - name: commentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        200:
          description: Reaction removed successfully
        401:
          description: Unauthorized
        404:
          description: Comment or reaction not found

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Comment:
      type: object
      properties:
        id:
          type: string
          format: uuid
        post_id:
          type: string
          format: uuid
        author:
          $ref: '#/components/schemas/CommentAuthor'
        parent_comment_id:
          type: string
          format: uuid
          nullable: true
        content:
          type: string
        path:
          type: string
          description: "Materialized path (internal use)"
        depth:
          type: integer
          minimum: 0
          maximum: 2
        likes_count:
          type: integer
        replies_count:
          type: integer
        is_deleted:
          type: boolean
        deleted_by:
          type: string
          enum: [author, post_owner, moderator]
          nullable: true
        mentions:
          type: array
          items:
            $ref: '#/components/schemas/Mention'
        user_reaction:
          type: string
          enum: [like, love, laugh, wow, sad, angry]
          nullable: true
        can_edit:
          type: boolean
          description: "Can current user edit (author + within 5 min)"
        can_delete:
          type: boolean
          description: "Can current user delete"
        edited_at:
          type: string
          format: date-time
          nullable: true
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    CommentTree:
      allOf:
        - $ref: '#/components/schemas/Comment'
        - type: object
          properties:
            replies:
              type: array
              items:
                $ref: '#/components/schemas/CommentTree'

    CommentAuthor:
      type: object
      properties:
        id:
          type: string
          format: uuid
        username:
          type: string
        avatar_url:
          type: string
          nullable: true

    Mention:
      type: object
      properties:
        user_id:
          type: string
          format: uuid
        username:
          type: string

    Pagination:
      type: object
      properties:
        limit:
          type: integer
        offset:
          type: integer
        has_more:
          type: boolean
```

---

## Sequence Diagrams

### 1. Create Top-Level Comment

```
User          Controller       Service         Repository      Database      NotificationService
  │               │               │                │               │                  │
  │──POST /comments─>│            │                │               │                  │
  │               │               │                │               │                  │
  │               │──validate()──>│                │               │                  │
  │               │<──valid───────┤                │               │                  │
  │               │               │                │               │                  │
  │               │───────────createComment()────>│                │                  │
  │               │               │                │               │                  │
  │               │               │─────────────findPost()───────>│                  │
  │               │               │<──────────post exists─────────┤                  │
  │               │               │                │               │                  │
  │               │               │───────────extractMentions()   │                  │
  │               │               │<──────────@mentions[]         │                  │
  │               │               │                │               │                  │
  │               │               │────────BEGIN TRANSACTION──────>│                  │
  │               │               │                │               │                  │
  │               │               │────────────INSERT comment─────>│                  │
  │               │               │                │  (depth=0,    │                  │
  │               │               │                │   path=id)    │                  │
  │               │               │<───────────comment created────┤                  │
  │               │               │                │               │                  │
  │               │               │─────────INSERT mentions───────>│                  │
  │               │               │<──────────mentions created────┤                  │
  │               │               │                │               │                  │
  │               │               │────────INCREMENT post.comments_count──>│         │
  │               │               │<───────────updated────────────┤                  │
  │               │               │                │               │                  │
  │               │               │─────────COMMIT TRANSACTION────>│                  │
  │               │               │                │               │                  │
  │               │               │─────────publishEvent()──────────────────────────>│
  │               │               │              (commentCreated,  │                  │
  │               │               │               mentionCreated)  │                  │
  │               │               │                │               │                  │
  │               │<──────────comment object──────┤                │                  │
  │               │                                                 │                  │
  │<─201 Created──┤                                                 │                  │
  │  (comment)    │                                                 │                  │
  │               │                                                 │                  │
  │               │                                                 │    ┌─────────────┤
  │               │                                                 │    │Send notifications
  │               │                                                 │    │- Post author
  │               │                                                 │    │- Mentioned users
  │               │                                                 │    └────────────>│
```

### 2. Create Reply (Nested Comment)

```
User          Controller       Service         Repository      Database
  │               │               │                │               │
  │──POST /comments (with parent_id)──>│           │               │
  │               │               │                │               │
  │               │──validate()──>│                │               │
  │               │<──valid───────┤                │               │
  │               │               │                │               │
  │               │───────────createComment()────>│                │
  │               │               │                │               │
  │               │               │──────────findParent()─────────>│
  │               │               │<──────parent (depth=1, path)──┤
  │               │               │                │               │
  │               │               │──validateDepth()               │
  │               │               │  (parent.depth + 1 <= 2) ✓     │
  │               │               │                │               │
  │               │               │────────BEGIN TRANSACTION──────>│
  │               │               │                │               │
  │               │               │────────────INSERT comment─────>│
  │               │               │  (depth=2,     │               │
  │               │               │   path="parent_path/new_id")   │
  │               │               │<───────comment created─────────┤
  │               │               │                │               │
  │               │               │──────INCREMENT parent.replies_count──>│
  │               │               │<───────updated─────────────────┤
  │               │               │                │               │
  │               │               │─────────COMMIT TRANSACTION────>│
  │               │               │                │               │
  │               │<──────────comment object──────┤                │
  │               │                                │                │
  │<─201 Created──┤                                │                │
```

### 3. Load Comment Tree

```
User          Controller       Service         Repository      Database
  │               │               │                │               │
  │──GET /posts/{id}/comments───>│                │               │
  │               │               │                │               │
  │               │──validate()──>│                │               │
  │               │<──valid───────┤                │               │
  │               │               │                │               │
  │               │───────getCommentTree()────────>│               │
  │               │               │                │               │
  │               │               │──────findTreeByPostId()───────>│
  │               │               │   (Recursive CTE)              │
  │               │               │   WITH RECURSIVE...            │
  │               │               │<──flat array of comments──────┤
  │               │               │   with mentions & reactions    │
  │               │               │                │               │
  │               │               │──buildTree()   │               │
  │               │               │  (group by parent)             │
  │               │               │                │               │
  │               │               │──calculatePermissions()        │
  │               │               │  (can_edit, can_delete)        │
  │               │               │                │               │
  │               │<─────────tree structure───────┤                │
  │               │                                │                │
  │<─200 OK───────┤                                │                │
  │  {comments: [ │                                │                │
  │    {id, content, replies: [...]} ]            │                │
  │   }           │                                │                │
```

### 4. Edit Comment

```
User          Controller       Service         Repository      Database
  │               │               │                │               │
  │──PATCH /comments/{id}────────>│                │               │
  │               │               │                │               │
  │               │──authorize()─>│                │               │
  │               │               │                │               │
  │               │               │──────────findById()───────────>│
  │               │               │<──────comment─────────────────┤
  │               │               │                │               │
  │               │               │──checkEditWindow()             │
  │               │               │  (created_at + 5min > now) ✓   │
  │               │               │                │               │
  │               │               │──checkOwnership()              │
  │               │               │  (comment.author_id == user_id)✓│
  │               │               │                │               │
  │               │               │──────────update()─────────────>│
  │               │               │  SET content = $1,             │
  │               │               │      edited_at = NOW()         │
  │               │               │  WHERE id = $2                 │
  │               │               │<──────updated comment─────────┤
  │               │               │                │               │
  │               │<──────────comment object──────┤                │
  │               │                                │                │
  │<─200 OK───────┤                                │                │
```

### 5. Soft Delete Comment

```
User          Controller       Service         Repository      Database
  │               │               │                │               │
  │──DELETE /comments/{id}───────>│                │               │
  │               │               │                │               │
  │               │──authorize()─>│                │               │
  │               │               │                │               │
  │               │               │──────────findById()───────────>│
  │               │               │<──────comment─────────────────┤
  │               │               │                │               │
  │               │               │──checkPermissions()            │
  │               │               │  (author OR post_owner OR mod) │
  │               │               │                │               │
  │               │               │──determineDeletedBy()          │
  │               │               │  → 'author'    │               │
  │               │               │                │               │
  │               │               │────────BEGIN TRANSACTION──────>│
  │               │               │                │               │
  │               │               │──────────softDelete()─────────>│
  │               │               │  UPDATE comments               │
  │               │               │  SET is_deleted = TRUE,        │
  │               │               │      deleted_by = 'author',    │
  │               │               │      content = '[deleted]'     │
  │               │               │  WHERE id = $1                 │
  │               │               │<──────updated─────────────────┤
  │               │               │                │               │
  │               │               │──────DECREMENT post.comments_count──>│
  │               │               │<──────updated─────────────────┤
  │               │               │                │               │
  │               │               │──IF parent_id: DECREMENT parent.replies_count─>│
  │               │               │<──────updated─────────────────┤
  │               │               │                │               │
  │               │               │─────────COMMIT TRANSACTION────>│
  │               │               │                │               │
  │               │<──────────success─────────────┤                │
  │               │                                │                │
  │<─200 OK───────┤                                │                │
  │  {message: "Comment deleted", deleted_by: "author"}            │
```

### 6. Add Reaction to Comment

```
User          Controller       Service         Repository      Database
  │               │               │                │               │
  │──POST /comments/{id}/reactions──>│             │               │
  │  {reaction_type: 'like'}    │    │             │               │
  │               │               │                │               │
  │               │───────────addReaction()───────>│               │
  │               │               │                │               │
  │               │               │────────BEGIN TRANSACTION──────>│
  │               │               │                │               │
  │               │               │──────────upsertReaction()─────>│
  │               │               │  INSERT INTO comment_reactions │
  │               │               │  (comment_id, user_id, type)   │
  │               │               │  ON CONFLICT (comment_id, user_id)│
  │               │               │  DO UPDATE SET reaction_type = $3│
  │               │               │<──reaction (is_new=true)──────┤
  │               │               │                │               │
  │               │               │──IF is_new: INCREMENT comment.likes_count─>│
  │               │               │  UPDATE comments               │
  │               │               │  SET likes_count = likes_count + 1│
  │               │               │  WHERE id = $1                 │
  │               │               │<──────updated─────────────────┤
  │               │               │                │               │
  │               │               │─────────COMMIT TRANSACTION────>│
  │               │               │                │               │
  │               │<──────────success─────────────┤                │
  │               │                                │                │
  │<─200 OK───────┤                                │                │
```

---

## Security Architecture

### Authentication & Authorization

```yaml
authentication:
  method: JWT Bearer Token
  token_location: Authorization header
  token_format: "Bearer {jwt_token}"

authorization:
  comment_create:
    - Authenticated user
    - Post exists and not deleted
    - Rate limit: 100 comments per hour per user

  comment_edit:
    - Authenticated user
    - Comment author only
    - Within 5 minutes of creation
    - Comment not deleted

  comment_delete:
    permissions:
      - Comment author (anytime)
      - Post owner (anytime)
      - Moderator (anytime)
    soft_delete_marker:
      - Content replaced with "[deleted]"
      - is_deleted flag set to TRUE
      - deleted_by enum set appropriately

  comment_view:
    - Public (no authentication required)
    - Deleted comments show "[deleted]" placeholder
    - Child replies remain visible
```

### Input Validation & Sanitization

```javascript
// Content Security
const validateCommentContent = (content) => {
  // 1. Length validation
  if (!content || content.length < 1 || content.length > 5000) {
    throw new ValidationError('Content must be 1-5000 characters');
  }

  // 2. XSS prevention - sanitize HTML
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
  });

  // 3. SQL injection prevention - use parameterized queries
  // (handled by ORM/query builder)

  // 4. Unicode normalization
  const normalized = sanitized.normalize('NFC');

  return normalized;
};

// Mention validation
const validateMentions = (mentions) => {
  // Limit to 10 mentions
  if (mentions.length > 10) {
    throw new ValidationError('Maximum 10 mentions per comment');
  }

  // Validate username format
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  for (const mention of mentions) {
    if (!usernameRegex.test(mention)) {
      throw new ValidationError(`Invalid username: ${mention}`);
    }
  }

  return mentions;
};
```

### Rate Limiting

```yaml
rate_limits:
  comment_creation:
    limit: 100
    window: 1 hour
    scope: per_user

  reaction_actions:
    limit: 500
    window: 1 hour
    scope: per_user

  comment_tree_loading:
    limit: 1000
    window: 1 hour
    scope: per_ip

implementation:
  strategy: Token bucket
  storage: Redis
  headers:
    - X-RateLimit-Limit
    - X-RateLimit-Remaining
    - X-RateLimit-Reset
```

### Data Privacy

```yaml
data_privacy:
  pii_handling:
    - User IDs are UUIDs (no sequential enumeration)
    - No email addresses exposed in API responses
    - Soft delete preserves anonymized content

  gdpr_compliance:
    right_to_erasure:
      - Hard delete all user comments
      - Replace content with "[deleted by user request]"
      - Maintain referential integrity

    data_export:
      - User can export all their comments
      - Format: JSON with full metadata

  audit_logging:
    - Log all delete operations with actor
    - Log all edit operations with timestamps
    - Retention: 90 days
```

---

## Performance Architecture

### Query Optimization

```sql
-- Optimized Comment Tree Query with EXPLAIN ANALYZE
-- Expected: ~50ms for 100 comments with 3 levels

EXPLAIN ANALYZE
WITH RECURSIVE comment_tree AS (
    -- Uses index: idx_comments_post_created
    SELECT * FROM comments
    WHERE post_id = $1
        AND parent_comment_id IS NULL
        AND is_deleted = FALSE

    UNION ALL

    -- Uses index: idx_comments_parent
    SELECT c.* FROM comments c
    JOIN comment_tree ct ON c.parent_comment_id = ct.id
    WHERE c.is_deleted = FALSE
)
SELECT * FROM comment_tree;

-- Expected EXPLAIN output:
-- Nested Loop (cost=0.42..152.34 rows=100 width=256) (actual time=0.123..45.678 rows=100 loops=1)
--   -> Index Scan using idx_comments_post_created (cost=0.42..52.34 rows=30 width=256)
--   -> CTE Scan on comment_tree (cost=0.00..100.00 rows=70 width=256)
```

### Caching Strategy

```yaml
caching:
  layers:
    application_cache:
      technology: Redis
      ttl_strategy:
        - comment_tree: 60 seconds
        - single_comment: 5 minutes
        - mention_list: 10 minutes

      cache_keys:
        - "comment:tree:post:{post_id}:sort:{sort}" → Comment tree
        - "comment:{comment_id}" → Single comment
        - "comment:mentions:{comment_id}" → Mentions array

      invalidation:
        - On comment create: Invalidate tree for post
        - On comment edit: Invalidate single comment
        - On comment delete: Invalidate tree + single
        - On reaction add/remove: Invalidate single comment

    database_cache:
      - PostgreSQL query cache
      - Shared buffers: 256MB
      - Effective cache size: 1GB

  cache_warming:
    - Pre-load popular post comment trees
    - Async background job every 5 minutes
    - Top 100 posts by recent activity
```

### Database Indexing Strategy

```sql
-- Primary indexes for comment queries
CREATE INDEX idx_comments_post_created ON comments(post_id, created_at DESC);
-- Used for: Loading recent comments for a post

CREATE INDEX idx_comments_post_path ON comments(post_id, path);
-- Used for: Recursive tree traversal with materialized path

CREATE INDEX idx_comments_parent ON comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
-- Used for: Finding replies to a specific comment

CREATE INDEX idx_comments_author ON comments(author_id);
-- Used for: Loading user's comment history

CREATE INDEX idx_comments_likes ON comments(likes_count DESC) WHERE is_deleted = FALSE;
-- Used for: Sorting by popularity

-- Partial index for active comments only
CREATE INDEX idx_comments_active_post ON comments(post_id, created_at DESC)
WHERE is_deleted = FALSE;
-- Used for: Loading only non-deleted comments (most common query)

-- Index maintenance
-- Reindex weekly during low traffic hours
-- Monitor index bloat with pg_stat_user_indexes
```

### Connection Pooling

```yaml
database_connection_pool:
  library: pg-pool
  configuration:
    min_connections: 10
    max_connections: 50
    idle_timeout: 30000  # 30 seconds
    connection_timeout: 5000  # 5 seconds
    max_lifetime: 3600000  # 1 hour

  monitoring:
    - Track pool size utilization
    - Alert if > 80% connections used
    - Log slow queries (> 100ms)
```

### Pagination Strategy

```javascript
// Cursor-based pagination for comment trees
// More efficient than offset-based for large datasets

const paginateComments = async (postId, cursor = null, limit = 50) => {
  const query = `
    SELECT * FROM comments
    WHERE post_id = $1
      AND parent_comment_id IS NULL
      AND is_deleted = FALSE
      ${cursor ? 'AND created_at < $3' : ''}
    ORDER BY created_at DESC
    LIMIT $2
  `;

  const params = cursor
    ? [postId, limit, cursor]
    : [postId, limit];

  const comments = await db.query(query, params);

  const nextCursor = comments.length === limit
    ? comments[comments.length - 1].created_at
    : null;

  return {
    comments,
    pagination: {
      next_cursor: nextCursor,
      has_more: nextCursor !== null,
    },
  };
};
```

---

## Scalability Design

### Horizontal Scaling

```yaml
service_scaling:
  comment_service:
    replicas: 3-10
    autoscaling:
      metric: CPU utilization
      target: 70%
      min_replicas: 3
      max_replicas: 10

    load_balancer:
      algorithm: Round robin
      health_check: /health
      interval: 10s

  stateless_design:
    - No in-memory session storage
    - Use JWT for authentication
    - Cache in shared Redis cluster
```

### Database Scaling

```yaml
database_architecture:
  primary:
    role: Write operations
    instance: PostgreSQL 14
    specs: 8 CPU, 32GB RAM, SSD

  read_replicas:
    count: 2
    role: Read operations (comment tree loading)
    replication: Asynchronous
    lag_tolerance: < 100ms

  connection_routing:
    writes:
      - Comment create
      - Comment edit
      - Comment delete
      - Reaction add/remove
      → Route to PRIMARY

    reads:
      - Comment tree loading
      - Single comment fetch
      - User comment history
      → Route to READ REPLICAS (round robin)

  partitioning_strategy:
    table: comments
    partition_by: Range on created_at
    partition_size: Monthly
    retention: 2 years

    example:
      - comments_2025_01 (created_at >= 2025-01-01 AND < 2025-02-01)
      - comments_2025_02 (created_at >= 2025-02-01 AND < 2025-03-01)

    benefits:
      - Faster queries on recent data
      - Easy archival of old partitions
      - Improved vacuum performance
```

### Sharding Strategy (Future)

```yaml
sharding:
  trigger: When single database exceeds 500GB or 10M comments/day

  strategy: Hash sharding by post_id
  shard_count: 4

  shard_key_calculation:
    key: post_id
    function: "CRC32(post_id) % 4"

  routing:
    - Comment operations always use post_id
    - Route to shard based on hash
    - No cross-shard joins required

  benefits:
    - Linear scalability
    - Isolated post comment trees
    - No cross-shard queries needed
```

### Cache Architecture

```
┌───────────────────────────────────────────────────┐
│              Application Servers                   │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │  API Node 1 │  │  API Node 2 │  │ API Node 3│ │
│  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │
└─────────┼─────────────────┼────────────────┼───────┘
          │                 │                │
          └─────────────────┼────────────────┘
                            │
          ┌─────────────────▼─────────────────┐
          │       Redis Cluster (Cache)       │
          │  ┌──────────┐  ┌──────────┐       │
          │  │ Master   │──│ Replica  │       │
          │  └──────────┘  └──────────┘       │
          │  Shared cache for all API nodes   │
          └─────────────────┬─────────────────┘
                            │
                            │ Cache miss
                            │
          ┌─────────────────▼─────────────────┐
          │     PostgreSQL Cluster            │
          │  ┌──────────┐  ┌──────────┐       │
          │  │ Primary  │──│ Replica  │       │
          │  └──────────┘  └──────────┘       │
          └───────────────────────────────────┘
```

### Event-Driven Architecture

```yaml
events:
  comment_created:
    payload:
      - comment_id
      - post_id
      - author_id
      - parent_comment_id
      - content_preview (100 chars)
      - created_at

    consumers:
      - Notification Service → Notify post author
      - WebSocket Service → Broadcast to connected clients
      - Analytics Service → Track engagement metrics

  mention_created:
    payload:
      - mention_id
      - comment_id
      - mentioned_user_id
      - author_id

    consumers:
      - Notification Service → Notify mentioned user
      - WebSocket Service → Real-time mention alert

  reaction_added:
    payload:
      - reaction_id
      - comment_id
      - user_id
      - reaction_type

    consumers:
      - WebSocket Service → Update UI in real-time
      - Analytics Service → Track reaction patterns

message_broker:
  technology: RabbitMQ or AWS SNS/SQS
  pattern: Pub/Sub
  guarantee: At-least-once delivery
  retry_policy: Exponential backoff (3 attempts)
```

---

## Integration Points

### M3 Notification System Integration

```javascript
// Publish events to notification service
class CommentEventPublisher {
  async publishCommentCreated(comment) {
    const event = {
      type: 'comment_created',
      payload: {
        comment_id: comment.id,
        post_id: comment.post_id,
        author_id: comment.author_id,
        parent_comment_id: comment.parent_comment_id,
        content_preview: comment.content.substring(0, 100),
        created_at: comment.created_at,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
      },
    };

    await this.messageQueue.publish('notifications', event);
  }

  async publishMentionCreated(mention, comment) {
    const event = {
      type: 'mention_created',
      payload: {
        mention_id: mention.id,
        comment_id: mention.comment_id,
        mentioned_user_id: mention.mentioned_user_id,
        author_id: comment.author_id,
        post_id: comment.post_id,
        content_preview: comment.content.substring(0, 100),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
      },
    };

    await this.messageQueue.publish('notifications', event);
  }
}
```

### WebSocket Integration (M3)

```javascript
// Real-time comment updates via WebSocket
class CommentWebSocketHandler {
  async broadcastNewComment(comment, postId) {
    // Send to all clients subscribed to this post
    await this.wsServer.sendToRoom(`post:${postId}`, {
      type: 'comment_added',
      data: {
        comment: this.formatCommentForClient(comment),
      },
    });
  }

  async broadcastCommentUpdate(comment) {
    // Send to all clients subscribed to this post
    await this.wsServer.sendToRoom(`post:${comment.post_id}`, {
      type: 'comment_updated',
      data: {
        comment_id: comment.id,
        content: comment.content,
        edited_at: comment.edited_at,
      },
    });
  }

  async broadcastCommentDeleted(commentId, postId) {
    await this.wsServer.sendToRoom(`post:${postId}`, {
      type: 'comment_deleted',
      data: {
        comment_id: commentId,
      },
    });
  }
}
```

---

## Deployment Architecture

```yaml
infrastructure:
  kubernetes:
    namespace: comments-service

    deployments:
      comment-api:
        replicas: 3
        image: comments-api:1.0.0
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi

        env:
          - DATABASE_URL (from secret)
          - REDIS_URL (from secret)
          - JWT_SECRET (from secret)
          - RATE_LIMIT_ENABLED: "true"

        health_checks:
          liveness: /health
          readiness: /ready

    services:
      comment-api-service:
        type: ClusterIP
        port: 80
        targetPort: 3000

    ingress:
      host: api.example.com
      paths:
        - /api/v1/comments
        - /api/v1/posts/*/comments

      tls:
        enabled: true
        certificate: letsencrypt

  database:
    provider: AWS RDS PostgreSQL
    version: "14.7"
    instance_class: db.r5.xlarge
    storage: 500GB SSD
    multi_az: true
    backup_retention: 7 days

  cache:
    provider: AWS ElastiCache Redis
    version: "7.0"
    node_type: cache.r5.large
    cluster_mode: enabled
    shards: 2
    replicas_per_shard: 1

  monitoring:
    prometheus:
      - Comment creation rate
      - Comment tree load latency
      - Cache hit rate
      - Database query duration

    grafana_dashboards:
      - Comments Overview
      - Performance Metrics
      - Error Rates

    alerts:
      - Comment creation latency > 500ms
      - Cache hit rate < 80%
      - Database connection pool > 80%
      - Error rate > 1%
```

---

## Technology Stack

```yaml
backend:
  runtime: Node.js 18 LTS
  framework: NestJS 10
  language: TypeScript 5

database:
  primary: PostgreSQL 14+
  cache: Redis 7

api:
  protocol: REST
  format: JSON
  versioning: URI versioning (/api/v1)

message_queue:
  technology: RabbitMQ 3.12
  protocol: AMQP

monitoring:
  metrics: Prometheus
  logs: ELK Stack (Elasticsearch, Logstash, Kibana)
  tracing: OpenTelemetry

testing:
  unit: Jest
  integration: Supertest
  e2e: Playwright
  load: k6
```

---

## Architecture Decision Records (ADRs)

### ADR-001: Materialized Path over Nested Set

**Decision**: Use materialized path pattern for comment tree structure.

**Rationale**:
- Simpler to implement and understand
- Easier to add new comments (no need to update multiple rows)
- Efficient tree queries with string prefix matching
- Direct depth calculation

**Trade-offs**:
- Path string storage overhead (~100 bytes per comment)
- Path update needed if parent changes (rare operation)

### ADR-002: Recursive CTE for Tree Loading

**Decision**: Use PostgreSQL recursive CTE to load entire comment tree in single query.

**Rationale**:
- Eliminates N+1 query problem
- Leverages database efficiency for tree traversal
- ~50ms to load 100 comments vs 100+ queries

**Trade-offs**:
- Requires PostgreSQL 14+ (or equivalent CTE support)
- More complex SQL query

### ADR-003: Soft Delete with Content Preservation

**Decision**: Soft delete comments, replace content with "[deleted]", keep replies visible.

**Rationale**:
- Preserves conversation context
- Maintains tree structure integrity
- Allows moderation audit trail
- Users understand what was deleted

**Trade-offs**:
- Deleted content still exists in database
- Requires GDPR-compliant hard delete process

### ADR-004: Atomic Counters at Database Level

**Decision**: Use database-level atomic increments for likes_count and replies_count.

**Rationale**:
- Guarantees consistency under concurrent updates
- No race conditions
- Simpler than distributed counter systems

**Trade-offs**:
- Write contention on popular comments
- May need eventual consistency for extreme scale

---

## Next Steps (Phase 4: Refinement)

1. **TDD Implementation**
   - Write unit tests for CommentService
   - Write integration tests for CommentRepository
   - Write E2E tests for API endpoints

2. **Performance Testing**
   - Load test comment creation (1000 concurrent users)
   - Benchmark comment tree loading (various tree sizes)
   - Stress test atomic counters

3. **Security Audit**
   - Penetration testing for XSS vulnerabilities
   - SQL injection testing
   - Rate limit bypass attempts

4. **Integration Testing**
   - Test notification event publishing
   - Test WebSocket real-time updates
   - Test mention extraction accuracy

---

**Document Status**: 🏗️ ARCHITECTURE DRAFT - Ready for Phase 4 (Refinement & TDD)

**Total Lines**: 798

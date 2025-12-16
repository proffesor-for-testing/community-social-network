# M4 Comments System - Pseudocode Design
## SPARC Phase 2: Pseudocode

**Document Version:** 1.0.0
**Created:** 2025-12-16
**Status:** ✅ PSEUDOCODE COMPLETE
**Milestone:** M4 - Comments & Nested Discussions
**Phase:** SPARC Phase 2 (Pseudocode)

---

## Table of Contents

1. [Overview](#overview)
2. [Data Structures](#data-structures)
3. [Core Algorithms](#core-algorithms)
4. [Mention System](#mention-system)
5. [Comment Reactions](#comment-reactions)
6. [Comment Tree Operations](#comment-tree-operations)
7. [Complexity Analysis](#complexity-analysis)

---

## Overview

### System Requirements
- **Max Nesting Depth:** 3 levels (post → comment → reply → reply)
- **Performance Target:** Load 100 comments in <1 second
- **Query Efficiency:** Single query for entire tree (no N+1)
- **Mention Limit:** Maximum 10 mentions per comment
- **Edit Window:** 5 minutes after creation

### Key Design Patterns
- **Materialized Path Pattern:** For efficient tree traversal
- **Recursive CTE:** For loading comment trees
- **Atomic Counters:** For likes and reply counts
- **Soft Delete:** Preserve tree structure when comments deleted

---

## Data Structures

### Comment Data Structure

```
STRUCTURE: Comment
  id: UUID
  post_id: UUID (foreign key to posts)
  author_id: UUID (foreign key to users)
  parent_comment_id: UUID (nullable, NULL for top-level)
  content: TEXT (max 5000 characters)
  path: VARCHAR(500) (materialized path: "parent1/parent2/comment_id")
  depth: INTEGER (0=top-level, 1=first reply, 2=second reply)
  likes_count: INTEGER (default 0, indexed)
  replies_count: INTEGER (default 0)
  is_deleted: BOOLEAN (default FALSE)
  deleted_by: ENUM('author', 'post_owner', 'moderator') (nullable)
  edited_at: TIMESTAMP (nullable)
  created_at: TIMESTAMP
  updated_at: TIMESTAMP

  INDEXES:
    - PRIMARY KEY (id)
    - INDEX (post_id, created_at DESC) -- For pagination
    - INDEX (post_id, path) -- For tree queries
    - INDEX (author_id) -- For user's comments
    - INDEX (parent_comment_id) -- For reply lookups
END STRUCTURE

STRUCTURE: CommentMention
  id: UUID
  comment_id: UUID (foreign key to comments)
  mentioned_user_id: UUID (foreign key to users)
  created_at: TIMESTAMP

  INDEXES:
    - PRIMARY KEY (id)
    - UNIQUE (comment_id, mentioned_user_id)
    - INDEX (mentioned_user_id) -- For user's mentions
END STRUCTURE

STRUCTURE: CommentReaction
  id: UUID
  comment_id: UUID (foreign key to comments)
  user_id: UUID (foreign key to users)
  reaction_type: ENUM('like', 'love', 'laugh', 'wow', 'sad', 'angry')
  created_at: TIMESTAMP

  INDEXES:
    - PRIMARY KEY (id)
    - UNIQUE (comment_id, user_id) -- One reaction per user per comment
    - INDEX (comment_id, reaction_type) -- For reaction counts
END STRUCTURE

STRUCTURE: CommentTree (In-Memory)
  comment: Comment
  replies: ARRAY of CommentTree
  mention_usernames: ARRAY of STRING
  user_reaction: NULLABLE ReactionType
  can_edit: BOOLEAN
  can_delete: BOOLEAN
END STRUCTURE
```

---

## Core Algorithms

### 1. Create Comment

```
ALGORITHM: CreateComment
INPUT:
  post_id (UUID)
  author_id (UUID)
  content (STRING)
  parent_comment_id (UUID, nullable)
OUTPUT:
  comment (Comment object) or error

PRECONDITIONS:
  - User is authenticated
  - Post exists and is not deleted
  - Content length is 1-5000 characters
  - If parent_comment_id provided, parent exists and depth < 2

POSTCONDITIONS:
  - Comment is created with correct path and depth
  - Post comments_count incremented
  - Parent replies_count incremented (if parent exists)
  - Mentions are parsed and notifications sent
  - Post author notified (unless they are the commenter)

BEGIN
  // Step 1: Validate post exists
  post ← Database.findPostById(post_id)
  IF post is NULL OR post.is_deleted THEN
    RETURN error("Post not found", 404)
  END IF

  // Step 2: Validate content
  content ← Sanitize(content) // XSS prevention
  IF length(content) < 1 OR length(content) > 5000 THEN
    RETURN error("Content must be 1-5000 characters", 400)
  END IF

  // Step 3: Calculate path and depth
  IF parent_comment_id is NULL THEN
    // Top-level comment
    depth ← 0
    parent_path ← ""
  ELSE
    // Reply to existing comment
    parent ← Database.findCommentById(parent_comment_id)

    IF parent is NULL OR parent.is_deleted THEN
      RETURN error("Parent comment not found", 404)
    END IF

    IF parent.post_id ≠ post_id THEN
      RETURN error("Parent comment belongs to different post", 400)
    END IF

    depth ← parent.depth + 1

    IF depth > 2 THEN
      RETURN error("Maximum nesting depth (3 levels) exceeded", 400)
    END IF

    parent_path ← parent.path
  END IF

  // Step 4: Create comment
  comment_id ← GenerateUUID()

  IF parent_path is EMPTY THEN
    path ← comment_id
  ELSE
    path ← parent_path + "/" + comment_id
  END IF

  // Step 5: Begin transaction
  BEGIN TRANSACTION

    // Insert comment
    comment ← Database.insert(comments, {
      id: comment_id,
      post_id: post_id,
      author_id: author_id,
      parent_comment_id: parent_comment_id,
      content: content,
      path: path,
      depth: depth,
      likes_count: 0,
      replies_count: 0,
      is_deleted: FALSE,
      created_at: NOW(),
      updated_at: NOW()
    })

    // Increment post comments_count
    Database.execute(
      "UPDATE posts SET comments_count = comments_count + 1
       WHERE id = ?",
      [post_id]
    )

    // Increment parent replies_count (if parent exists)
    IF parent_comment_id is NOT NULL THEN
      Database.execute(
        "UPDATE comments SET replies_count = replies_count + 1
         WHERE id = ?",
        [parent_comment_id]
      )
    END IF

  COMMIT TRANSACTION

  // Step 6: Process mentions (async)
  mentions ← ExtractMentions(content)
  IF length(mentions) > 10 THEN
    // Log warning but don't fail
    Logger.warn("Comment has more than 10 mentions", comment_id)
  END IF

  FOR EACH username IN mentions DO
    CreateMentionNotification(username, comment_id, author_id)
  END FOR

  // Step 7: Notify post author (if not self-comment)
  IF post.author_id ≠ author_id THEN
    CreateNotification({
      type: "comment",
      recipient_id: post.author_id,
      actor_id: author_id,
      post_id: post_id,
      comment_id: comment_id
    })
  END IF

  // Step 8: Notify parent author (if reply and not self)
  IF parent_comment_id is NOT NULL AND parent.author_id ≠ author_id THEN
    CreateNotification({
      type: "reply",
      recipient_id: parent.author_id,
      actor_id: author_id,
      comment_id: comment_id
    })
  END IF

  RETURN comment
END

COMPLEXITY: O(1) - All operations are constant time with indexes
SECURITY:
  - Input sanitization prevents XSS
  - Transaction ensures data consistency
  - Depth validation prevents infinite nesting
```

---

### 2. Load Comment Tree (with Recursive CTE)

```
ALGORITHM: LoadCommentTree
INPUT:
  post_id (UUID)
  viewer_id (UUID, nullable)
  sort_order (STRING: "newest", "oldest", "top")
  limit (INTEGER, default 100)
  offset (INTEGER, default 0)
OUTPUT:
  comments_tree (ARRAY of CommentTree)

PRECONDITIONS:
  - Post exists

POSTCONDITIONS:
  - All comments loaded in single query
  - Tree structure properly nested
  - User permissions calculated
  - User reactions included

BEGIN
  // Step 1: Build recursive CTE query
  query ← "
    WITH RECURSIVE comment_tree AS (
      -- Base case: Top-level comments
      SELECT
        c.*,
        u.username,
        u.profile_picture_url,
        ARRAY[c.id] AS path_array,
        0 AS level
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = $1
        AND c.parent_comment_id IS NULL
        AND c.is_deleted = FALSE

      UNION ALL

      -- Recursive case: Replies
      SELECT
        c.*,
        u.username,
        u.profile_picture_url,
        ct.path_array || c.id,
        ct.level + 1
      FROM comments c
      JOIN users u ON c.author_id = u.id
      JOIN comment_tree ct ON c.parent_comment_id = ct.id
      WHERE c.is_deleted = FALSE
        AND ct.level < 2  -- Max depth 2 (0, 1, 2)
    )
    SELECT
      ct.*,
      COALESCE(r.reaction_type, NULL) AS user_reaction
    FROM comment_tree ct
    LEFT JOIN comment_reactions r
      ON r.comment_id = ct.id
      AND r.user_id = $2
    ORDER BY "

  // Step 2: Add sort order
  IF sort_order = "newest" THEN
    query ← query + "ct.created_at DESC"
  ELSE IF sort_order = "oldest" THEN
    query ← query + "ct.created_at ASC"
  ELSE IF sort_order = "top" THEN
    query ← query + "ct.likes_count DESC, ct.created_at DESC"
  ELSE
    query ← query + "ct.created_at DESC" // Default
  END IF

  query ← query + " LIMIT $3 OFFSET $4"

  // Step 3: Execute query
  rows ← Database.query(query, [post_id, viewer_id, limit, offset])

  // Step 4: Build tree structure in memory
  comment_map ← MAP() // Map comment_id to CommentTree
  root_comments ← ARRAY()

  FOR EACH row IN rows DO
    tree_node ← {
      comment: row,
      replies: ARRAY(),
      mention_usernames: ExtractMentionUsernames(row.content),
      user_reaction: row.user_reaction,
      can_edit: CanEditComment(viewer_id, row, NOW()),
      can_delete: CanDeleteComment(viewer_id, row, post.author_id)
    }

    comment_map[row.id] ← tree_node

    IF row.parent_comment_id is NULL THEN
      root_comments.append(tree_node)
    ELSE
      parent_node ← comment_map[row.parent_comment_id]
      IF parent_node is NOT NULL THEN
        parent_node.replies.append(tree_node)
      END IF
    END IF
  END FOR

  RETURN root_comments
END

COMPLEXITY: O(n) where n = number of comments
  - Single query retrieves all comments
  - Tree building is linear pass through results

OPTIMIZATION NOTES:
  - CTE prevents N+1 query problem
  - Index on (post_id, path) makes query efficient
  - LEFT JOIN for reactions adds minimal overhead
```

---

### 3. Delete Comment (Soft Delete with Tree Preservation)

```
ALGORITHM: DeleteComment
INPUT:
  comment_id (UUID)
  user_id (UUID)
  deletion_type (ENUM: "author", "post_owner", "moderator")
OUTPUT:
  success (BOOLEAN) or error

PRECONDITIONS:
  - User is authenticated
  - User has permission to delete (author, post owner, or moderator)
  - Comment exists

POSTCONDITIONS:
  - If comment has replies: Soft delete (content replaced, tree preserved)
  - If comment has no replies: Hard delete (permanent removal)
  - Parent replies_count decremented (if hard delete)
  - Post comments_count decremented (if hard delete)

BEGIN
  // Step 1: Load comment and verify permissions
  comment ← Database.findCommentById(comment_id)

  IF comment is NULL THEN
    RETURN error("Comment not found", 404)
  END IF

  IF comment.is_deleted THEN
    RETURN error("Comment already deleted", 410)
  END IF

  // Step 2: Verify permissions
  has_permission ← FALSE

  IF deletion_type = "author" AND comment.author_id = user_id THEN
    has_permission ← TRUE
    // Check edit window (5 minutes for author)
    IF NOW() - comment.created_at > 5 minutes THEN
      RETURN error("Comments can only be deleted within 5 minutes", 403)
    END IF
  ELSE IF deletion_type = "post_owner" THEN
    post ← Database.findPostById(comment.post_id)
    IF post.author_id = user_id THEN
      has_permission ← TRUE
    END IF
  ELSE IF deletion_type = "moderator" THEN
    // Group-level moderation (M5 integration)
    IF UserIsModerator(user_id, post.group_id) THEN
      has_permission ← TRUE
    END IF
  END IF

  IF NOT has_permission THEN
    RETURN error("Insufficient permissions to delete comment", 403)
  END IF

  // Step 3: Check if comment has replies
  has_replies ← (comment.replies_count > 0)

  BEGIN TRANSACTION

    IF has_replies THEN
      // Soft delete: Preserve tree structure
      Database.update(comments, {
        id: comment_id,
        content: "[deleted]",
        is_deleted: TRUE,
        deleted_by: deletion_type,
        updated_at: NOW()
      })

      // Do NOT decrement counters (replies still exist)

    ELSE
      // Hard delete: No replies, safe to remove
      Database.delete(comments, {id: comment_id})

      // Decrement parent replies_count
      IF comment.parent_comment_id is NOT NULL THEN
        Database.execute(
          "UPDATE comments SET replies_count = replies_count - 1
           WHERE id = ?",
          [comment.parent_comment_id]
        )
      END IF

      // Decrement post comments_count
      Database.execute(
        "UPDATE posts SET comments_count = comments_count - 1
         WHERE id = ?",
        [comment.post_id]
      )

      // Delete associated reactions
      Database.delete(comment_reactions, {comment_id: comment_id})

      // Delete associated mentions
      Database.delete(comment_mentions, {comment_id: comment_id})
    END IF

  COMMIT TRANSACTION

  // Step 4: Log moderation action (if not author)
  IF deletion_type ≠ "author" THEN
    LogModerationAction({
      action: "comment_deleted",
      actor_id: user_id,
      target_comment_id: comment_id,
      reason: deletion_type
    })
  END IF

  RETURN success
END

COMPLEXITY: O(1) - All operations use indexed lookups
SECURITY:
  - Permission checks prevent unauthorized deletion
  - Soft delete preserves discussion context
  - Moderation actions are logged
```

---

### 4. Edit Comment

```
ALGORITHM: EditComment
INPUT:
  comment_id (UUID)
  user_id (UUID)
  new_content (STRING)
OUTPUT:
  updated_comment (Comment) or error

PRECONDITIONS:
  - User is comment author
  - Comment exists and not deleted
  - Edit window has not expired (5 minutes)
  - New content is valid (1-5000 characters)

POSTCONDITIONS:
  - Comment content updated
  - edited_at timestamp set
  - Mentions re-parsed and notifications sent

BEGIN
  // Step 1: Load comment
  comment ← Database.findCommentById(comment_id)

  IF comment is NULL OR comment.is_deleted THEN
    RETURN error("Comment not found", 404)
  END IF

  // Step 2: Verify author
  IF comment.author_id ≠ user_id THEN
    RETURN error("Only comment author can edit", 403)
  END IF

  // Step 3: Check edit window
  time_elapsed ← NOW() - comment.created_at

  IF time_elapsed > 5 minutes THEN
    RETURN error("Comments can only be edited within 5 minutes", 403)
  END IF

  // Step 4: Validate new content
  new_content ← Sanitize(new_content)

  IF length(new_content) < 1 OR length(new_content) > 5000 THEN
    RETURN error("Content must be 1-5000 characters", 400)
  END IF

  // Step 5: Extract mentions from new content
  old_mentions ← ExtractMentions(comment.content)
  new_mentions ← ExtractMentions(new_content)

  IF length(new_mentions) > 10 THEN
    RETURN error("Too many mentions. Maximum 10 per comment.", 400)
  END IF

  // Step 6: Update comment
  BEGIN TRANSACTION

    updated_comment ← Database.update(comments, {
      id: comment_id,
      content: new_content,
      edited_at: NOW(),
      updated_at: NOW()
    })

    // Delete old mentions
    Database.delete(comment_mentions, {comment_id: comment_id})

  COMMIT TRANSACTION

  // Step 7: Process new mentions (async)
  // Only notify newly mentioned users
  added_mentions ← new_mentions - old_mentions

  FOR EACH username IN added_mentions DO
    CreateMentionNotification(username, comment_id, user_id)
  END FOR

  RETURN updated_comment
END

COMPLEXITY: O(m) where m = number of mentions (max 10)
SECURITY:
  - Edit window prevents abuse
  - Content sanitization prevents XSS
  - Only author can edit
```

---

## Mention System

### 5. Extract Mentions from Content

```
ALGORITHM: ExtractMentions
INPUT:
  content (STRING)
OUTPUT:
  usernames (ARRAY of STRING)

BEGIN
  // Regex pattern: @username (3-20 alphanumeric chars + underscore)
  // Must be preceded by space, punctuation, or start of string
  pattern ← '(?:^|[\s\p{P}])@([a-zA-Z0-9_]{3,20})'

  matches ← RegexFindAll(pattern, content)

  usernames ← ARRAY()
  seen ← SET()

  FOR EACH match IN matches DO
    username ← match.group(1).toLowerCase() // Case-insensitive

    // Skip duplicates
    IF username IN seen THEN
      CONTINUE
    END IF

    seen.add(username)
    usernames.append(username)

    // Stop at 10 mentions
    IF length(usernames) >= 10 THEN
      BREAK
    END IF
  END FOR

  RETURN usernames
END

COMPLEXITY: O(n) where n = content length
```

---

### 6. Create Mention Notification

```
ALGORITHM: CreateMentionNotification
INPUT:
  username (STRING)
  comment_id (UUID)
  mentioner_id (UUID)
OUTPUT:
  void (async operation)

BEGIN
  // Step 1: Lookup mentioned user
  user ← Database.findUserByUsername(username)

  IF user is NULL THEN
    Logger.debug("Mentioned user not found", username)
    RETURN // Not an error, just skip
  END IF

  // Step 2: Prevent self-mention
  IF user.id = mentioner_id THEN
    RETURN // Skip self-mentions
  END IF

  // Step 3: Store mention relationship
  BEGIN TRANSACTION
    Database.insert(comment_mentions, {
      id: GenerateUUID(),
      comment_id: comment_id,
      mentioned_user_id: user.id,
      created_at: NOW()
    })
  COMMIT TRANSACTION

  // Step 4: Create notification
  CreateNotification({
    type: "mention",
    recipient_id: user.id,
    actor_id: mentioner_id,
    comment_id: comment_id
  })

END

COMPLEXITY: O(1) - Database lookup with username index
```

---

## Comment Reactions

### 7. Add or Remove Reaction

```
ALGORITHM: ToggleCommentReaction
INPUT:
  comment_id (UUID)
  user_id (UUID)
  reaction_type (ENUM: 'like', 'love', 'laugh', 'wow', 'sad', 'angry')
OUTPUT:
  action_taken (STRING: "added" or "removed")

PRECONDITIONS:
  - User is authenticated
  - Comment exists and not deleted
  - Reaction type is valid

POSTCONDITIONS:
  - Reaction added or removed
  - likes_count updated atomically
  - Comment author notified (if added)

BEGIN
  // Step 1: Verify comment exists
  comment ← Database.findCommentById(comment_id)

  IF comment is NULL OR comment.is_deleted THEN
    RETURN error("Comment not found", 404)
  END IF

  // Step 2: Check if user already reacted
  existing_reaction ← Database.findOne(comment_reactions, {
    comment_id: comment_id,
    user_id: user_id
  })

  BEGIN TRANSACTION

    IF existing_reaction is NOT NULL THEN
      // Remove reaction (toggle off)
      Database.delete(comment_reactions, {id: existing_reaction.id})

      // Decrement counter atomically
      Database.execute(
        "UPDATE comments SET likes_count = likes_count - 1
         WHERE id = ? AND likes_count > 0",
        [comment_id]
      )

      action_taken ← "removed"

    ELSE
      // Add reaction (toggle on)
      Database.insert(comment_reactions, {
        id: GenerateUUID(),
        comment_id: comment_id,
        user_id: user_id,
        reaction_type: reaction_type,
        created_at: NOW()
      })

      // Increment counter atomically
      Database.execute(
        "UPDATE comments SET likes_count = likes_count + 1
         WHERE id = ?",
        [comment_id]
      )

      action_taken ← "added"

      // Notify comment author (async, skip if self-reaction)
      IF comment.author_id ≠ user_id THEN
        CreateNotification({
          type: "comment_reaction",
          recipient_id: comment.author_id,
          actor_id: user_id,
          comment_id: comment_id,
          reaction_type: reaction_type
        })
      END IF
    END IF

  COMMIT TRANSACTION

  RETURN action_taken
END

COMPLEXITY: O(1) - All operations use primary key or unique index
SECURITY:
  - UNIQUE constraint prevents duplicate reactions
  - Atomic counter update prevents race conditions
  - Decrements are bounded (> 0 check)
```

---

## Comment Tree Operations

### 8. Count Total Comments in Tree

```
ALGORITHM: CountCommentsInTree
INPUT:
  post_id (UUID)
OUTPUT:
  total_count (INTEGER)

BEGIN
  // Use denormalized counter on post
  post ← Database.findPostById(post_id)

  IF post is NULL THEN
    RETURN 0
  END IF

  RETURN post.comments_count
END

COMPLEXITY: O(1) - Denormalized counter
NOTE: Counter is maintained by CreateComment and DeleteComment algorithms
```

---

### 9. Get Direct Replies to Comment

```
ALGORITHM: GetDirectReplies
INPUT:
  comment_id (UUID)
  limit (INTEGER, default 10)
  offset (INTEGER, default 0)
OUTPUT:
  replies (ARRAY of Comment)

BEGIN
  query ← "
    SELECT c.*, u.username, u.profile_picture_url
    FROM comments c
    JOIN users u ON c.author_id = u.id
    WHERE c.parent_comment_id = $1
      AND c.is_deleted = FALSE
    ORDER BY c.created_at ASC
    LIMIT $2 OFFSET $3
  "

  replies ← Database.query(query, [comment_id, limit, offset])

  RETURN replies
END

COMPLEXITY: O(log n + k) where k = number of replies
  - Index on parent_comment_id makes lookup O(log n)
  - Fetching k results is O(k)
```

---

### 10. Calculate Comment Path

```
ALGORITHM: CalculateCommentPath
INPUT:
  parent_comment_id (UUID, nullable)
  new_comment_id (UUID)
OUTPUT:
  path (STRING)

BEGIN
  IF parent_comment_id is NULL THEN
    // Top-level comment
    RETURN new_comment_id
  ELSE
    // Get parent path
    parent ← Database.findCommentById(parent_comment_id)

    IF parent is NULL THEN
      RETURN error("Parent comment not found")
    END IF

    // Append new comment ID to parent path
    RETURN parent.path + "/" + new_comment_id
  END IF
END

COMPLEXITY: O(1) - Single database lookup
```

---

## Complexity Analysis

### Time Complexity Summary

| Operation | Best Case | Average Case | Worst Case | Notes |
|-----------|-----------|--------------|------------|-------|
| Create Comment | O(1) | O(1) | O(m) | m = mentions (max 10) |
| Load Comment Tree | O(n) | O(n) | O(n) | n = total comments, single query |
| Delete Comment | O(1) | O(1) | O(1) | Indexed operations only |
| Edit Comment | O(1) | O(m) | O(m) | m = mentions (max 10) |
| Toggle Reaction | O(1) | O(1) | O(1) | Atomic counter update |
| Get Direct Replies | O(log n) | O(log n + k) | O(log n + k) | k = reply count |

### Space Complexity Summary

| Data Structure | Space | Notes |
|----------------|-------|-------|
| Comment (DB) | O(1) | Fixed size per comment |
| Comment Tree (Memory) | O(n) | n = comments loaded |
| Mention Index | O(m) | m = total mentions |
| Reaction Index | O(r) | r = total reactions |

### Query Optimization Strategy

**1. Critical Indexes:**
```sql
CREATE INDEX idx_comments_post_created ON comments(post_id, created_at DESC);
CREATE INDEX idx_comments_post_path ON comments(post_id, path);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id, user_id);
```

**2. Materialized Path Benefits:**
- Single query loads entire tree (no recursive joins)
- Efficient subtree queries (WHERE path LIKE 'parent_id/%')
- Depth calculation is O(1) (stored in column)

**3. Denormalized Counters:**
- `likes_count` on comments (avoids COUNT(*) on reactions)
- `replies_count` on comments (avoids COUNT(*) on children)
- `comments_count` on posts (avoids COUNT(*) on all comments)

**4. Atomic Counter Updates:**
```sql
-- Safe increment (prevents race conditions)
UPDATE comments
SET likes_count = likes_count + 1
WHERE id = ?;

-- Safe decrement (prevents negative counts)
UPDATE comments
SET likes_count = likes_count - 1
WHERE id = ? AND likes_count > 0;
```

---

## Edge Cases & Error Handling

### Nesting Edge Cases

**Case 1: Attempt to reply to level 2 comment (depth 2)**
```
WHEN: User tries to create level 3 reply
THEN: Return 400 "Maximum nesting depth exceeded"
ENSURE: No comment created, no database changes
```

**Case 2: Parent comment deleted during reply creation**
```
WHEN: Parent soft-deleted between validation and insert
THEN: Allow reply creation (parent still exists in DB)
NOTE: UI may need to show "[deleted]" parent
```

**Case 3: Circular path prevention**
```
VALIDATION: Path must not contain comment_id already
CHECK: New comment ID not in parent.path.split('/')
```

### Mention Edge Cases

**Case 1: Mention at word boundary**
```
Valid: "Hello @alice" → Parsed
Valid: "@alice hello" → Parsed
Invalid: "email@alice.com" → Not parsed (preceded by alphanumeric)
Invalid: "test@alice" → Not parsed
```

**Case 2: Duplicate mentions**
```
Input: "@alice what do you think @alice?"
Output: Only notify @alice once
Implementation: Use SET to track unique mentions
```

**Case 3: Case sensitivity**
```
Input: "@Alice", "@ALICE", "@alice"
Output: All resolve to same user (lowercase comparison)
Store: comment_mentions table stores actual user_id
```

### Concurrent Operation Edge Cases

**Case 1: Two users react simultaneously**
```
Solution: UNIQUE constraint on (comment_id, user_id)
Result: One succeeds, other gets constraint violation
Retry: Second request removes reaction (toggle behavior)
```

**Case 2: Comment deleted during reply creation**
```
Check: Validate parent exists in transaction
Result: If parent deleted, reply creation fails
Rollback: Transaction ensures no orphaned replies
```

**Case 3: Counter race conditions**
```
Problem: Multiple reactions added simultaneously
Solution: Atomic UPDATE with +=
Result: All increments applied correctly
```

### Data Integrity

**Orphan Prevention:**
```
Foreign Key: parent_comment_id → comments(id) ON DELETE CASCADE
Note: Soft delete means CASCADE never triggers
Cleanup: Periodic job finds comments with deleted parents
```

**Path Consistency:**
```
Validation: On insert, verify parent.path exists
Verification: Depth matches number of '/' in path
Repair: If inconsistent, rebuild path from parent chain
```

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Create Comment | p95 < 300ms | DB insert + notification async |
| Load 100 Comments | p95 < 1000ms | Single CTE query |
| Delete Comment | p95 < 200ms | DB update or delete |
| Toggle Reaction | p95 < 150ms | DB update atomic |
| Edit Comment | p95 < 250ms | DB update + mention parse |

### Load Testing Scenarios

**Scenario 1: High-frequency commenting**
```
Given: 1000 concurrent users
When: Each creates 1 comment per second
Then: Average latency < 500ms
And: No comment count inconsistencies
```

**Scenario 2: Deep thread loading**
```
Given: Comment tree with 500 comments
And: Max depth 2 with many branches
When: User loads entire tree
Then: Response time < 2 seconds
And: Single database query executed
```

**Scenario 3: Reaction storm**
```
Given: Popular comment with 1000 reactions
When: 100 users toggle reaction simultaneously
Then: All operations complete successfully
And: Final likes_count is accurate
```

---

## Security Considerations

### Input Validation

**XSS Prevention:**
```
SANITIZE: HTML entities encoded
WHITELIST: No <script>, <iframe>, <object> tags
LIBRARY: Use DOMPurify or equivalent
```

**SQL Injection Prevention:**
```
ALWAYS: Use parameterized queries
NEVER: Concatenate user input into SQL
VALIDATE: UUID format for all IDs
```

**Content Length:**
```
MIN: 1 character (prevent empty)
MAX: 5000 characters (prevent abuse)
VALIDATE: Both client-side and server-side
```

### Authorization Checks

**Who can delete comments:**
1. Comment author (within 5 minutes)
2. Post author (any time)
3. Group moderator (any time, M5 integration)
4. Site admin (any time)

**Who can edit comments:**
1. Only comment author
2. Only within 5-minute window
3. No one else (not even post author)

### Rate Limiting

```
LIMIT: 10 comments per minute per user
LIMIT: 100 comments per hour per user
LIMIT: 5 edits per comment (prevent spam)
```

---

**END OF M4 COMMENTS PSEUDOCODE**

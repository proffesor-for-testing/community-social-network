# M3 Posts & Feed System - Pseudocode Specification

**Document Version**: 1.0.0
**SPARC Phase**: Phase 2 (Pseudocode)
**Created By**: SPARC Pseudocode Agent
**Date**: 2025-12-16
**Status**: Ready for Implementation
**Related Documents**:
- Feed Performance Optimization Architecture
- XSS Prevention Specification
- M3 Phase 1 Specification

---

## Table of Contents

1. [Post Operations](#1-post-operations)
2. [Feed Generation Algorithms](#2-feed-generation-algorithms)
3. [XSS Prevention Pipeline](#3-xss-prevention-pipeline)
4. [Cache Management](#4-cache-management)
5. [Performance Optimizations](#5-performance-optimizations)
6. [Data Structures](#6-data-structures)
7. [Complexity Analysis](#7-complexity-analysis)

---

## 1. Post Operations

### 1.1 Create Post Algorithm

```
ALGORITHM: CreatePost
INPUT:
    userId (UUID) - authenticated user creating the post
    content (string) - raw post content (max 10,000 chars)
    groupId (UUID or NULL) - optional group to post in
    mediaUrls (array of strings) - optional media attachments
    visibility (enum) - 'public', 'group', or 'private'
    scheduledAt (timestamp or NULL) - optional scheduled post time

OUTPUT:
    post (Post object) or error

PRECONDITIONS:
    - userId must be authenticated
    - If groupId provided, user must be member of group
    - content must not be empty after sanitization
    - mediaUrls must be valid HTTPS URLs
    - scheduledAt must be future timestamp if provided

POSTCONDITIONS:
    - Post is stored in database with status 'published' or 'scheduled'
    - XSS-safe sanitized content is persisted
    - Cache invalidation triggered for relevant feeds
    - Event emitted for real-time updates

STEPS:
1. Validate input parameters
    IF content is empty OR length > 10,000 THEN
        RETURN error("Invalid content length")
    END IF

    IF groupId is not NULL THEN
        isMember ← Database.checkGroupMembership(userId, groupId)
        IF NOT isMember THEN
            RETURN error("User not member of group")
        END IF
    END IF

2. Sanitize content for XSS prevention
    sanitizedContent ← SanitizePostContent(content)
    // See Section 3.1 for sanitization details

    IF sanitizedContent is empty THEN
        RETURN error("Content empty after sanitization")
    END IF

3. Validate and sanitize media URLs
    validatedMediaUrls ← []
    FOR EACH url IN mediaUrls DO
        IF IsValidMediaUrl(url) THEN
            validatedMediaUrls.append(url)
        ELSE
            RETURN error("Invalid media URL: " + url)
        END IF
    END FOR

4. Determine post status
    IF scheduledAt is not NULL AND scheduledAt > NOW() THEN
        status ← 'scheduled'
    ELSE
        status ← 'published'
        publishedAt ← NOW()
    END IF

5. Create post record with transaction
    BEGIN TRANSACTION
        post ← Database.posts.create({
            id: GenerateUUID(),
            authorId: userId,
            groupId: groupId,
            content: sanitizedContent,
            mediaUrls: validatedMediaUrls,
            visibility: visibility,
            status: status,
            scheduledAt: scheduledAt,
            createdAt: NOW(),
            updatedAt: NOW(),
            likesCount: 0,
            commentsCount: 0,
            sharesCount: 0,
            isPinned: false,
            isDeleted: false
        })

        // Update denormalized counters
        IF groupId is not NULL THEN
            Database.groups.increment(groupId, 'postsCount', 1)
        END IF

        Database.users.increment(userId, 'postsCount', 1)
    COMMIT TRANSACTION

6. Cache invalidation (if published immediately)
    IF status = 'published' THEN
        // Invalidate author's profile feed
        Cache.invalidate('feed:profile:user:' + userId + ':*')

        // Invalidate group feed if applicable
        IF groupId is not NULL THEN
            Cache.invalidate('feed:group:' + groupId + ':*')
        END IF

        // Invalidate home feeds of followers (async)
        EventBus.emit('post.created', {
            postId: post.id,
            authorId: userId,
            groupId: groupId
        })
    END IF

7. Schedule background tasks
    IF status = 'scheduled' THEN
        TaskQueue.schedule('PublishScheduledPost', scheduledAt, {
            postId: post.id
        })
    END IF

    // Extract and index hashtags (async)
    TaskQueue.enqueue('ExtractHashtags', {
        postId: post.id,
        content: sanitizedContent
    })

8. Return created post
    RETURN post

COMPLEXITY:
    Time: O(1) database insert + O(n) for n media URLs + O(m) sanitization for content length m
    Space: O(m) for content storage
    Total: O(m + n) where m = content length, n = number of media URLs

CACHE_STRATEGY:
    - Invalidate on write (cache-aside)
    - Async cache warming for hot feeds
    - Event-driven invalidation for followers

PERFORMANCE_TARGET:
    p50 < 50ms, p95 < 150ms, p99 < 300ms
```

---

### 1.2 Edit Post Algorithm

```
ALGORITHM: EditPost
INPUT:
    postId (UUID) - post to edit
    userId (UUID) - authenticated user making the edit
    newContent (string) - updated content
    newMediaUrls (array of strings) - updated media attachments

OUTPUT:
    updatedPost (Post object) or error

PRECONDITIONS:
    - User must be post author
    - Post must not be deleted
    - Edit must be within 5-minute window OR user is admin

POSTCONDITIONS:
    - Post content updated with sanitized version
    - updatedAt timestamp refreshed
    - Cache invalidated for affected feeds
    - Edit history recorded (audit log)

STEPS:
1. Fetch post and verify ownership
    post ← Database.posts.findById(postId)

    IF post is NULL OR post.isDeleted = true THEN
        RETURN error("Post not found")
    END IF

    IF post.authorId ≠ userId THEN
        isAdmin ← Database.checkUserRole(userId, 'admin')
        IF NOT isAdmin THEN
            RETURN error("Unauthorized to edit post")
        END IF
    END IF

2. Check edit time window
    timeSinceCreation ← NOW() - post.createdAt
    editWindowSeconds ← 300 // 5 minutes

    IF timeSinceCreation > editWindowSeconds THEN
        isAdmin ← Database.checkUserRole(userId, 'admin')
        IF NOT isAdmin THEN
            RETURN error("Edit window expired (5 minutes)")
        END IF
    END IF

3. Sanitize new content
    sanitizedContent ← SanitizePostContent(newContent)

    IF sanitizedContent is empty THEN
        RETURN error("Content empty after sanitization")
    END IF

4. Validate new media URLs
    validatedMediaUrls ← []
    FOR EACH url IN newMediaUrls DO
        IF IsValidMediaUrl(url) THEN
            validatedMediaUrls.append(url)
        END IF
    END FOR

5. Update post with transaction
    BEGIN TRANSACTION
        // Store edit history for audit
        Database.postEditHistory.create({
            postId: postId,
            previousContent: post.content,
            previousMediaUrls: post.mediaUrls,
            editedBy: userId,
            editedAt: NOW()
        })

        // Update post
        updatedPost ← Database.posts.update(postId, {
            content: sanitizedContent,
            mediaUrls: validatedMediaUrls,
            updatedAt: NOW()
        })
    COMMIT TRANSACTION

6. Cache invalidation
    // Invalidate post details cache
    Cache.delete('post:' + postId + ':v1')

    // Invalidate feeds containing this post
    Cache.invalidate('feed:profile:user:' + post.authorId + ':*')

    IF post.groupId is not NULL THEN
        Cache.invalidate('feed:group:' + post.groupId + ':*')
    END IF

    // Emit event for real-time updates
    EventBus.emit('post.updated', {
        postId: postId,
        authorId: post.authorId
    })

7. Return updated post
    RETURN updatedPost

COMPLEXITY:
    Time: O(1) for lookups and updates + O(m) sanitization
    Space: O(m) for content storage + O(h) for history
    Total: O(m + h)

CACHE_STRATEGY:
    - Delete specific post cache
    - Invalidate feed patterns
    - Event-driven invalidation

PERFORMANCE_TARGET:
    p95 < 100ms
```

---

### 1.3 Delete Post Algorithm (Soft Delete)

```
ALGORITHM: DeletePost
INPUT:
    postId (UUID) - post to delete
    userId (UUID) - authenticated user requesting deletion

OUTPUT:
    success (boolean) or error

PRECONDITIONS:
    - User must be post author OR group moderator OR admin
    - Post must not already be deleted

POSTCONDITIONS:
    - Post marked as deleted (isDeleted = true)
    - Post hidden from feeds immediately
    - Comments remain accessible (for audit)
    - Denormalized counters decremented

STEPS:
1. Fetch post and verify permissions
    post ← Database.posts.findById(postId)

    IF post is NULL OR post.isDeleted = true THEN
        RETURN error("Post not found or already deleted")
    END IF

    canDelete ← (post.authorId = userId)

    IF NOT canDelete AND post.groupId is not NULL THEN
        canDelete ← Database.checkGroupRole(userId, post.groupId, ['owner', 'moderator'])
    END IF

    IF NOT canDelete THEN
        canDelete ← Database.checkUserRole(userId, 'admin')
    END IF

    IF NOT canDelete THEN
        RETURN error("Unauthorized to delete post")
    END IF

2. Soft delete post with transaction
    BEGIN TRANSACTION
        // Mark as deleted
        Database.posts.update(postId, {
            isDeleted: true,
            deletedAt: NOW(),
            deletedBy: userId
        })

        // Decrement denormalized counters
        Database.users.decrement(post.authorId, 'postsCount', 1)

        IF post.groupId is not NULL THEN
            Database.groups.decrement(post.groupId, 'postsCount', 1)
        END IF
    COMMIT TRANSACTION

3. Cache invalidation (aggressive)
    // Delete post details from cache
    Cache.delete('post:' + postId + ':v1')
    Cache.delete('post:' + postId + ':comments:*')
    Cache.delete('post:' + postId + ':likes:count:v1')

    // Invalidate all feeds that may contain this post
    Cache.invalidate('feed:profile:user:' + post.authorId + ':*')

    IF post.groupId is not NULL THEN
        Cache.invalidate('feed:group:' + post.groupId + ':*')
    END IF

    // Invalidate home feeds of followers (async)
    EventBus.emit('post.deleted', {
        postId: postId,
        authorId: post.authorId,
        groupId: post.groupId
    })

4. Schedule cleanup tasks (async)
    // Remove from search index
    TaskQueue.enqueue('RemoveFromSearchIndex', {postId: postId})

    // Hard delete after retention period (e.g., 30 days)
    TaskQueue.schedule('HardDeletePost', NOW() + 30_DAYS, {postId: postId})

5. Return success
    RETURN true

COMPLEXITY:
    Time: O(1) for updates and cache operations
    Space: O(1)

CACHE_STRATEGY:
    - Immediate cache deletion
    - Async feed invalidation via events

PERFORMANCE_TARGET:
    p95 < 80ms
```

---

### 1.4 Post Reactions (Like/Unlike)

```
ALGORITHM: ToggleLikePost
INPUT:
    postId (UUID) - post to like/unlike
    userId (UUID) - authenticated user

OUTPUT:
    result { isLiked: boolean, newCount: integer } or error

PRECONDITIONS:
    - Post must exist and not be deleted
    - User must be authenticated

POSTCONDITIONS:
    - Like record created or deleted
    - likesCount incremented or decremented atomically
    - Cache updated with write-through strategy

STEPS:
1. Check if user already liked the post
    existingLike ← Database.postLikes.findOne({
        postId: postId,
        userId: userId
    })

2. Toggle like state with transaction
    BEGIN TRANSACTION
        IF existingLike is not NULL THEN
            // Unlike: Delete like record
            Database.postLikes.delete({
                postId: postId,
                userId: userId
            })

            // Decrement counter atomically
            newCount ← Database.posts.decrement(postId, 'likesCount', 1)

            isLiked ← false
        ELSE
            // Like: Create like record
            Database.postLikes.create({
                postId: postId,
                userId: userId,
                createdAt: NOW()
            })

            // Increment counter atomically
            newCount ← Database.posts.increment(postId, 'likesCount', 1)

            isLiked ← true
        END IF
    COMMIT TRANSACTION

3. Update cache with write-through strategy
    cacheKey ← 'post:' + postId + ':likes:count:v1'
    Cache.set(cacheKey, newCount, TTL: 3600) // 1 hour TTL

    // Invalidate post details cache
    Cache.delete('post:' + postId + ':v1')

4. Send real-time notification (async)
    IF isLiked THEN
        post ← Database.posts.findById(postId)
        IF post.authorId ≠ userId THEN
            EventBus.emit('notification.like', {
                recipientId: post.authorId,
                actorId: userId,
                postId: postId
            })
        END IF
    END IF

5. Return result
    RETURN {
        isLiked: isLiked,
        newCount: newCount
    }

COMPLEXITY:
    Time: O(1) - atomic database operations
    Space: O(1)

CACHE_STRATEGY:
    - Write-through cache for counter
    - Cache post details invalidated
    - Counter persisted to both cache and DB

PERFORMANCE_TARGET:
    p95 < 50ms (critical for UX responsiveness)
```

---

## 2. Feed Generation Algorithms

### 2.1 Home Feed Algorithm

```
ALGORITHM: GenerateHomeFeed
INPUT:
    userId (UUID) - user requesting feed
    cursor (string or NULL) - pagination cursor (timestamp)
    limit (integer) - number of posts to return (default: 20, max: 100)

OUTPUT:
    feedResult { posts: array, nextCursor: string, hasMore: boolean }

PRECONDITIONS:
    - User must be authenticated
    - limit must be between 1 and 100

POSTCONDITIONS:
    - Returns personalized feed with engagement scoring
    - Posts ordered by engagement score and recency
    - Cursor enables efficient pagination

STEPS:
1. Check L1 cache (in-memory LRU cache)
    cacheKey ← 'feed:home:user:' + userId + ':cursor:' + cursor + ':v1'

    cachedFeed ← MemoryCache.get(cacheKey)
    IF cachedFeed is not NULL THEN
        RETURN cachedFeed
    END IF

2. Check L2 cache (Redis)
    cachedFeed ← RedisCache.get(cacheKey)
    IF cachedFeed is not NULL THEN
        MemoryCache.set(cacheKey, cachedFeed, TTL: 60) // 1 minute
        RETURN cachedFeed
    END IF

3. Fetch user's followed users and groups
    followedUserIds ← Database.follows.getFollowing(userId)
    // Uses index: idx_follows_follower

    joinedGroupIds ← Database.groupMembers.getUserGroups(userId)
    // Uses index: idx_group_members_user

4. Build optimized query for posts
    // Use composite index: idx_posts_home_feed
    IF cursor is NULL THEN
        cursorTimestamp ← NOW()
    ELSE
        cursorTimestamp ← DecodeCursor(cursor)
    END IF

    query ← {
        where: {
            OR: [
                { authorId: IN followedUserIds },
                { groupId: IN joinedGroupIds, visibility: 'group' }
            ],
            status: 'published',
            isDeleted: false,
            createdAt: LT cursorTimestamp
        },
        orderBy: {
            createdAt: 'DESC'
        },
        limit: limit + 1, // Fetch one extra to determine hasMore
        include: {
            author: { select: ['id', 'username', 'displayName', 'avatarUrl'] },
            group: { select: ['id', 'name', 'privacy'] }
        }
    }

5. Execute query with DataLoader (N+1 prevention)
    rawPosts ← Database.posts.findMany(query)
    // Uses covering index: idx_posts_feed_preview for index-only scan

6. Calculate engagement scores for ranking
    scoredPosts ← []
    FOR EACH post IN rawPosts DO
        score ← CalculateEngagementScore(post)
        scoredPosts.append({ post: post, score: score })
    END FOR

    // Sort by score (for top posts) then by recency
    scoredPosts.sort(BY score DESC, post.createdAt DESC)

7. Paginate results
    hasMore ← (scoredPosts.length > limit)

    IF hasMore THEN
        scoredPosts ← scoredPosts.slice(0, limit)
        lastPost ← scoredPosts[limit - 1].post
        nextCursor ← EncodeCursor(lastPost.createdAt)
    ELSE
        nextCursor ← NULL
    END IF

    posts ← scoredPosts.map(item => item.post)

8. Hydrate additional data with DataLoader batching
    // Batch fetch user reactions in single query
    FOR EACH post IN posts DO
        post.isLikedByUser ← DataLoader.postLikes.load({postId: post.id, userId: userId})
    END FOR

9. Cache the result
    feedResult ← {
        posts: posts,
        nextCursor: nextCursor,
        hasMore: hasMore
    }

    RedisCache.setex(cacheKey, 300, feedResult) // 5 minutes TTL
    MemoryCache.set(cacheKey, feedResult, TTL: 60) // 1 minute TTL

    RETURN feedResult

SUBROUTINE: CalculateEngagementScore
INPUT: post (Post object)
OUTPUT: score (float)

BEGIN
    recencyWeight ← 0.4
    likesWeight ← 0.3
    commentsWeight ← 0.25
    sharesWeight ← 0.05

    // Time decay: exponential decay with 24-hour half-life
    ageHours ← (NOW() - post.createdAt) / 3600
    recencyScore ← exp(-0.03 * ageHours) // Decays to 0.5 at 24 hours

    // Normalize engagement metrics
    likesScore ← log(post.likesCount + 1) / log(100) // Normalize to 0-1 range
    commentsScore ← log(post.commentsCount + 1) / log(50)
    sharesScore ← log(post.sharesCount + 1) / log(20)

    // Boost for media content
    mediaBoost ← (post.mediaUrls.length > 0) ? 1.2 : 1.0

    // Calculate weighted score
    score ← (
        recencyScore * recencyWeight +
        likesScore * likesWeight +
        commentsScore * commentsWeight +
        sharesScore * sharesWeight
    ) * mediaBoost

    RETURN score
END

SUBROUTINE: EncodeCursor
INPUT: timestamp (datetime)
OUTPUT: encodedCursor (string)

BEGIN
    // Base64 encode timestamp for opacity
    unixTimestamp ← timestamp.toUnixEpoch()
    encodedCursor ← base64Encode(unixTimestamp.toString())
    RETURN encodedCursor
END

SUBROUTINE: DecodeCursor
INPUT: encodedCursor (string)
OUTPUT: timestamp (datetime)

BEGIN
    unixTimestamp ← parseInt(base64Decode(encodedCursor))
    timestamp ← fromUnixEpoch(unixTimestamp)
    RETURN timestamp
END

COMPLEXITY:
    Time:
        - Cache hit: O(1)
        - Cache miss: O(n log n) where n = limit
        - Query: O(log m) with index, m = total posts
        - Scoring: O(n) for n fetched posts
    Space: O(n) for result set
    Total: O(n log n) worst case

CACHE_STRATEGY:
    - L1 (Memory): 1 minute TTL, LRU eviction
    - L2 (Redis): 5 minutes TTL
    - Cache warming on login
    - Invalidate on follow/unfollow/post.created events

PERFORMANCE_TARGET:
    - L1 cache hit: p95 < 10ms
    - L2 cache hit: p95 < 50ms
    - Cache miss: p95 < 150ms
    - Overall: p95 < 150ms (mixed workload)

DATABASE_OPTIMIZATION:
    - Uses covering index for index-only scan
    - DataLoader prevents N+1 queries
    - Batch fetches for user reactions
    - Connection pooling with max 20 connections
```

---

### 2.2 Group Feed Algorithm

```
ALGORITHM: GenerateGroupFeed
INPUT:
    groupId (UUID) - group to fetch feed for
    userId (UUID) - authenticated user
    cursor (string or NULL) - pagination cursor
    limit (integer) - posts per page (default: 20)

OUTPUT:
    feedResult { posts: array, nextCursor: string, hasMore: boolean }

PRECONDITIONS:
    - User must be member of group (for private groups)
    - Group must exist and not be deleted

POSTCONDITIONS:
    - Returns group posts ordered by pinned status then recency
    - Pinned posts appear first regardless of timestamp

STEPS:
1. Verify group membership
    group ← Database.groups.findById(groupId)

    IF group is NULL THEN
        RETURN error("Group not found")
    END IF

    IF group.privacy IN ['private', 'invite-only'] THEN
        isMember ← Database.groupMembers.checkMembership(userId, groupId)
        IF NOT isMember THEN
            RETURN error("Access denied: not a member")
        END IF
    END IF

2. Check cache (L2 Redis only for group feeds)
    cacheKey ← 'feed:group:' + groupId + ':cursor:' + cursor + ':v1'

    cachedFeed ← RedisCache.get(cacheKey)
    IF cachedFeed is not NULL THEN
        RETURN cachedFeed
    END IF

3. Fetch pinned posts (always show first)
    pinnedPosts ← []
    IF cursor is NULL THEN
        // Only fetch pinned posts on first page
        pinnedPosts ← Database.posts.findMany({
            where: {
                groupId: groupId,
                isPinned: true,
                isDeleted: false,
                status: 'published'
            },
            orderBy: {
                createdAt: 'DESC'
            },
            limit: 3, // Max 3 pinned posts
            include: {
                author: { select: ['id', 'username', 'displayName', 'avatarUrl'] }
            }
        })
        // Uses index: idx_posts_group_feed
    END IF

4. Fetch regular posts
    IF cursor is NULL THEN
        cursorTimestamp ← NOW()
    ELSE
        cursorTimestamp ← DecodeCursor(cursor)
    END IF

    regularPosts ← Database.posts.findMany({
        where: {
            groupId: groupId,
            isPinned: false,
            isDeleted: false,
            status: 'published',
            createdAt: LT cursorTimestamp
        },
        orderBy: {
            createdAt: 'DESC'
        },
        limit: limit + 1 - pinnedPosts.length,
        include: {
            author: { select: ['id', 'username', 'displayName', 'avatarUrl'] }
        }
    })
    // Uses index: idx_posts_group_feed

5. Combine pinned and regular posts
    allPosts ← pinnedPosts.concat(regularPosts)

    hasMore ← (allPosts.length > limit)
    IF hasMore THEN
        allPosts ← allPosts.slice(0, limit)
        lastPost ← allPosts[limit - 1]
        nextCursor ← EncodeCursor(lastPost.createdAt)
    ELSE
        nextCursor ← NULL
    END IF

6. Hydrate user reactions
    FOR EACH post IN allPosts DO
        post.isLikedByUser ← DataLoader.postLikes.load({
            postId: post.id,
            userId: userId
        })
    END FOR

7. Cache result
    feedResult ← {
        posts: allPosts,
        nextCursor: nextCursor,
        hasMore: hasMore
    }

    RedisCache.setex(cacheKey, 180, feedResult) // 3 minutes TTL

    RETURN feedResult

COMPLEXITY:
    Time: O(log n) query with index + O(k) for k posts
    Space: O(k) where k = limit
    Total: O(log n + k)

CACHE_STRATEGY:
    - Redis L2 cache only (3 minute TTL)
    - Eager cache warming for top 20 groups
    - Invalidate on post.created/deleted/pinned events

PERFORMANCE_TARGET:
    - Cache hit: p95 < 40ms
    - Cache miss: p95 < 100ms
    - Overall: p95 < 100ms
```

---

### 2.3 User Profile Feed Algorithm

```
ALGORITHM: GenerateUserProfileFeed
INPUT:
    profileUserId (UUID) - user whose profile feed to fetch
    viewerId (UUID or NULL) - authenticated user viewing (null for public)
    cursor (string or NULL) - pagination cursor
    limit (integer) - posts per page

OUTPUT:
    feedResult { posts: array, nextCursor: string, hasMore: boolean }

PRECONDITIONS:
    - profileUserId must exist
    - Viewer must have permission to view (privacy check)

POSTCONDITIONS:
    - Returns posts authored by profileUserId
    - Filtered by visibility based on viewer relationship

STEPS:
1. Check privacy and visibility
    profileUser ← Database.users.findById(profileUserId)

    IF profileUser is NULL THEN
        RETURN error("User not found")
    END IF

    // Determine visibility filter based on viewer relationship
    IF viewerId = profileUserId THEN
        visibilityFilter ← ['public', 'group', 'private']
    ELSE IF viewerId is not NULL THEN
        isFollowing ← Database.follows.checkFollowing(viewerId, profileUserId)
        IF isFollowing THEN
            visibilityFilter ← ['public', 'group']
        ELSE
            visibilityFilter ← ['public']
        END IF
    ELSE
        visibilityFilter ← ['public']
    END IF

2. Check cache
    cacheKey ← 'feed:profile:user:' + profileUserId + ':viewer:' + viewerId + ':cursor:' + cursor + ':v1'

    cachedFeed ← RedisCache.get(cacheKey)
    IF cachedFeed is not NULL THEN
        RETURN cachedFeed
    END IF

3. Fetch posts with visibility filter
    IF cursor is NULL THEN
        cursorTimestamp ← NOW()
    ELSE
        cursorTimestamp ← DecodeCursor(cursor)
    END IF

    posts ← Database.posts.findMany({
        where: {
            authorId: profileUserId,
            visibility: IN visibilityFilter,
            isDeleted: false,
            status: 'published',
            createdAt: LT cursorTimestamp
        },
        orderBy: {
            createdAt: 'DESC'
        },
        limit: limit + 1,
        include: {
            group: { select: ['id', 'name', 'privacy'] }
        }
    })
    // Uses index: idx_posts_user_profile

4. Paginate
    hasMore ← (posts.length > limit)
    IF hasMore THEN
        posts ← posts.slice(0, limit)
        lastPost ← posts[limit - 1]
        nextCursor ← EncodeCursor(lastPost.createdAt)
    ELSE
        nextCursor ← NULL
    END IF

5. Hydrate user reactions (if viewer authenticated)
    IF viewerId is not NULL THEN
        FOR EACH post IN posts DO
            post.isLikedByUser ← DataLoader.postLikes.load({
                postId: post.id,
                userId: viewerId
            })
        END FOR
    END IF

6. Cache result
    feedResult ← {
        posts: posts,
        nextCursor: nextCursor,
        hasMore: hasMore
    }

    RedisCache.setex(cacheKey, 600, feedResult) // 10 minutes TTL

    RETURN feedResult

COMPLEXITY:
    Time: O(log n) with index
    Space: O(k) where k = limit
    Total: O(log n + k)

CACHE_STRATEGY:
    - Redis cache with 10 minute TTL (longer than home feed)
    - Invalidate on post.created/updated/deleted by profile user
    - Separate cache keys per viewer for privacy

PERFORMANCE_TARGET:
    - Cache hit: p95 < 30ms
    - Cache miss: p95 < 80ms
```

---

## 3. XSS Prevention Pipeline

### 3.1 Input Sanitization Algorithm

```
ALGORITHM: SanitizePostContent
INPUT:
    rawContent (string) - unsanitized user input

OUTPUT:
    sanitizedContent (string) - XSS-safe content

PRECONDITIONS:
    - rawContent is not NULL

POSTCONDITIONS:
    - All dangerous HTML/JavaScript removed
    - Safe formatting tags preserved
    - URLs validated and protocols checked

STEPS:
1. Initialize DOMPurify with configuration
    config ← {
        ALLOWED_TAGS: [
            'b', 'i', 'u', 'strong', 'em', 'p', 'br',
            'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre'
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        ALLOWED_URI_REGEXP: /^(?:https?:\/\/)/i,
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
        FORBID_TAGS: [
            'script', 'iframe', 'object', 'embed', 'link',
            'style', 'form', 'input', 'button', 'svg'
        ],
        FORBID_ATTR: [
            'onclick', 'onerror', 'onload', 'onmouseover',
            'onfocus', 'onblur', 'onchange', 'onsubmit'
        ]
    }

2. Pre-sanitization normalization
    // Decode HTML entities to prevent encoding bypass
    normalized ← HtmlDecode(rawContent)

    // Remove null bytes and control characters
    normalized ← RemoveControlCharacters(normalized)

    // Normalize Unicode to prevent homograph attacks
    normalized ← NormalizeUnicode(normalized)

3. Apply DOMPurify sanitization
    sanitized ← DOMPurify.sanitize(normalized, config)

4. Post-sanitization validation
    // Remove javascript: and data: protocols (defense in depth)
    sanitized ← RemoveDangerousProtocols(sanitized)

    // Ensure all links have rel="noopener noreferrer" for security
    sanitized ← AddLinkSecurityAttributes(sanitized)

5. Validate link URLs
    links ← ExtractLinks(sanitized)
    FOR EACH link IN links DO
        IF NOT IsValidHttpUrl(link.href) THEN
            // Remove invalid link, keep text
            sanitized ← RemoveLink(sanitized, link)
        END IF
    END FOR

6. Trim and normalize whitespace
    sanitized ← TrimWhitespace(sanitized)
    sanitized ← NormalizeWhitespace(sanitized) // Multiple spaces → single space

7. Check content length
    IF length(sanitized) > 10000 THEN
        sanitized ← sanitized.substring(0, 10000)
    END IF

    IF length(sanitized) = 0 THEN
        RETURN NULL // Content empty after sanitization
    END IF

8. Return sanitized content
    RETURN sanitized

SUBROUTINE: IsValidHttpUrl
INPUT: url (string)
OUTPUT: isValid (boolean)

BEGIN
    TRY
        parsed ← ParseURL(url)

        // Only allow http and https protocols
        IF parsed.protocol NOT IN ['http:', 'https:'] THEN
            RETURN false
        END IF

        // Reject localhost and private IPs in production
        IF IsProduction() THEN
            IF parsed.hostname IN ['localhost', '127.0.0.1', '0.0.0.0'] THEN
                RETURN false
            END IF

            IF IsPrivateIP(parsed.hostname) THEN
                RETURN false
            END IF
        END IF

        RETURN true
    CATCH error
        RETURN false
    END TRY
END

SUBROUTINE: RemoveDangerousProtocols
INPUT: html (string)
OUTPUT: cleaned (string)

BEGIN
    dangerousProtocols ← [
        'javascript:', 'data:', 'vbscript:', 'file:',
        'about:', 'view-source:', 'jar:'
    ]

    cleaned ← html
    FOR EACH protocol IN dangerousProtocols DO
        // Case-insensitive removal with regex
        pattern ← CreateRegex(protocol, CASE_INSENSITIVE | GLOBAL)
        cleaned ← ReplaceAll(cleaned, pattern, '')
    END FOR

    RETURN cleaned
END

COMPLEXITY:
    Time: O(m) where m = content length
    Space: O(m) for sanitized copy
    Total: O(m)

SECURITY_GUARANTEES:
    - Blocks all <script>, <iframe>, <object>, <embed> tags
    - Removes event handlers (onclick, onerror, etc.)
    - Validates all URLs to only allow https://
    - Prevents encoding bypass attacks
    - Mitigates DOM-based XSS
    - Defense in depth with multiple validation layers

PERFORMANCE_TARGET:
    - p95 < 5ms for typical post (1000 chars)
    - p99 < 15ms for long post (10000 chars)

TEST_VECTORS: 30+ XSS payloads (see XSS Prevention Specification)
```

---

### 3.2 Content Security Policy (CSP) Header Generation

```
ALGORITHM: GenerateCSPHeader
INPUT:
    requestNonce (string) - cryptographic nonce for this request
    environment (enum) - 'development' or 'production'

OUTPUT:
    cspHeaderValue (string)

STEPS:
1. Initialize CSP directives
    directives ← {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'nonce-" + requestNonce + "'"],
        'style-src': ["'self'", "'nonce-" + requestNonce + "'"],
        'img-src': ["'self'", "data:", "https:"],
        'font-src': ["'self'", "https://fonts.gstatic.com"],
        'connect-src': ["'self'"],
        'frame-src': ["'none'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': []
    }

2. Add environment-specific sources
    IF environment = 'development' THEN
        // Allow localhost and webpack dev server
        directives['script-src'].append("'unsafe-eval'") // For React dev tools
        directives['connect-src'].append("ws://localhost:3000")
        directives['connect-src'].append("http://localhost:5173")
    ELSE
        // Production: strict policies
        directives['connect-src'].append("https://api.startit.rs")
        directives['connect-src'].append("wss://api.startit.rs")
        directives['img-src'].append("https://*.cloudfront.net")
        directives['img-src'].append("https://s3.amazonaws.com")
    END IF

3. Add CDN sources (if needed)
    IF UseCDN() THEN
        directives['font-src'].append("https://fonts.googleapis.com")
        directives['style-src'].append("https://fonts.googleapis.com")
    END IF

4. Add CSP reporting
    directives['report-uri'] ← ["/api/csp-report"]
    directives['report-to'] ← ["csp-endpoint"]

5. Build CSP header string
    cspParts ← []
    FOR EACH (directive, sources) IN directives DO
        IF sources.length > 0 THEN
            sourcesStr ← sources.join(' ')
            cspParts.append(directive + ' ' + sourcesStr)
        ELSE
            cspParts.append(directive)
        END IF
    END FOR

    cspHeaderValue ← cspParts.join('; ')

6. Return CSP header
    RETURN cspHeaderValue

EXAMPLE_OUTPUT:
    "default-src 'self'; script-src 'self' 'nonce-abc123xyz';
     style-src 'self' 'nonce-abc123xyz' https://fonts.googleapis.com;
     img-src 'self' data: https: https://*.cloudfront.net;
     font-src 'self' https://fonts.gstatic.com;
     connect-src 'self' https://api.startit.rs wss://api.startit.rs;
     frame-src 'none'; object-src 'none'; base-uri 'self';
     form-action 'self'; upgrade-insecure-requests;
     report-uri /api/csp-report"

COMPLEXITY: O(1) - fixed number of directives

SECURITY_BENEFITS:
    - Blocks inline scripts without nonce
    - Prevents frame embedding (clickjacking protection)
    - Disables plugins and objects
    - Enforces HTTPS
    - Logs violations for monitoring
```

---

### 3.3 Output Encoding Strategy

```
ALGORITHM: EncodeOutputByContext
INPUT:
    value (string) - user-generated content
    context (enum) - 'HTML', 'ATTRIBUTE', 'JAVASCRIPT', 'URL', 'CSS'

OUTPUT:
    encodedValue (string)

STEPS:
1. Determine encoding method based on context
    SWITCH context:
        CASE 'HTML':
            encodedValue ← HtmlEncode(value)
            // & → &amp;  < → &lt;  > → &gt;  " → &quot;  ' → &#x27;

        CASE 'ATTRIBUTE':
            encodedValue ← HtmlAttributeEncode(value)
            // Encode quotes, angle brackets, and spaces

        CASE 'JAVASCRIPT':
            encodedValue ← JavaScriptEncode(value)
            // Use JSON.stringify to safely escape

        CASE 'URL':
            encodedValue ← UrlEncode(value)
            // Use encodeURIComponent

        CASE 'CSS':
            // NEVER allow user input in CSS context
            THROW error("User input not allowed in CSS context")

        DEFAULT:
            // Safest default: HTML encoding
            encodedValue ← HtmlEncode(value)
    END SWITCH

2. Return encoded value
    RETURN encodedValue

SUBROUTINE: HtmlEncode
INPUT: text (string)
OUTPUT: encoded (string)

BEGIN
    replacements ← {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    }

    encoded ← text
    FOR EACH (char, entity) IN replacements DO
        encoded ← ReplaceAll(encoded, char, entity)
    END FOR

    RETURN encoded
END

COMPLEXITY: O(n) where n = string length

USAGE_EXAMPLES:
    // React JSX automatically HTML-encodes
    <div>{userInput}</div> // ✅ Safe

    // For rich text with sanitized HTML
    <div dangerouslySetInnerHTML={{__html: SanitizePostContent(userInput)}} />

    // URL parameters
    const url = `/search?q=${encodeURIComponent(query)}`

    // JavaScript context (avoid if possible)
    <script nonce={nonce}>
        const userName = {JSON.stringify(userName)};
    </script>
```

---

## 4. Cache Management

### 4.1 Cache Read-Through Pattern

```
ALGORITHM: CacheReadThrough
INPUT:
    cacheKey (string) - Redis cache key
    fetchFunction (function) - function to fetch data on cache miss
    ttl (integer) - time to live in seconds

OUTPUT:
    data (any) - cached or freshly fetched data

STEPS:
1. Check L1 cache (in-memory LRU)
    data ← MemoryCache.get(cacheKey)
    IF data is not NULL THEN
        Metrics.increment('cache.l1.hit')
        RETURN data
    END IF

    Metrics.increment('cache.l1.miss')

2. Check L2 cache (Redis)
    data ← RedisCache.get(cacheKey)
    IF data is not NULL THEN
        Metrics.increment('cache.l2.hit')

        // Populate L1 cache
        MemoryCache.set(cacheKey, data, TTL: 60)

        RETURN data
    END IF

    Metrics.increment('cache.l2.miss')

3. Fetch from source (database)
    Metrics.startTimer('cache.fetch_time')
    data ← fetchFunction()
    Metrics.stopTimer('cache.fetch_time')

    IF data is NULL THEN
        // Cache negative result briefly to prevent cache stampede
        RedisCache.setex(cacheKey, 30, NULL_MARKER)
        RETURN NULL
    END IF

4. Write to both cache layers
    RedisCache.setex(cacheKey, ttl, data)
    MemoryCache.set(cacheKey, data, TTL: min(60, ttl))

5. Return data
    RETURN data

COMPLEXITY:
    Time: O(1) for cache hit, O(f) for cache miss where f = fetch time
    Space: O(d) where d = data size

PERFORMANCE_TARGET:
    - L1 hit: < 1ms
    - L2 hit: < 10ms
    - L3 (DB) fetch: < 150ms
```

---

### 4.2 Cache Invalidation Algorithm

```
ALGORITHM: InvalidateFeedCache
INPUT:
    eventType (enum) - 'post.created', 'post.updated', 'post.deleted', etc.
    eventData (object) - event-specific data

STEPS:
1. Determine affected cache keys based on event
    SWITCH eventType:
        CASE 'post.created':
            // Invalidate author's profile feed
            InvalidatePattern('feed:profile:user:' + eventData.authorId + ':*')

            // Invalidate group feed if applicable
            IF eventData.groupId is not NULL THEN
                InvalidatePattern('feed:group:' + eventData.groupId + ':*')
            END IF

            // Invalidate home feeds of followers (async, batched)
            EnqueueTask('InvalidateFollowersFeeds', {
                authorId: eventData.authorId
            })

        CASE 'post.updated':
            // Invalidate post details
            InvalidateKey('post:' + eventData.postId + ':v1')

            // Invalidate author's profile feed
            InvalidatePattern('feed:profile:user:' + eventData.authorId + ':*')

        CASE 'post.deleted':
            // Aggressive invalidation for deleted post
            InvalidateKey('post:' + eventData.postId + ':*')
            InvalidatePattern('feed:profile:user:' + eventData.authorId + ':*')

            IF eventData.groupId is not NULL THEN
                InvalidatePattern('feed:group:' + eventData.groupId + ':*')
            END IF

        CASE 'user.followed':
            // Invalidate follower's home feed
            InvalidatePattern('feed:home:user:' + eventData.followerId + ':*')

        CASE 'user.joined_group':
            // Invalidate user's home feed (will now include group posts)
            InvalidatePattern('feed:home:user:' + eventData.userId + ':*')
    END SWITCH

2. Log invalidation for monitoring
    Logger.info('Cache invalidated', {
        eventType: eventType,
        patternsInvalidated: affectedPatterns,
        keysInvalidated: affectedKeys.length
    })

SUBROUTINE: InvalidatePattern
INPUT: pattern (string) - Redis key pattern (e.g., 'feed:home:user:123:*')

BEGIN
    // Use SCAN instead of KEYS to avoid blocking Redis
    cursor ← '0'
    keysDeleted ← 0

    REPEAT
        result ← RedisCache.scan(cursor, MATCH: pattern, COUNT: 100)
        cursor ← result.cursor
        keys ← result.keys

        IF keys.length > 0 THEN
            RedisCache.del(keys)
            keysDeleted ← keysDeleted + keys.length

            // Also invalidate L1 cache
            FOR EACH key IN keys DO
                MemoryCache.delete(key)
            END FOR
        END IF
    UNTIL cursor = '0'

    Metrics.increment('cache.invalidations', keysDeleted)
END

SUBROUTINE: InvalidateKey
INPUT: key (string) - specific Redis key

BEGIN
    RedisCache.del(key)
    MemoryCache.delete(key)
    Metrics.increment('cache.invalidations', 1)
END

COMPLEXITY:
    Time: O(n) where n = number of matching keys (worst case)
    Space: O(1)

PERFORMANCE_OPTIMIZATION:
    - Use Redis SCAN with cursor to avoid blocking
    - Batch invalidations with pipeline
    - Async processing for follower feeds (eventual consistency)
```

---

### 4.3 Cache Stampede Prevention

```
ALGORITHM: PreventCacheStampede
INPUT:
    cacheKey (string)
    fetchFunction (function)
    ttl (integer)

OUTPUT:
    data (any)

STEPS:
1. Try to get data from cache
    data ← RedisCache.get(cacheKey)
    IF data is not NULL THEN
        RETURN data
    END IF

2. Try to acquire lock to fetch data
    lockKey ← cacheKey + ':lock'
    lockTTL ← 10 // 10 seconds

    acquired ← RedisCache.setNX(lockKey, '1', EX: lockTTL)

    IF acquired THEN
        // This request will fetch the data
        TRY
            data ← fetchFunction()
            RedisCache.setex(cacheKey, ttl, data)
            RETURN data
        FINALLY
            RedisCache.del(lockKey)
        END TRY
    ELSE
        // Another request is fetching, wait and retry
        FOR attempt FROM 1 TO 5 DO
            Sleep(100 * attempt) // Exponential backoff: 100ms, 200ms, 400ms...

            data ← RedisCache.get(cacheKey)
            IF data is not NULL THEN
                RETURN data
            END IF
        END FOR

        // Timeout: fetch anyway (fallback)
        data ← fetchFunction()
        RETURN data
    END IF

COMPLEXITY:
    Time: O(1) + O(f) for fetch
    Space: O(1)

PATTERN: Distributed lock with exponential backoff
```

---

## 5. Performance Optimizations

### 5.1 DataLoader Pattern (N+1 Prevention)

```
ALGORITHM: BatchLoadPostLikes
INPUT:
    postUserPairs (array of {postId, userId}) - batch of post-user pairs to check

OUTPUT:
    likesMap (map) - map of "postId:userId" → boolean (isLiked)

STEPS:
1. Extract unique post IDs and user IDs
    postIds ← []
    userIds ← []
    FOR EACH pair IN postUserPairs DO
        postIds.append(pair.postId)
        userIds.append(pair.userId)
    END FOR

    postIds ← UniqueValues(postIds)
    userIds ← UniqueValues(userIds)

2. Batch query for likes
    likes ← Database.postLikes.findMany({
        where: {
            postId: IN postIds,
            userId: IN userIds
        }
    })
    // Single query instead of N queries!

3. Build lookup map
    likesMap ← new Map()
    FOR EACH like IN likes DO
        key ← like.postId + ':' + like.userId
        likesMap.set(key, true)
    END FOR

4. Fill in missing entries
    FOR EACH pair IN postUserPairs DO
        key ← pair.postId + ':' + pair.userId
        IF NOT likesMap.has(key) THEN
            likesMap.set(key, false)
        END IF
    END FOR

5. Return likes map
    RETURN likesMap

COMPLEXITY:
    Time: O(n + m) where n = pairs, m = likes found
    Space: O(m)

BENEFITS:
    - Reduces N+1 queries to single batch query
    - Dramatically improves feed rendering performance
    - Typical improvement: 20+ queries → 1 query
```

---

### 5.2 Database Connection Pooling

```
CONFIGURATION: DatabaseConnectionPool

PARAMETERS:
    min: 5,                    // Minimum connections always open
    max: 20,                   // Maximum connections per instance
    acquireTimeout: 30000,     // 30 seconds timeout
    idleTimeout: 300000,       // 5 minutes idle timeout
    connectionTimeout: 5000,   // 5 seconds connection timeout
    statementTimeout: 30000,   // 30 seconds query timeout

STRATEGY:
    - Maintain minimum 5 connections for fast response
    - Scale up to 20 connections under load
    - Close idle connections after 5 minutes
    - Total connections across all instances: 100 (5 instances × 20)

MONITORING:
    - Track connection pool exhaustion
    - Alert if > 80% connections in use for > 1 minute
    - Monitor slow queries (> 1 second)
```

---

### 5.3 Query Optimization with EXPLAIN ANALYZE

```
EXAMPLE: Home Feed Query Optimization

BEFORE OPTIMIZATION:
    Query: SELECT * FROM posts WHERE author_id IN (...)
    Execution Plan: Seq Scan on posts (cost=0..50000 rows=100000)
    Execution Time: 850ms
    Problem: Full table scan

AFTER ADDING INDEX (idx_posts_home_feed):
    Query: SELECT * FROM posts
           WHERE author_id IN (...)
           AND status = 'published'
           AND is_deleted = false
           ORDER BY created_at DESC
           LIMIT 20

    Execution Plan:
        Index Scan using idx_posts_home_feed on posts
        (cost=0..25 rows=20)
        Index Cond: (author_id = ANY(...))
        Filter: (status = 'published' AND is_deleted = false)

    Execution Time: 45ms
    Improvement: 95% faster (850ms → 45ms)

KEY OPTIMIZATIONS:
    1. Composite index on (author_id, created_at DESC, status, is_deleted)
    2. Partial index with WHERE clause to reduce index size
    3. Covering index includes all needed columns
    4. Index-only scan avoids table lookups
```

---

## 6. Data Structures

### 6.1 Feed Item Structure

```
STRUCTURE: FeedItem
{
    post: Post {
        id: UUID,
        authorId: UUID,
        groupId: UUID or NULL,
        content: string (sanitized),
        mediaUrls: array of strings,
        visibility: enum ('public', 'group', 'private'),
        status: enum ('published', 'draft', 'scheduled'),
        createdAt: timestamp,
        updatedAt: timestamp,
        likesCount: integer,
        commentsCount: integer,
        sharesCount: integer,
        isPinned: boolean,
        isDeleted: boolean
    },
    author: UserPreview {
        id: UUID,
        username: string,
        displayName: string,
        avatarUrl: string
    },
    group: GroupPreview or NULL {
        id: UUID,
        name: string,
        privacy: enum
    },
    userInteractions: {
        isLikedByUser: boolean,
        isBookmarkedByUser: boolean
    },
    engagementScore: float (0.0 - 1.0)
}

MEMORY_SIZE: ~500 bytes per feed item (compressed)
```

---

### 6.2 Cache Key Structure (Redis)

```
STRUCTURE: CacheKeyFormat

PATTERN: {resource}:{identifier}:{sub-resource}:{version}

EXAMPLES:
    feed:home:user:12345:page:1:v1
    feed:group:67890:page:1:v1
    feed:profile:user:12345:viewer:54321:page:1:v1
    post:12345:v1
    post:12345:comments:page:1:v1
    post:12345:likes:count:v1

KEY_NAMESPACE_SHARDING:
    Shard 0: feed:*      (Feed cache)
    Shard 1: user:*      (User data & sessions)
    Shard 2: post:*      (Content cache)

VERSIONING_STRATEGY:
    - Increment version when schema changes
    - Old cache keys auto-expire, no manual migration
    - Example: v1 → v2 when adding new field to feed item
```

---

### 6.3 LRU Cache (L1 Memory Cache)

```
STRUCTURE: LRUCache<K, V>

PROPERTIES:
    capacity: integer (max 1000 items)
    cache: Map<K, {value: V, timestamp: number}>
    lruList: DoublyLinkedList<K>

OPERATIONS:
    get(key: K) → V or NULL:
        Time: O(1)
        Steps:
            1. Check if key exists in cache
            2. If found, move to front of LRU list
            3. Return value

    set(key: K, value: V, ttl: number):
        Time: O(1)
        Steps:
            1. If cache is full, evict least recently used (tail of LRU list)
            2. Insert new entry at front of LRU list
            3. Store in map with timestamp

    evict():
        Time: O(1)
        Steps:
            1. Remove tail of LRU list
            2. Delete from map
            3. Return evicted key

MEMORY_MANAGEMENT:
    - Max size: 50MB per Node.js instance
    - Auto-eviction when capacity exceeded
    - TTL-based expiration (check on access)

USAGE_PATTERN:
    - Store hot feed data (last 1000 accessed feeds)
    - Fast access for frequently viewed feeds
    - Reduces Redis latency for hot data
```

---

## 7. Complexity Analysis

### 7.1 Time Complexity Summary

| Operation | Best Case | Average Case | Worst Case | Notes |
|-----------|-----------|--------------|------------|-------|
| **Create Post** | O(1) | O(m) | O(m + n) | m=content length, n=media URLs |
| **Edit Post** | O(1) | O(m) | O(m + h) | h=history size |
| **Delete Post** | O(1) | O(1) | O(1) | Soft delete only |
| **Like/Unlike Post** | O(1) | O(1) | O(1) | Atomic counter update |
| **Home Feed (cached)** | O(1) | O(1) | O(1) | L1/L2 cache hit |
| **Home Feed (miss)** | O(log m + n log n) | O(log m + n log n) | O(m + n log n) | m=total posts, n=fetched |
| **Group Feed** | O(1) | O(log m + n) | O(m + n) | Smaller dataset than home |
| **Profile Feed** | O(1) | O(log m + n) | O(m + n) | Single author filter |
| **XSS Sanitization** | O(m) | O(m) | O(m) | m=content length |
| **Cache Invalidation** | O(1) | O(k) | O(k) | k=matching keys |
| **DataLoader Batch** | O(n + m) | O(n + m) | O(n + m) | n=requests, m=results |

---

### 7.2 Space Complexity Summary

| Component | Space Complexity | Maximum Size | Notes |
|-----------|------------------|--------------|-------|
| **Post Record** | O(m) | ~10KB | m=content length |
| **Feed Result (20 posts)** | O(n × m) | ~200KB | n=posts, m=avg size |
| **L1 Cache (LRU)** | O(c × s) | 50MB | c=1000 items, s=50KB avg |
| **L2 Cache (Redis)** | O(u × f) | 4GB shard | u=users, f=feed size |
| **Database Indexes** | O(r × log r) | 22% of table | r=rows |

---

### 7.3 Performance Target Summary

| Metric | Target | Critical Path |
|--------|--------|---------------|
| **Create Post p95** | < 150ms | Sanitization + DB insert + cache invalidation |
| **Home Feed p95 (cached)** | < 10ms | L1 cache hit |
| **Home Feed p95 (Redis)** | < 50ms | L2 cache hit |
| **Home Feed p95 (miss)** | < 150ms | DB query + scoring + caching |
| **Like/Unlike p95** | < 50ms | Atomic counter + cache update |
| **XSS Sanitization p95** | < 5ms | DOMPurify processing |
| **Cache Invalidation p95** | < 20ms | Redis SCAN + DEL |

---

## 8. Implementation Checklist

### Phase 1: Core Post Operations (Week 1)
- [ ] Implement CreatePost with XSS sanitization
- [ ] Implement EditPost with 5-minute window check
- [ ] Implement DeletePost with soft delete
- [ ] Implement ToggleLikePost with atomic counters
- [ ] Add database indexes (idx_posts_home_feed, etc.)
- [ ] Write unit tests for post operations (30+ XSS vectors)

### Phase 2: Feed Generation (Week 2)
- [ ] Implement GenerateHomeFeed with engagement scoring
- [ ] Implement GenerateGroupFeed with pinned posts
- [ ] Implement GenerateUserProfileFeed with privacy filters
- [ ] Add cursor-based pagination
- [ ] Implement DataLoader for N+1 prevention
- [ ] Write integration tests for feed algorithms

### Phase 3: Caching Layer (Week 3)
- [ ] Set up Redis cluster (3 shards)
- [ ] Implement L1 LRU cache (in-memory)
- [ ] Implement L2 Redis cache with read-through pattern
- [ ] Implement cache invalidation service (event-driven)
- [ ] Implement cache warming on login
- [ ] Monitor cache hit rates (target: > 85%)

### Phase 4: Security & Optimization (Week 4)
- [ ] Implement CSP header generation with nonces
- [ ] Add security headers (X-Frame-Options, etc.)
- [ ] Set up CSP violation reporting endpoint
- [ ] Configure database connection pooling
- [ ] Run EXPLAIN ANALYZE on all queries
- [ ] Load test with 500 concurrent users

### Phase 5: Monitoring & Production (Week 5)
- [ ] Set up performance monitoring (Datadog/New Relic)
- [ ] Configure alerts (p95 > 200ms, cache hit rate < 80%)
- [ ] Implement distributed tracing
- [ ] Load test with 10,000 users simulation
- [ ] Security audit with OWASP ZAP
- [ ] Production deployment with feature flags

---

## Appendix A: Pseudocode Notation Reference

**Data Types:**
- `UUID` - Universally unique identifier
- `string` - Text string
- `integer` - Whole number
- `float` - Floating-point number
- `boolean` - true/false
- `timestamp` - Date and time
- `enum` - Enumerated type
- `array` - Ordered collection
- `map` - Key-value dictionary

**Operators:**
- `←` - Assignment
- `=` - Equality check
- `≠` - Not equal
- `>`, `<`, `≥`, `≤` - Comparison
- `AND`, `OR`, `NOT` - Logical operators
- `IN` - Membership test
- `+` - Addition/concatenation

**Control Flow:**
- `IF ... THEN ... ELSE ... END IF`
- `FOR EACH ... DO ... END FOR`
- `WHILE ... DO ... END WHILE`
- `SWITCH ... CASE ... END SWITCH`
- `TRY ... CATCH ... FINALLY ... END TRY`

**Functions:**
- `ALGORITHM:` - Main algorithm definition
- `SUBROUTINE:` - Helper function
- `RETURN` - Return value from function

---

**Document Status:** ✅ READY FOR IMPLEMENTATION
**Next Phase:** Phase 3 (Architecture) - System design and component diagrams
**Estimated Implementation Time:** 5 weeks (1 developer)
**Risk Level:** MEDIUM (complexity in feed ranking and caching)

**Sign-Off:**
- SPARC Pseudocode Agent: ✅ Complete
- Ready for Technical Review: ✅
- Ready for Implementation: ✅

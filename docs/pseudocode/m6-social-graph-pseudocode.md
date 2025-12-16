# M6 Social Graph & Follow System - Pseudocode

**Project**: Community Social Network MVP
**Milestone**: M6 - Social Features
**Phase**: SPARC Phase 2 - Pseudocode
**Version**: 1.0.0
**Date**: 2025-12-16
**Status**: PSEUDOCODE COMPLETE

---

## Table of Contents

1. [Follow System Algorithms](#1-follow-system-algorithms)
2. [Privacy Enforcement Algorithms](#2-privacy-enforcement-algorithms)
3. [Personalized Feed Algorithms](#3-personalized-feed-algorithms)
4. [Suggestion Algorithms](#4-suggestion-algorithms)
5. [Block System Algorithms](#5-block-system-algorithms)
6. [Data Structure Definitions](#6-data-structure-definitions)
7. [Complexity Analysis Summary](#7-complexity-analysis-summary)

---

## 1. Follow System Algorithms

### 1.1 Follow User

```
ALGORITHM: FollowUser
INPUT: followerId (UUID), targetId (UUID)
OUTPUT: FollowResult {status: string, follow: Follow object}
PRECONDITIONS:
  - Both users exist in database
  - followerId and targetId are valid UUIDs
POSTCONDITIONS:
  - Follow relationship created or updated
  - Follower/following counts updated via trigger
  - Notification sent to target user

BEGIN
    // Step 1: Input validation
    IF followerId == targetId THEN
        THROW BadRequestError("Cannot follow yourself")
    END IF

    // Step 2: Check if blocked (bidirectional)
    isBlocked ← Database.Query("
        SELECT EXISTS(
            SELECT 1 FROM blocks
            WHERE (blocker_id = ? AND blocked_id = ?)
               OR (blocker_id = ? AND blocked_id = ?)
        )", [targetId, followerId, followerId, targetId])

    IF isBlocked THEN
        RETURN {status: "blocked", follow: null}
    END IF

    // Step 3: Check existing follow relationship
    existingFollow ← Database.FindOne("follows", {
        follower_id: followerId,
        following_id: targetId
    })

    IF existingFollow != null AND existingFollow.status == "active" THEN
        RETURN {status: "already_following", follow: existingFollow}
    END IF

    // Step 4: Get target privacy settings
    targetProfile ← Database.FindOne("user_profiles", {
        user_id: targetId
    })

    requiresApproval ← targetProfile.follow_approval_required OR false

    // Step 5: Determine follow status
    IF requiresApproval THEN
        newStatus ← "pending"
    ELSE
        newStatus ← "active"
    END IF

    // Step 6: Create or update follow relationship
    follow ← Database.Upsert("follows", {
        WHERE: {
            follower_id: followerId,
            following_id: targetId
        },
        CREATE: {
            id: GenerateUUID(),
            follower_id: followerId,
            following_id: targetId,
            status: newStatus,
            created_at: NOW()
        },
        UPDATE: {
            status: newStatus
        }
    })

    // Step 7: Send appropriate notification
    IF newStatus == "active" THEN
        followerName ← GetUserDisplayName(followerId)
        NotificationService.Create({
            type: "follow",
            user_id: targetId,
            actor_id: followerId,
            entity_type: "user",
            entity_id: followerId,
            message: followerName + " started following you"
        })
        returnStatus ← "followed"
    ELSE
        followerName ← GetUserDisplayName(followerId)
        NotificationService.Create({
            type: "follow_request",
            user_id: targetId,
            actor_id: followerId,
            entity_type: "user",
            entity_id: followerId,
            message: followerName + " requested to follow you"
        })
        returnStatus ← "pending"
    END IF

    RETURN {status: returnStatus, follow: follow}
END

COMPLEXITY:
  - Time: O(1) - Fixed number of database queries with indexes
  - Space: O(1) - Constant space for variables

PRIVACY:
  - Checks block status before allowing follow
  - Respects privacy settings (approval required)
  - No data leakage to blocked users
```

### 1.2 Unfollow User

```
ALGORITHM: UnfollowUser
INPUT: followerId (UUID), targetId (UUID)
OUTPUT: boolean (success)
PRECONDITIONS:
  - Follow relationship exists
  - followerId and targetId are valid
POSTCONDITIONS:
  - Follow relationship deleted
  - Counts decremented via trigger
  - No notification sent (by design)

BEGIN
    // Step 1: Validation
    IF followerId == targetId THEN
        THROW BadRequestError("Cannot unfollow yourself")
    END IF

    // Step 2: Delete follow relationship
    deletedCount ← Database.Delete("follows", {
        follower_id: followerId,
        following_id: targetId
    })

    // Step 3: Verify deletion
    IF deletedCount == 0 THEN
        THROW NotFoundError("Follow relationship not found")
    END IF

    // Note: Counts are updated automatically via database trigger
    // No notification sent to preserve user privacy

    RETURN true
END

COMPLEXITY:
  - Time: O(1) - Single indexed delete query
  - Space: O(1) - Constant space

PRIVACY:
  - Silent operation (no notification to target)
  - Prevents harassment tracking
```

### 1.3 Approve Follow Request

```
ALGORITHM: ApproveFollowRequest
INPUT: userId (UUID), requesterId (UUID)
OUTPUT: Follow object
PRECONDITIONS:
  - Pending follow request exists
  - userId is the target of the follow
POSTCONDITIONS:
  - Follow status changed to "active"
  - Counts updated via trigger
  - Approval notification sent

BEGIN
    // Step 1: Update follow status from pending to active
    follow ← Database.Update("follows", {
        WHERE: {
            follower_id: requesterId,
            following_id: userId,
            status: "pending"
        },
        DATA: {
            status: "active"
        }
    })

    // Step 2: Verify update occurred
    IF follow == null THEN
        THROW NotFoundError("Pending follow request not found")
    END IF

    // Step 3: Send approval notification
    userName ← GetUserDisplayName(userId)
    NotificationService.Create({
        type: "follow_approved",
        user_id: requesterId,
        actor_id: userId,
        entity_type: "user",
        entity_id: userId,
        message: userName + " approved your follow request"
    })

    RETURN follow
END

COMPLEXITY:
  - Time: O(1) - Single indexed update
  - Space: O(1) - Constant space

PRIVACY:
  - Only target user can approve their requests
  - Notification confirms approval to requester
```

### 1.4 Reject Follow Request

```
ALGORITHM: RejectFollowRequest
INPUT: userId (UUID), requesterId (UUID)
OUTPUT: void
PRECONDITIONS:
  - Pending follow request exists
  - userId is the target of the follow
POSTCONDITIONS:
  - Follow relationship deleted
  - No notification sent (anti-harassment)

BEGIN
    // Step 1: Delete pending follow request
    deletedCount ← Database.Delete("follows", {
        follower_id: requesterId,
        following_id: userId,
        status: "pending"
    })

    // Step 2: Verify deletion
    IF deletedCount == 0 THEN
        THROW NotFoundError("Pending follow request not found")
    END IF

    // Step 3: No notification sent (by design to prevent harassment)
    // Silent rejection protects user privacy

    RETURN
END

COMPLEXITY:
  - Time: O(1) - Single indexed delete
  - Space: O(1) - Constant space

PRIVACY:
  - Silent rejection prevents harassment
  - Requester cannot detect rejection vs pending
```

### 1.5 Get Relationship Status

```
ALGORITHM: GetRelationshipStatus
INPUT: viewerId (UUID), targetId (UUID)
OUTPUT: RelationshipStatus {
    type: "self" | "follower" | "following" | "mutual" | "none" | "blocked",
    isFollowing: boolean,
    isFollower: boolean,
    isMutual: boolean,
    isBlocked: boolean
}
PRECONDITIONS:
  - viewerId and targetId are valid UUIDs
POSTCONDITIONS:
  - Returns accurate relationship state

BEGIN
    // Step 1: Check if viewing own profile
    IF viewerId == targetId THEN
        RETURN {
            type: "self",
            isFollowing: false,
            isFollower: false,
            isMutual: false,
            isBlocked: false
        }
    END IF

    // Step 2: Check for block (bidirectional)
    block ← Database.FindOne("blocks", {
        OR: [
            {blocker_id: viewerId, blocked_id: targetId},
            {blocker_id: targetId, blocked_id: viewerId}
        ]
    })

    IF block != null THEN
        RETURN {
            type: "blocked",
            isFollowing: false,
            isFollower: false,
            isMutual: false,
            isBlocked: true
        }
    END IF

    // Step 3: Check follow relationships in parallel
    PARALLEL_EXECUTE(
        viewerFollowsTarget ← Database.FindOne("follows", {
            follower_id: viewerId,
            following_id: targetId,
            status: "active"
        }),
        targetFollowsViewer ← Database.FindOne("follows", {
            follower_id: targetId,
            following_id: viewerId,
            status: "active"
        })
    )

    // Step 4: Determine relationship type
    isFollowing ← (viewerFollowsTarget != null)
    isFollower ← (targetFollowsViewer != null)
    isMutual ← (isFollowing AND isFollower)

    IF isMutual THEN
        type ← "mutual"
    ELSE IF isFollowing THEN
        type ← "following"
    ELSE IF isFollower THEN
        type ← "follower"
    ELSE
        type ← "none"
    END IF

    RETURN {
        type: type,
        isFollowing: isFollowing,
        isFollower: isFollower,
        isMutual: isMutual,
        isBlocked: false
    }
END

COMPLEXITY:
  - Time: O(1) - Three indexed queries (two in parallel)
  - Space: O(1) - Constant space

PRIVACY:
  - Block status revealed to both parties
  - Follow status computed accurately
```

---

## 2. Privacy Enforcement Algorithms

### 2.1 Get Privacy Context

```
ALGORITHM: GetPrivacyContext
INPUT: viewerId (UUID or null), targetId (UUID)
OUTPUT: PrivacyContext {
    viewer: User object or null,
    target: User object,
    relationship: string
}
PRECONDITIONS:
  - targetId references existing user
POSTCONDITIONS:
  - Returns complete privacy context for authorization

BEGIN
    // Step 1: Fetch target user with profile
    target ← Database.FindOne("users", {
        id: targetId,
        include: ["profile"]
    })

    IF target == null THEN
        THROW NotFoundError("User not found")
    END IF

    // Step 2: Handle anonymous viewer
    IF viewerId == null THEN
        RETURN {
            viewer: null,
            target: target,
            relationship: "none"
        }
    END IF

    // Step 3: Handle self-viewing
    IF viewerId == targetId THEN
        RETURN {
            viewer: target,
            target: target,
            relationship: "self"
        }
    END IF

    // Step 4: Check for block (either direction)
    block ← Database.FindOne("blocks", {
        OR: [
            {blocker_id: targetId, blocked_id: viewerId},
            {blocker_id: viewerId, blocked_id: targetId}
        ]
    })

    IF block != null THEN
        RETURN {
            viewer: null,  // Hide viewer info when blocked
            target: target,
            relationship: "blocked"
        }
    END IF

    // Step 5: Fetch viewer and check follow relationships in parallel
    PARALLEL_EXECUTE(
        viewer ← Database.FindOne("users", {id: viewerId}),
        viewerFollowsTarget ← Database.FindOne("follows", {
            follower_id: viewerId,
            following_id: targetId,
            status: "active"
        }),
        targetFollowsViewer ← Database.FindOne("follows", {
            follower_id: targetId,
            following_id: viewerId,
            status: "active"
        })
    )

    // Step 6: Determine relationship type
    IF viewerFollowsTarget != null AND targetFollowsViewer != null THEN
        relationship ← "mutual"
    ELSE IF viewerFollowsTarget != null THEN
        relationship ← "following"
    ELSE IF targetFollowsViewer != null THEN
        relationship ← "follower"
    ELSE
        relationship ← "none"
    END IF

    RETURN {
        viewer: viewer,
        target: target,
        relationship: relationship
    }
END

COMPLEXITY:
  - Time: O(1) - Fixed indexed queries (3 in parallel)
  - Space: O(1) - Constant space for context

PRIVACY:
  - Blocks prevent all relationship info leakage
  - Anonymous viewers get minimal context
```

### 2.2 Check Content Visibility

```
ALGORITHM: CanViewContent
INPUT:
    privacyContext (PrivacyContext),
    contentType ("profile" | "posts" | "followers" | "following")
OUTPUT: boolean
PRECONDITIONS:
  - privacyContext is valid
POSTCONDITIONS:
  - Returns true if viewer can access content type

BEGIN
    relationship ← privacyContext.relationship
    target ← privacyContext.target
    visibility ← target.profile.visibility OR "public"

    // Step 1: Self can always see everything
    IF relationship == "self" THEN
        RETURN true
    END IF

    // Step 2: Blocked users see nothing
    IF relationship == "blocked" THEN
        RETURN false
    END IF

    // Step 3: Apply visibility rules by privacy level
    SWITCH visibility
        CASE "public":
            // Everyone can see everything on public profiles
            RETURN true

        CASE "private":
            // Profile visible to all, content only to followers
            IF contentType == "profile" THEN
                RETURN true
            END IF

            // Check if viewer is follower or mutual
            IF relationship IN ["follower", "following", "mutual"] THEN
                RETURN true
            END IF

            RETURN false

        CASE "friends-only":
            // Profile visible to all, content only to mutual followers
            IF contentType == "profile" THEN
                RETURN true
            END IF

            // Only mutual followers can see content
            IF relationship == "mutual" THEN
                RETURN true
            END IF

            RETURN false

        DEFAULT:
            // Unknown visibility level - deny access
            RETURN false
    END SWITCH
END

COMPLEXITY:
  - Time: O(1) - Simple conditional logic
  - Space: O(1) - No additional storage

PRIVACY:
  - Implements three-tier privacy model
  - Profile always visible (for discovery)
  - Content restricted by privacy level
```

### 2.3 Filter Visible Content

```
ALGORITHM: FilterVisibleContent
INPUT:
    viewerId (UUID or null),
    contentList (array of Content objects),
    contentType (string)
OUTPUT: array of Content objects
PRECONDITIONS:
  - contentList contains content with author_id field
POSTCONDITIONS:
  - Returns only content viewer is authorized to see

BEGIN
    // Step 1: Get unique author IDs
    authorIds ← SET()
    FOR EACH content IN contentList DO
        authorIds.ADD(content.author_id)
    END FOR

    // Step 2: Batch fetch privacy contexts (optimized)
    privacyContextMap ← MAP()

    FOR EACH authorId IN authorIds DO
        context ← GetPrivacyContext(viewerId, authorId)
        privacyContextMap[authorId] ← context
    END FOR

    // Step 3: Filter content based on visibility
    visibleContent ← []

    FOR EACH content IN contentList DO
        authorId ← content.author_id
        context ← privacyContextMap[authorId]

        canView ← CanViewContent(context, contentType)

        IF canView THEN
            visibleContent.APPEND(content)
        END IF
    END FOR

    RETURN visibleContent
END

COMPLEXITY:
  - Time: O(n + m) where n = content count, m = unique authors
  - Space: O(m) for privacy context map

PRIVACY:
  - Batch processing for efficiency
  - Each content item checked individually
  - Respects all privacy settings
```

---

## 3. Personalized Feed Algorithms

### 3.1 Generate Personalized Feed

```
ALGORITHM: GeneratePersonalizedFeed
INPUT: FeedOptions {
    userId (UUID),
    cursor (string, optional),
    limit (integer, default 20)
}
OUTPUT: FeedResult {
    posts: array of FeedItem,
    nextCursor: string or null,
    hasMore: boolean
}
PRECONDITIONS:
  - userId references existing user
  - limit > 0 and limit <= 100
POSTCONDITIONS:
  - Returns scored and sorted feed posts
  - Cursor supports pagination

BEGIN
    // Step 1: Get user's social graph (following list)
    followingList ← Database.Query("
        SELECT following_id
        FROM follows
        WHERE follower_id = ? AND status = 'active'
    ", [userId])

    followingIds ← ARRAY(followingList.map(f => f.following_id))

    // Step 2: Get user's groups
    groupMemberships ← Database.Query("
        SELECT group_id
        FROM group_members
        WHERE user_id = ?
    ", [userId])

    groupIds ← ARRAY(groupMemberships.map(g => g.group_id))

    // Step 3: Decode pagination cursor
    IF cursor != null THEN
        cursorDate ← DecodeBase64(cursor).ToDate()
    ELSE
        cursorDate ← NOW()
    END IF

    // Step 4: Generate feed with scoring (complex SQL query)
    posts ← Database.QueryRaw("
        WITH scored_posts AS (
            SELECT
                p.*,
                CASE
                    WHEN p.author_id = ANY(?) THEN 'following'
                    WHEN p.group_id = ANY(?) THEN 'group'
                    ELSE 'trending'
                END as reason,
                -- FEED SCORING FORMULA --
                (
                    -- Recency factor (exponential decay over 24 hours)
                    -- Newer posts score higher (0-100 points)
                    EXP(-EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400) * 100

                    -- Engagement factor (weighted by interaction type)
                    + p.likes_count * 2        -- 2 points per like
                    + p.comments_count * 3     -- 3 points per comment
                    + p.shares_count * 5       -- 5 points per share

                    -- Following bonus (prioritize followed users)
                    + CASE WHEN p.author_id = ANY(?) THEN 50 ELSE 0 END

                    -- Group bonus (prioritize group content)
                    + CASE WHEN p.group_id = ANY(?) THEN 30 ELSE 0 END
                ) as score
            FROM posts p
            WHERE
                -- Pagination filter
                p.created_at < ?

                -- Not deleted
                AND p.deleted_at IS NULL

                -- Content filtering criteria
                AND (
                    -- Posts from people I follow
                    p.author_id = ANY(?)

                    -- Posts in my groups
                    OR p.group_id = ANY(?)

                    -- Trending posts (high engagement in last 24h)
                    OR (
                        p.created_at > NOW() - INTERVAL '24 hours'
                        AND p.likes_count > 10
                    )
                )

                -- Exclude blocked users (privacy enforcement)
                AND NOT EXISTS (
                    SELECT 1 FROM blocks b
                    WHERE b.blocker_id = ? AND b.blocked_id = p.author_id
                )
        )
        SELECT * FROM scored_posts
        ORDER BY score DESC, created_at DESC
        LIMIT ?
    ", [
        followingIds, groupIds,            -- Reason classification
        followingIds, groupIds,            -- Score bonuses
        cursorDate,                        -- Pagination
        followingIds, groupIds,            -- Content filtering
        userId,                            -- Block filter
        limit + 1                          -- Fetch one extra for pagination
    ])

    // Step 5: Process pagination
    hasMore ← (posts.length > limit)
    feedPosts ← posts.slice(0, limit)

    IF hasMore THEN
        lastPost ← feedPosts[feedPosts.length - 1]
        nextCursor ← EncodeBase64(lastPost.created_at.ToISOString())
    ELSE
        nextCursor ← null
    END IF

    // Step 6: Format feed items
    feedItems ← []
    FOR EACH post IN feedPosts DO
        feedItems.APPEND({
            post: post,
            score: post.score,
            reason: post.reason
        })
    END FOR

    RETURN {
        posts: feedItems,
        nextCursor: nextCursor,
        hasMore: hasMore
    }
END

COMPLEXITY:
  - Time: O(n log n) where n = candidate posts (limited by query)
  - Space: O(n) for result set
  - Database: O(log n) with proper indexes on created_at, author_id

PRIVACY:
  - Excludes blocked users automatically
  - Respects privacy via privacy middleware in post fetch

OPTIMIZATION NOTES:
  - Use materialized view for trending posts calculation
  - Consider pre-computing following/group IDs in Redis cache
  - Limit query to recent posts (e.g., last 7 days) for scalability
```

### 3.2 Feed Scoring Formula (Detailed)

```
ALGORITHM: CalculateFeedScore
INPUT: Post {
    created_at (timestamp),
    likes_count (integer),
    comments_count (integer),
    shares_count (integer),
    author_id (UUID),
    group_id (UUID or null)
}, Context {
    followingIds (array of UUID),
    groupIds (array of UUID)
}
OUTPUT: score (float)

BEGIN
    // Component 1: Recency Factor (0-100 points)
    // Uses exponential decay: score = 100 at t=0, ~37 at t=24h
    hoursOld ← (NOW() - post.created_at).ToHours()
    recencyScore ← EXP(-hoursOld / 24) * 100

    // Component 2: Engagement Score
    // Weighted by interaction value:
    // - Likes: 2 points (low effort)
    // - Comments: 3 points (medium effort, discussion)
    // - Shares: 5 points (high effort, endorsement)
    engagementScore ← (post.likes_count * 2) +
                      (post.comments_count * 3) +
                      (post.shares_count * 5)

    // Component 3: Following Bonus (0 or 50 points)
    // Prioritize content from followed users
    IF post.author_id IN followingIds THEN
        followingBonus ← 50
    ELSE
        followingBonus ← 0
    END IF

    // Component 4: Group Bonus (0 or 30 points)
    // Prioritize content from user's groups
    IF post.group_id IN groupIds THEN
        groupBonus ← 30
    ELSE
        groupBonus ← 0
    END IF

    // Final Score Calculation
    totalScore ← recencyScore + engagementScore + followingBonus + groupBonus

    RETURN totalScore
END

COMPLEXITY:
  - Time: O(1) - Simple arithmetic operations
  - Space: O(1) - No additional storage

TUNING PARAMETERS:
  - Recency decay rate: 24 hours (adjust for faster/slower decay)
  - Like weight: 2 (increase for like-heavy platforms)
  - Comment weight: 3 (increase to prioritize discussion)
  - Share weight: 5 (highest value for viral content)
  - Following bonus: 50 (balance between following and discovery)
  - Group bonus: 30 (balance between groups and personal feed)
```

### 3.3 Feed Cache Management

```
ALGORITHM: GetCachedFeed
INPUT: userId (UUID), cursor (string or null)
OUTPUT: FeedResult or null
PRECONDITIONS:
  - Redis connection available
POSTCONDITIONS:
  - Returns cached feed if available and fresh

BEGIN
    // Step 1: Generate cache key
    cursorKey ← cursor OR "initial"
    cacheKey ← "feed:" + userId + ":" + cursorKey

    // Step 2: Fetch from Redis
    cachedData ← Redis.Get(cacheKey)

    IF cachedData == null THEN
        RETURN null
    END IF

    // Step 3: Parse and return cached data
    feedResult ← JSON.Parse(cachedData)
    RETURN feedResult
END

ALGORITHM: CacheFeed
INPUT: userId (UUID), feedResult (FeedResult), cursor (string or null)
OUTPUT: void
PRECONDITIONS:
  - feedResult is valid
  - Redis connection available
POSTCONDITIONS:
  - Feed cached with TTL

BEGIN
    // Step 1: Generate cache key
    cursorKey ← cursor OR "initial"
    cacheKey ← "feed:" + userId + ":" + cursorKey

    // Step 2: Serialize feed data
    serializedFeed ← JSON.Stringify(feedResult)

    // Step 3: Store in Redis with TTL (5 minutes)
    CACHE_TTL ← 5 * 60  // 300 seconds
    Redis.SetEx(cacheKey, CACHE_TTL, serializedFeed)

    RETURN
END

ALGORITHM: InvalidateFeedCache
INPUT: userId (UUID)
OUTPUT: void
PRECONDITIONS:
  - Redis connection available
POSTCONDITIONS:
  - All feed cache entries for user deleted

BEGIN
    // Step 1: Find all cache keys for user
    pattern ← "feed:" + userId + ":*"
    cacheKeys ← Redis.Keys(pattern)

    // Step 2: Delete all matching keys
    IF cacheKeys.length > 0 THEN
        Redis.Del(...cacheKeys)
    END IF

    RETURN
END

COMPLEXITY:
  - GetCachedFeed: O(1) - Single Redis GET
  - CacheFeed: O(1) - Single Redis SETEX
  - InvalidateFeedCache: O(k) where k = number of cached pages

CACHE INVALIDATION TRIGGERS:
  - New post created by followed user
  - User follows/unfollows someone
  - User joins/leaves a group
  - Post engagement updates (batch invalidate)
```

---

## 4. Suggestion Algorithms

### 4.1 Follow Suggestions (Mutual Connections)

```
ALGORITHM: GetFollowSuggestions
INPUT: userId (UUID), limit (integer, default 10)
OUTPUT: array of SuggestedUser {
    user: User object,
    mutualCount: integer,
    reason: string
}
PRECONDITIONS:
  - userId references existing user
  - limit > 0 and limit <= 50
POSTCONDITIONS:
  - Returns users sorted by mutual connection count

BEGIN
    // Step 1: Get current following list
    currentFollowing ← Database.Query("
        SELECT following_id
        FROM follows
        WHERE follower_id = ? AND status = 'active'
    ", [userId])

    followingIds ← ARRAY(currentFollowing.map(f => f.following_id))

    // Step 2: Find second-degree connections (friends of friends)
    // Query users followed by users I follow, excluding:
    // - Myself
    // - Users I already follow
    // - Users who blocked me or I blocked
    suggestions ← Database.Query("
        SELECT
            f2.following_id as suggested_user_id,
            COUNT(*) as mutual_count,
            ARRAY_AGG(DISTINCT f1.following_id) as mutual_friends
        FROM follows f1
        INNER JOIN follows f2 ON f1.following_id = f2.follower_id
        WHERE
            -- Start from users I follow
            f1.follower_id = ?
            AND f1.status = 'active'

            -- Their follows become suggestions
            AND f2.status = 'active'

            -- Exclude myself
            AND f2.following_id != ?

            -- Exclude users I already follow
            AND f2.following_id NOT IN (
                SELECT following_id FROM follows
                WHERE follower_id = ? AND status = 'active'
            )

            -- Exclude blocked users (bidirectional)
            AND NOT EXISTS (
                SELECT 1 FROM blocks b
                WHERE (b.blocker_id = ? AND b.blocked_id = f2.following_id)
                   OR (b.blocker_id = f2.following_id AND b.blocked_id = ?)
            )
        GROUP BY f2.following_id
        ORDER BY mutual_count DESC, RANDOM()
        LIMIT ?
    ", [userId, userId, userId, userId, userId, limit])

    // Step 3: Fetch suggested user details
    suggestedUserIds ← suggestions.map(s => s.suggested_user_id)
    users ← Database.Query("
        SELECT id, username, display_name, avatar_url, followers_count
        FROM users
        WHERE id = ANY(?)
    ", [suggestedUserIds])

    // Step 4: Create user lookup map
    userMap ← MAP()
    FOR EACH user IN users DO
        userMap[user.id] ← user
    END FOR

    // Step 5: Format suggestions
    result ← []
    FOR EACH suggestion IN suggestions DO
        userId ← suggestion.suggested_user_id
        user ← userMap[userId]

        result.APPEND({
            user: user,
            mutualCount: suggestion.mutual_count,
            reason: "Followed by " + suggestion.mutual_count + " people you follow"
        })
    END FOR

    RETURN result
END

COMPLEXITY:
  - Time: O(n * m) where n = following count, m = avg following per followed user
  - Space: O(k) where k = suggestion count (limited by limit)
  - Database: Optimized with proper indexes on follows table

OPTIMIZATION NOTES:
  - Add LIMIT to inner query for scalability
  - Consider pre-computing suggestions daily for high-profile users
  - Cache suggestions for 1 hour
```

### 4.2 Mutual Followers

```
ALGORITHM: GetMutualFollowers
INPUT: viewerId (UUID), targetId (UUID), limit (integer, default 10)
OUTPUT: array of User objects
PRECONDITIONS:
  - Both users exist
POSTCONDITIONS:
  - Returns users who follow both viewer and target

BEGIN
    // Step 1: Validation
    IF viewerId == targetId THEN
        THROW BadRequestError("Cannot get mutual followers with yourself")
    END IF

    // Step 2: Query mutual followers
    // Find users who follow BOTH viewerId AND targetId
    mutualFollowers ← Database.Query("
        SELECT
            u.id, u.username, u.display_name, u.avatar_url
        FROM users u
        INNER JOIN follows f1 ON u.id = f1.follower_id
        INNER JOIN follows f2 ON u.id = f2.follower_id
        WHERE
            -- User follows viewer
            f1.following_id = ?
            AND f1.status = 'active'

            -- User also follows target
            AND f2.following_id = ?
            AND f2.status = 'active'

            -- Exclude blocked users
            AND NOT EXISTS (
                SELECT 1 FROM blocks b
                WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
                   OR (b.blocker_id = u.id AND b.blocked_id = ?)
            )
        ORDER BY u.followers_count DESC
        LIMIT ?
    ", [viewerId, targetId, viewerId, viewerId, limit])

    RETURN mutualFollowers
END

COMPLEXITY:
  - Time: O(log n) with proper indexes
  - Space: O(k) where k = result count (limited by limit)

PRIVACY:
  - Excludes blocked users
  - Respects privacy settings via separate authorization
```

---

## 5. Block System Algorithms

### 5.1 Block User

```
ALGORITHM: BlockUser
INPUT: blockerId (UUID), targetId (UUID), reason (string, optional)
OUTPUT: Block object
PRECONDITIONS:
  - Both users exist
  - blockerId != targetId
POSTCONDITIONS:
  - Block relationship created
  - Existing follows removed (bidirectional)
  - User removed from followers/following lists

BEGIN
    // Step 1: Validation
    IF blockerId == targetId THEN
        THROW BadRequestError("Cannot block yourself")
    END IF

    // Step 2: Start database transaction
    BEGIN_TRANSACTION

    TRY
        // Step 3: Create block relationship
        block ← Database.Insert("blocks", {
            id: GenerateUUID(),
            blocker_id: blockerId,
            blocked_id: targetId,
            reason: reason OR null,
            created_at: NOW()
        })

        // Step 4: Remove existing follow relationships (bidirectional)
        // Delete: blocker -> blocked
        Database.Delete("follows", {
            follower_id: blockerId,
            following_id: targetId
        })

        // Delete: blocked -> blocker
        Database.Delete("follows", {
            follower_id: targetId,
            following_id: blockerId
        })

        // Step 5: Remove pending follow requests (bidirectional)
        Database.Delete("follows", {
            OR: [
                {follower_id: blockerId, following_id: targetId, status: "pending"},
                {follower_id: targetId, following_id: blockerId, status: "pending"}
            ]
        })

        // Step 6: Invalidate feed caches
        InvalidateFeedCache(blockerId)

        // Step 7: Commit transaction
        COMMIT_TRANSACTION

        RETURN block

    CATCH error
        ROLLBACK_TRANSACTION
        THROW error
    END TRY
END

COMPLEXITY:
  - Time: O(1) - Fixed number of indexed queries
  - Space: O(1) - Constant space

PRIVACY:
  - Removes all connection traces
  - Bidirectional follow removal
  - Silent operation (no notification to blocked user)
```

### 5.2 Unblock User

```
ALGORITHM: UnblockUser
INPUT: blockerId (UUID), targetId (UUID)
OUTPUT: boolean (success)
PRECONDITIONS:
  - Block relationship exists
POSTCONDITIONS:
  - Block relationship deleted
  - Users can interact again (but follows not restored)

BEGIN
    // Step 1: Delete block relationship
    deletedCount ← Database.Delete("blocks", {
        blocker_id: blockerId,
        blocked_id: targetId
    })

    // Step 2: Verify deletion
    IF deletedCount == 0 THEN
        THROW NotFoundError("Block relationship not found")
    END IF

    // Step 3: Invalidate feed cache
    InvalidateFeedCache(blockerId)

    // Note: Follow relationships are NOT automatically restored
    // User must manually re-follow if desired

    RETURN true
END

COMPLEXITY:
  - Time: O(1) - Single indexed delete
  - Space: O(1) - Constant space

PRIVACY:
  - Allows interaction again
  - Does not restore previous follows (user choice)
```

### 5.3 Check If Blocked

```
ALGORITHM: IsBlocked
INPUT: userId1 (UUID), userId2 (UUID)
OUTPUT: BlockStatus {
    isBlocked: boolean,
    direction: "none" | "user1_blocked_user2" | "user2_blocked_user1" | "mutual"
}
PRECONDITIONS:
  - Both users exist
POSTCONDITIONS:
  - Returns accurate block status (bidirectional check)

BEGIN
    // Step 1: Check both directions in single query
    blocks ← Database.Query("
        SELECT blocker_id, blocked_id
        FROM blocks
        WHERE (blocker_id = ? AND blocked_id = ?)
           OR (blocker_id = ? AND blocked_id = ?)
    ", [userId1, userId2, userId2, userId1])

    // Step 2: Determine block direction
    IF blocks.length == 0 THEN
        RETURN {
            isBlocked: false,
            direction: "none"
        }
    END IF

    user1BlockedUser2 ← false
    user2BlockedUser1 ← false

    FOR EACH block IN blocks DO
        IF block.blocker_id == userId1 THEN
            user1BlockedUser2 ← true
        ELSE IF block.blocker_id == userId2 THEN
            user2BlockedUser1 ← true
        END IF
    END FOR

    // Step 3: Determine direction
    IF user1BlockedUser2 AND user2BlockedUser1 THEN
        direction ← "mutual"
    ELSE IF user1BlockedUser2 THEN
        direction ← "user1_blocked_user2"
    ELSE
        direction ← "user2_blocked_user1"
    END IF

    RETURN {
        isBlocked: true,
        direction: direction
    }
END

COMPLEXITY:
  - Time: O(1) - Single indexed query
  - Space: O(1) - Constant space

PRIVACY:
  - Bidirectional check prevents interaction leakage
  - Used internally for authorization checks
```

---

## 6. Data Structure Definitions

### 6.1 Database Tables

```
STRUCTURE: follows
FIELDS:
    id: UUID (primary key)
    follower_id: UUID (foreign key -> users.id)
    following_id: UUID (foreign key -> users.id)
    status: ENUM("active", "pending", "blocked")
    created_at: TIMESTAMP

INDEXES:
    PRIMARY KEY (id)
    UNIQUE (follower_id, following_id)
    INDEX ON (follower_id) WHERE status = 'active'
    INDEX ON (following_id) WHERE status = 'active'
    INDEX ON (following_id, status) WHERE status = 'pending'

CONSTRAINTS:
    follower_id != following_id (no self-follow)
    status IN ('active', 'pending', 'blocked')
    ON DELETE CASCADE for user deletions

STORAGE: Estimated 48 bytes per row + indexes
SCALABILITY: 1M rows = ~100MB

---

STRUCTURE: blocks
FIELDS:
    id: UUID (primary key)
    blocker_id: UUID (foreign key -> users.id)
    blocked_id: UUID (foreign key -> users.id)
    reason: VARCHAR(255) (optional)
    created_at: TIMESTAMP

INDEXES:
    PRIMARY KEY (id)
    UNIQUE (blocker_id, blocked_id)
    INDEX ON (blocker_id)
    INDEX ON (blocked_id)

CONSTRAINTS:
    blocker_id != blocked_id (no self-block)
    ON DELETE CASCADE for user deletions

STORAGE: Estimated 60 bytes per row + indexes
SCALABILITY: 100K rows = ~10MB

---

STRUCTURE: user_profiles (extended)
FIELDS:
    ... (existing fields)
    follow_approval_required: BOOLEAN (default false)
    followers_visible: ENUM("public", "followers", "private")
    following_visible: ENUM("public", "followers", "private")

STORAGE: Additional 3 bytes per row

---

STRUCTURE: users (extended)
FIELDS:
    ... (existing fields)
    followers_count: INTEGER (default 0)
    following_count: INTEGER (default 0)

STORAGE: Additional 8 bytes per row
```

### 6.2 Redis Cache Structures

```
STRUCTURE: FeedCache
KEY_PATTERN: "feed:{userId}:{cursor}"
VALUE: JSON {
    posts: [
        {
            post: Post object,
            score: number,
            reason: string
        }
    ],
    nextCursor: string or null,
    hasMore: boolean
}
TTL: 300 seconds (5 minutes)
MEMORY: ~5KB per cached page
EVICTION: LRU policy

---

STRUCTURE: SuggestionCache
KEY_PATTERN: "suggestions:{userId}"
VALUE: JSON [
    {
        user: User object,
        mutualCount: number,
        reason: string
    }
]
TTL: 3600 seconds (1 hour)
MEMORY: ~2KB per cached suggestion list
EVICTION: LRU policy
```

### 6.3 API Response Structures

```
STRUCTURE: FollowResult
{
    status: "followed" | "pending" | "blocked" | "already_following",
    follow: {
        id: UUID,
        follower_id: UUID,
        following_id: UUID,
        status: string,
        created_at: timestamp
    } or null
}

---

STRUCTURE: RelationshipStatus
{
    type: "self" | "follower" | "following" | "mutual" | "none" | "blocked",
    isFollowing: boolean,
    isFollower: boolean,
    isMutual: boolean,
    isBlocked: boolean
}

---

STRUCTURE: FeedResult
{
    posts: [
        {
            post: Post object,
            score: number,
            reason: "following" | "group" | "trending"
        }
    ],
    nextCursor: string or null,
    hasMore: boolean
}

---

STRUCTURE: SuggestedUser
{
    user: {
        id: UUID,
        username: string,
        display_name: string,
        avatar_url: string,
        followers_count: number
    },
    mutualCount: number,
    reason: string
}
```

---

## 7. Complexity Analysis Summary

### 7.1 Time Complexity

| Operation | Complexity | Explanation |
|-----------|------------|-------------|
| Follow User | O(1) | Fixed indexed queries |
| Unfollow User | O(1) | Single indexed delete |
| Approve Request | O(1) | Single indexed update |
| Reject Request | O(1) | Single indexed delete |
| Get Relationship | O(1) | Three indexed queries (two parallel) |
| Get Privacy Context | O(1) | Fixed indexed queries (some parallel) |
| Can View Content | O(1) | Conditional logic only |
| Generate Feed | O(n log n) | Sorting scored posts, limited by query |
| Calculate Score | O(1) | Arithmetic operations |
| Get Cached Feed | O(1) | Single Redis GET |
| Cache Feed | O(1) | Single Redis SETEX |
| Invalidate Cache | O(k) | k = number of cached pages |
| Follow Suggestions | O(n * m) | n = following, m = avg following per user |
| Mutual Followers | O(log n) | Indexed join query |
| Block User | O(1) | Fixed transaction with indexed queries |
| Unblock User | O(1) | Single indexed delete |
| Is Blocked | O(1) | Single indexed query |

### 7.2 Space Complexity

| Operation | Complexity | Explanation |
|-----------|------------|-------------|
| Follow User | O(1) | Constant variables |
| Privacy Context | O(1) | Single context object |
| Generate Feed | O(n) | Result set size |
| Feed Cache | O(n) | Cached feed size |
| Follow Suggestions | O(k) | Suggestion count (limited) |
| Mutual Followers | O(k) | Result count (limited) |

### 7.3 Database Indexes Required

```
CRITICAL INDEXES:
1. follows(follower_id) WHERE status = 'active'
   - Used by: Get Following, Feed Generation
   - Cardinality: High

2. follows(following_id) WHERE status = 'active'
   - Used by: Get Followers, Relationship Check
   - Cardinality: High

3. follows(following_id, status) WHERE status = 'pending'
   - Used by: Get Follow Requests
   - Cardinality: Low (filtered)

4. blocks(blocker_id)
   - Used by: Block checks, Feed filtering
   - Cardinality: Low (few blocks)

5. blocks(blocked_id)
   - Used by: Bidirectional block checks
   - Cardinality: Low

6. posts(created_at) WHERE deleted_at IS NULL
   - Used by: Feed pagination
   - Cardinality: High

7. posts(author_id) WHERE deleted_at IS NULL
   - Used by: Feed filtering by author
   - Cardinality: High

INDEX MAINTENANCE:
- Vacuum indexes weekly
- Reindex monthly for performance
- Monitor index bloat
```

### 7.4 Performance Targets

| Operation | p50 Target | p95 Target | SLA |
|-----------|------------|------------|-----|
| Follow User | 50ms | 100ms | 99.9% |
| Unfollow User | 50ms | 100ms | 99.9% |
| Get Followers (20) | 30ms | 80ms | 99.5% |
| Get Following (20) | 30ms | 80ms | 99.5% |
| Generate Feed (20) | 100ms | 200ms | 99% |
| Check Relationship | 10ms | 30ms | 99.9% |
| Block User | 60ms | 120ms | 99.5% |
| Get Suggestions (10) | 150ms | 300ms | 95% |

---

## 8. Algorithm Design Patterns Used

### 8.1 Strategy Pattern
- **Feed Scoring**: Different scoring strategies (chronological, engagement, hybrid)
- **Privacy Enforcement**: Different privacy levels (public, private, friends-only)

### 8.2 Observer Pattern
- **Notification System**: Follow events trigger notifications
- **Cache Invalidation**: Follow operations trigger cache invalidation

### 8.3 Repository Pattern
- **Database Abstraction**: Consistent interface for follow/block operations
- **Cache Layer**: Transparent caching for read operations

### 8.4 Command Pattern
- **Follow Operations**: Encapsulated follow/unfollow/approve/reject commands
- **Transaction Management**: Atomic operations with rollback

### 8.5 Builder Pattern
- **Feed Query Construction**: Dynamic SQL building based on filters
- **Privacy Context Building**: Progressive context assembly

---

## 9. Optimization Recommendations

### 9.1 Database Optimizations
1. **Materialized Views**: Pre-compute trending posts daily
2. **Partitioning**: Partition follows table by created_at for archival
3. **Connection Pooling**: Maintain 20-50 connection pool
4. **Query Optimization**: Use EXPLAIN ANALYZE for all critical queries

### 9.2 Cache Optimizations
1. **Feed Cache**: 5-minute TTL with proactive invalidation
2. **Suggestion Cache**: 1-hour TTL for stable suggestions
3. **Relationship Cache**: Cache relationship status for 10 minutes
4. **Redis Cluster**: Use Redis cluster for high availability

### 9.3 Application Optimizations
1. **Batch Operations**: Batch notification creation
2. **Parallel Queries**: Use Promise.all for independent queries
3. **Cursor Pagination**: Avoid OFFSET for large datasets
4. **Rate Limiting**: Limit follow operations to 100/hour per user

### 9.4 Future Enhancements (Post-MVP)
1. **Machine Learning**: Personalized feed ranking ML model
2. **Real-time Updates**: WebSocket for live follow notifications
3. **Graph Database**: Consider Neo4j for complex graph queries
4. **Federated Follows**: Support for ActivityPub protocol

---

## 10. Security Considerations

### 10.1 Input Validation
- Validate all UUIDs for format and existence
- Sanitize reason text for blocks (max 255 chars)
- Rate limit follow requests (100/hour per user)

### 10.2 Authorization
- Always check block status before follow
- Verify user ownership for approve/reject requests
- Enforce privacy context for all content access

### 10.3 Privacy Protection
- Silent rejection of follow requests (anti-harassment)
- No notification on unfollow (privacy)
- Bidirectional block enforcement

### 10.4 Data Protection
- Never expose block reasons to blocked user
- Hash or encrypt sensitive profile data
- Audit log for block operations

---

## 11. Testing Strategy

### 11.1 Unit Tests
- Test each algorithm in isolation
- Mock database and external services
- Cover all edge cases (self-follow, duplicate, blocked)

### 11.2 Integration Tests
- Test with real database (test schema)
- Verify trigger execution (count updates)
- Test transaction rollbacks

### 11.3 Performance Tests
- Load test feed generation (1000 req/s)
- Stress test follow operations (10000 concurrent)
- Benchmark database queries (< 100ms target)

### 11.4 BDD Tests
- Implement all scenarios from specification
- Use Cucumber or similar BDD framework
- Test privacy enforcement end-to-end

---

**Pseudocode Document Completed**
**Created By**: SPARC Pseudocode Agent
**Date**: 2025-12-16
**Ready for**: SPARC Phase 3 (Architecture)

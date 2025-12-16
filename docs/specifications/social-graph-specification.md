# Social Graph & Follow System Specification

**Project**: Community Social Network MVP
**Milestone**: M6 - Social Features
**Version**: 1.0.0
**Date**: 2025-12-16
**Status**: SPECIFICATION COMPLETE

---

## Executive Summary

This document specifies the social graph architecture, follow algorithm, privacy enforcement, and personalized feed generation for the community social network. It addresses the gaps identified in the requirements validation report.

### Key Specifications
- **Architecture**: Graph-based follow relationships with PostgreSQL
- **Privacy Model**: Public, Private, Friends-only profiles
- **Feed Algorithm**: Chronological with engagement weighting (MVP)
- **Performance Target**: Follow operations < 100ms, Feed generation < 200ms
- **Scalability**: Support 100K users with 1M follow relationships

---

## 1. Data Model

### 1.1 Database Schema

```sql
-- Follow relationships table
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_follow UNIQUE (follower_id, following_id),
    CONSTRAINT no_self_follow CHECK (follower_id != following_id),
    CONSTRAINT valid_status CHECK (status IN ('active', 'pending', 'blocked'))
);

-- Indexes for fast queries
CREATE INDEX idx_follows_follower ON follows(follower_id) WHERE status = 'active';
CREATE INDEX idx_follows_following ON follows(following_id) WHERE status = 'active';
CREATE INDEX idx_follows_pending ON follows(following_id, status) WHERE status = 'pending';

-- Block relationships (separate from follows)
CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id),
    CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

-- User privacy settings (extends user_profiles)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
    follow_approval_required BOOLEAN DEFAULT FALSE;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
    followers_visible VARCHAR(20) DEFAULT 'public'
    CHECK (followers_visible IN ('public', 'followers', 'private'));

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
    following_visible VARCHAR(20) DEFAULT 'public'
    CHECK (following_visible IN ('public', 'followers', 'private'));

-- Follower/Following counts (denormalized for performance)
ALTER TABLE users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
```

### 1.2 Count Update Triggers

```sql
-- Trigger to update follower/following counts atomically
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
        UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
        UPDATE users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
        UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != 'active' AND NEW.status = 'active' THEN
            UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
            UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
        ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
            UPDATE users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
            UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_follow_counts
    AFTER INSERT OR UPDATE OR DELETE ON follows
    FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
```

---

## 2. Follow Algorithm

### 2.1 Follow Request Flow

```typescript
// server/src/services/social/followService.ts

interface FollowResult {
  status: 'followed' | 'pending' | 'blocked' | 'already_following';
  follow?: Follow;
}

async function followUser(followerId: string, targetId: string): Promise<FollowResult> {
  // 1. Validation checks
  if (followerId === targetId) {
    throw new BadRequestError('Cannot follow yourself');
  }

  // 2. Check if blocked
  const isBlocked = await db.blocks.findFirst({
    where: {
      OR: [
        { blocker_id: targetId, blocked_id: followerId },  // Target blocked follower
        { blocker_id: followerId, blocked_id: targetId },  // Follower blocked target
      ],
    },
  });

  if (isBlocked) {
    return { status: 'blocked' };
  }

  // 3. Check existing follow
  const existingFollow = await db.follows.findFirst({
    where: { follower_id: followerId, following_id: targetId },
  });

  if (existingFollow?.status === 'active') {
    return { status: 'already_following', follow: existingFollow };
  }

  // 4. Check if approval required (private profile)
  const targetProfile = await db.userProfiles.findUnique({
    where: { user_id: targetId },
    select: { follow_approval_required: true },
  });

  const requiresApproval = targetProfile?.follow_approval_required ?? false;

  // 5. Create or update follow
  const follow = await db.follows.upsert({
    where: {
      follower_id_following_id: { follower_id: followerId, following_id: targetId },
    },
    create: {
      follower_id: followerId,
      following_id: targetId,
      status: requiresApproval ? 'pending' : 'active',
    },
    update: {
      status: requiresApproval ? 'pending' : 'active',
    },
  });

  // 6. Send notification
  if (follow.status === 'active') {
    await notificationService.create({
      type: 'follow',
      userId: targetId,
      actorId: followerId,
      entityType: 'user',
      entityId: followerId,
      message: `${followerName} started following you`,
    });
  } else {
    await notificationService.create({
      type: 'follow_request',
      userId: targetId,
      actorId: followerId,
      entityType: 'user',
      entityId: followerId,
      message: `${followerName} requested to follow you`,
    });
  }

  return {
    status: follow.status === 'active' ? 'followed' : 'pending',
    follow,
  };
}
```

### 2.2 Follow Request Approval (Private Profiles)

```typescript
async function approveFollowRequest(
  userId: string,
  requesterId: string
): Promise<Follow> {
  const follow = await db.follows.update({
    where: {
      follower_id_following_id: {
        follower_id: requesterId,
        following_id: userId,
      },
      status: 'pending',
    },
    data: { status: 'active' },
  });

  await notificationService.create({
    type: 'follow_approved',
    userId: requesterId,
    actorId: userId,
    entityType: 'user',
    entityId: userId,
    message: `${userName} approved your follow request`,
  });

  return follow;
}

async function rejectFollowRequest(
  userId: string,
  requesterId: string
): Promise<void> {
  await db.follows.delete({
    where: {
      follower_id_following_id: {
        follower_id: requesterId,
        following_id: userId,
      },
      status: 'pending',
    },
  });
  // No notification sent on rejection (to avoid harassment)
}
```

---

## 3. Privacy Enforcement

### 3.1 Privacy Levels

| Level | Profile Visible | Posts Visible | Followers List | Following List | Can Follow |
|-------|-----------------|---------------|----------------|----------------|------------|
| **Public** | Everyone | Everyone | Everyone | Everyone | Instant |
| **Private** | Everyone | Followers only | Followers only | Followers only | Requires approval |
| **Friends-only** | Mutual followers | Mutual followers | Hidden | Hidden | Requires approval |

### 3.2 Privacy Middleware

```typescript
// server/src/middleware/privacy.ts

interface PrivacyContext {
  viewer: User | null;        // Current user (null if anonymous)
  target: User;               // User being viewed
  relationship: 'self' | 'follower' | 'following' | 'mutual' | 'none' | 'blocked';
}

async function getPrivacyContext(
  viewerId: string | null,
  targetId: string
): Promise<PrivacyContext> {
  const target = await db.users.findUnique({
    where: { id: targetId },
    include: { profile: true },
  });

  if (!target) throw new NotFoundError('User not found');

  if (!viewerId) {
    return { viewer: null, target, relationship: 'none' };
  }

  if (viewerId === targetId) {
    return { viewer: target, target, relationship: 'self' };
  }

  // Check for block (either direction)
  const block = await db.blocks.findFirst({
    where: {
      OR: [
        { blocker_id: targetId, blocked_id: viewerId },
        { blocker_id: viewerId, blocked_id: targetId },
      ],
    },
  });

  if (block) {
    return { viewer: null, target, relationship: 'blocked' };
  }

  // Check follow relationships
  const [viewerFollowsTarget, targetFollowsViewer] = await Promise.all([
    db.follows.findFirst({
      where: { follower_id: viewerId, following_id: targetId, status: 'active' },
    }),
    db.follows.findFirst({
      where: { follower_id: targetId, following_id: viewerId, status: 'active' },
    }),
  ]);

  let relationship: PrivacyContext['relationship'] = 'none';
  if (viewerFollowsTarget && targetFollowsViewer) {
    relationship = 'mutual';
  } else if (viewerFollowsTarget) {
    relationship = 'following';
  } else if (targetFollowsViewer) {
    relationship = 'follower';
  }

  return { viewer: await db.users.findUnique({ where: { id: viewerId } }), target, relationship };
}

function canViewContent(
  privacy: PrivacyContext,
  contentType: 'profile' | 'posts' | 'followers' | 'following'
): boolean {
  const { target, relationship } = privacy;
  const visibility = target.profile?.visibility ?? 'public';

  // Self can always see everything
  if (relationship === 'self') return true;

  // Blocked users see nothing
  if (relationship === 'blocked') return false;

  switch (visibility) {
    case 'public':
      return true;

    case 'private':
      if (contentType === 'profile') return true;
      return ['follower', 'following', 'mutual'].includes(relationship);

    case 'friends-only':
      if (contentType === 'profile') return true;
      return relationship === 'mutual';

    default:
      return false;
  }
}
```

---

## 4. Personalized Feed Algorithm

### 4.1 Feed Generation Strategy (MVP)

For MVP, we use a **chronological feed with engagement weighting**:

```typescript
// server/src/services/feed/feedService.ts

interface FeedOptions {
  userId: string;
  cursor?: string;
  limit?: number;
}

interface FeedItem {
  post: Post;
  score: number;
  reason: 'following' | 'group' | 'trending';
}

async function getPersonalizedFeed(options: FeedOptions): Promise<FeedItem[]> {
  const { userId, cursor, limit = 20 } = options;

  // 1. Get user's following list
  const following = await db.follows.findMany({
    where: { follower_id: userId, status: 'active' },
    select: { following_id: true },
  });
  const followingIds = following.map(f => f.following_id);

  // 2. Get user's groups
  const groups = await db.groupMembers.findMany({
    where: { user_id: userId },
    select: { group_id: true },
  });
  const groupIds = groups.map(g => g.group_id);

  // 3. Build feed query with scoring
  const cursorDate = cursor ? new Date(Buffer.from(cursor, 'base64').toString()) : new Date();

  const posts = await db.$queryRaw<(Post & { score: number; reason: string })[]>`
    WITH scored_posts AS (
      SELECT
        p.*,
        CASE
          WHEN p.author_id = ANY(${followingIds}::uuid[]) THEN 'following'
          WHEN p.group_id = ANY(${groupIds}::uuid[]) THEN 'group'
          ELSE 'trending'
        END as reason,
        -- Engagement score: recency + interactions
        (
          -- Recency factor (exponential decay over 24 hours)
          EXP(-EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400) * 100
          -- Engagement factor
          + p.likes_count * 2
          + p.comments_count * 3
          + p.shares_count * 5
          -- Following bonus
          + CASE WHEN p.author_id = ANY(${followingIds}::uuid[]) THEN 50 ELSE 0 END
          -- Group bonus
          + CASE WHEN p.group_id = ANY(${groupIds}::uuid[]) THEN 30 ELSE 0 END
        ) as score
      FROM posts p
      WHERE
        p.created_at < ${cursorDate}
        AND p.deleted_at IS NULL
        AND (
          -- Posts from people I follow
          p.author_id = ANY(${followingIds}::uuid[])
          -- Posts in my groups
          OR p.group_id = ANY(${groupIds}::uuid[])
          -- Trending posts (high engagement in last 24h)
          OR (p.created_at > NOW() - INTERVAL '24 hours' AND p.likes_count > 10)
        )
        -- Exclude blocked users
        AND NOT EXISTS (
          SELECT 1 FROM blocks b
          WHERE b.blocker_id = ${userId} AND b.blocked_id = p.author_id
        )
    )
    SELECT * FROM scored_posts
    ORDER BY score DESC, created_at DESC
    LIMIT ${limit + 1}  -- Fetch one extra for cursor
  `;

  // 4. Generate next cursor
  const hasMore = posts.length > limit;
  const feedPosts = posts.slice(0, limit);
  const nextCursor = hasMore
    ? Buffer.from(feedPosts[feedPosts.length - 1].created_at.toISOString()).toString('base64')
    : null;

  return {
    posts: feedPosts.map(p => ({
      post: p,
      score: p.score,
      reason: p.reason as FeedItem['reason'],
    })),
    nextCursor,
    hasMore,
  };
}
```

### 4.2 Feed Caching Strategy

```typescript
// Redis cache for feed
const FEED_CACHE_TTL = 5 * 60; // 5 minutes

async function getCachedFeed(userId: string, cursor?: string): Promise<FeedItem[] | null> {
  const cacheKey = `feed:${userId}:${cursor || 'initial'}`;
  const cached = await redis.get(cacheKey);
  return cached ? JSON.parse(cached) : null;
}

async function cacheFeed(userId: string, feed: FeedItem[], cursor?: string): Promise<void> {
  const cacheKey = `feed:${userId}:${cursor || 'initial'}`;
  await redis.setex(cacheKey, FEED_CACHE_TTL, JSON.stringify(feed));
}

// Invalidate feed cache on relevant actions
async function invalidateFeedCache(userId: string): Promise<void> {
  const keys = await redis.keys(`feed:${userId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

---

## 5. API Endpoints

```typescript
// Follow Management
POST   /api/users/:id/follow           // Follow user
DELETE /api/users/:id/follow           // Unfollow user
GET    /api/users/:id/followers        // Get followers list
GET    /api/users/:id/following        // Get following list
GET    /api/users/me/follow-requests   // Get pending follow requests
PUT    /api/users/me/follow-requests/:id/approve  // Approve request
DELETE /api/users/me/follow-requests/:id          // Reject request

// Block Management
POST   /api/users/:id/block            // Block user
DELETE /api/users/:id/block            // Unblock user
GET    /api/users/me/blocked           // Get blocked users list

// Relationship Status
GET    /api/users/:id/relationship     // Get relationship with user

// Suggestions
GET    /api/users/suggestions          // Get follow suggestions
GET    /api/users/mutual/:id           // Get mutual followers with user

// Feed
GET    /api/feed                       // Get personalized feed
GET    /api/feed/following             // Get following-only feed
GET    /api/feed/groups                // Get groups-only feed
```

---

## 6. Performance Requirements

### 6.1 Operation Latencies

| Operation | Target p50 | Target p95 | SLA |
|-----------|------------|------------|-----|
| Follow user | 50ms | 100ms | 99.9% |
| Unfollow user | 50ms | 100ms | 99.9% |
| Get followers list (20) | 30ms | 80ms | 99.5% |
| Get following list (20) | 30ms | 80ms | 99.5% |
| Generate feed (20 posts) | 100ms | 200ms | 99% |
| Check relationship | 10ms | 30ms | 99.9% |

### 6.2 Scalability Targets

| Metric | Target |
|--------|--------|
| Total users | 100,000 |
| Total follow relationships | 1,000,000 |
| Average followers per user | 50 |
| Max followers per user | 10,000 |
| Feed generation rate | 1,000 req/s |

---

## 7. BDD Test Scenarios

```gherkin
Feature: Follow System
  As a user
  I want to follow other users
  So that I can see their content in my feed

  Background:
    Given users exist: alice, bob, charlie
    And alice has a public profile
    And bob has a private profile

  # Public Profile Following
  Scenario: Follow public profile user
    Given alice is logged in
    When alice follows bob
    Then follow is created with status "active"
    And bob receives "follow" notification
    And alice's following_count is incremented
    And bob's followers_count is incremented

  Scenario: Unfollow user
    Given alice follows bob
    When alice unfollows bob
    Then follow relationship is deleted
    And alice's following_count is decremented
    And bob's followers_count is decremented

  # Private Profile Following
  Scenario: Follow private profile user
    Given charlie has a private profile
    When alice follows charlie
    Then follow is created with status "pending"
    And charlie receives "follow_request" notification
    And alice's following_count is NOT incremented yet

  Scenario: Approve follow request
    Given alice has pending follow request from bob
    When alice approves the request
    Then follow status changes to "active"
    And bob receives "follow_approved" notification
    And counts are updated

  Scenario: Reject follow request
    Given alice has pending follow request from bob
    When alice rejects the request
    Then follow is deleted
    And bob does NOT receive notification

  # Block System
  Scenario: Block user
    Given alice follows bob
    When alice blocks bob
    Then follow relationship is removed
    And bob cannot follow alice
    And alice does not see bob's posts in feed

  Scenario: Blocked user cannot follow
    Given alice blocked bob
    When bob tries to follow alice
    Then follow request is rejected with "blocked" status
    And no notification is sent

  # Privacy Enforcement
  Scenario: View private profile as follower
    Given charlie has a private profile
    And alice follows charlie (approved)
    When alice views charlie's profile
    Then alice can see charlie's posts
    And alice can see charlie's followers list

  Scenario: View private profile as non-follower
    Given charlie has a private profile
    And alice does NOT follow charlie
    When alice views charlie's profile
    Then alice can see basic profile info
    But alice cannot see charlie's posts
    And alice cannot see charlie's followers list

  # Feed
  Scenario: See followed user's posts in feed
    Given alice follows bob
    And bob creates a post "Hello World"
    When alice views her feed
    Then alice sees bob's post in the feed
    And post has reason "following"

  Scenario: Not see unfollowed user's posts
    Given alice unfollowed bob
    And bob creates a post "Hello World"
    When alice views her feed
    Then alice does NOT see bob's post

  Scenario: Feed respects block
    Given alice blocked bob
    And bob creates a popular trending post
    When alice views her feed
    Then alice does NOT see bob's post

  # Edge Cases
  Scenario: Cannot follow yourself
    When alice tries to follow alice
    Then request fails with 400 Bad Request
    And error message is "Cannot follow yourself"

  Scenario: Duplicate follow request
    Given alice already follows bob
    When alice tries to follow bob again
    Then response indicates "already_following"
    And no duplicate relationship created

  Scenario: Mutual follow detection
    Given alice follows bob
    And bob follows alice
    When alice checks relationship with bob
    Then relationship status is "mutual"
```

---

## 8. Monitoring & Metrics

```typescript
// Prometheus metrics for social graph
const socialMetrics = {
  followOperations: new Counter({
    name: 'social_follow_operations_total',
    help: 'Total follow/unfollow operations',
    labelNames: ['operation', 'status'],
  }),

  feedGeneration: new Histogram({
    name: 'social_feed_generation_duration_ms',
    help: 'Feed generation duration',
    buckets: [50, 100, 200, 500, 1000],
  }),

  relationshipChecks: new Counter({
    name: 'social_relationship_checks_total',
    help: 'Relationship status checks',
  }),

  blockOperations: new Counter({
    name: 'social_block_operations_total',
    help: 'Block/unblock operations',
    labelNames: ['operation'],
  }),
};
```

---

## 9. Implementation Checklist

### Phase 1: Core Follow System (Week 1)
- [ ] Create database schema and migrations
- [ ] Implement follow/unfollow endpoints
- [ ] Add atomic count updates via triggers
- [ ] Build followers/following list endpoints
- [ ] Write unit tests for follow logic

### Phase 2: Privacy & Blocking (Week 2)
- [ ] Implement privacy middleware
- [ ] Add follow request approval flow
- [ ] Build block/unblock functionality
- [ ] Create relationship status endpoint
- [ ] Test privacy enforcement

### Phase 3: Feed Algorithm (Week 3)
- [ ] Implement personalized feed query
- [ ] Add Redis caching for feeds
- [ ] Build cache invalidation triggers
- [ ] Create follow suggestions endpoint
- [ ] Performance testing and optimization

---

## 10. Risk Assessment - Post-Specification

| Risk | Before | After | Mitigation |
|------|--------|-------|------------|
| Follow algorithm unclear | HIGH | LOW | Detailed scoring formula documented |
| Privacy enforcement vague | HIGH | LOW | Comprehensive privacy matrix |
| Performance concerns | MEDIUM | LOW | Caching strategy and targets defined |
| Edge cases undefined | MEDIUM | LOW | BDD scenarios cover edge cases |

**Milestone 6 Readiness**: **4.0/5.0** (up from 3.0/5.0) - READY FOR DEVELOPMENT

---

**Document Created By**: QE Requirements Validator Agent
**Date**: 2025-12-16
**Status**: SPECIFICATION COMPLETE

# ADR-005: SQL vs NoSQL Database

**Status**: Accepted
**Date**: 2025-12-04
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-002 (Modular Monolith), ADR-010 (Repository Pattern)

## Context

The Community Social Network platform requires a primary database that addresses:

1. **Data Relationships**: Users, posts, comments, groups, follows - highly relational
2. **Query Complexity**: Feed generation, social graph traversal, nested comments
3. **Data Integrity**: Financial-grade consistency for user accounts
4. **Performance**: Target p95 < 500ms for API responses
5. **Scale**: 10,000+ users, 300,000+ posts, 1,000 concurrent users

Key data characteristics:
- **Relational**: Posts belong to users, comments belong to posts, users follow users
- **Hierarchical**: Nested comments (max 3 levels), group membership hierarchies
- **Aggregated**: Follower counts, reaction counts, unread notification counts
- **Time-series**: Notifications partitioned by month, audit logs

## Decision

We adopt **PostgreSQL 15+** as the primary database with **Redis 7+** for caching.

### Database Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Database Architecture                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           Application Layer                                  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Repository Layer                               │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │  │ MemberRepository│  │  PostRepository │  │ GroupRepository │       │  │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘       │  │
│  │           │                    │                    │                 │  │
│  └───────────┼────────────────────┼────────────────────┼─────────────────┘  │
│              │                    │                    │                    │
└──────────────┼────────────────────┼────────────────────┼────────────────────┘
               │                    │                    │
               ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         3-Tier Caching Layer                                 │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │  Local Memory   │─►│      Redis      │─►│   PostgreSQL    │            │
│  │   (30 seconds)  │  │   (1-24 hours)  │  │   (Persistent)  │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                              │
│  Cache Hit Rate Target: 85-90%                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PostgreSQL 15+                                     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Primary Instance                             │   │
│  │                                                                       │   │
│  │  Features Used:                                                       │   │
│  │  - JSONB for flexible metadata                                        │   │
│  │  - Recursive CTEs for hierarchical data (comments)                   │   │
│  │  - Table partitioning (notifications by month)                        │   │
│  │  - Full-text search (pg_trgm for user search)                        │   │
│  │  - Materialized views (feed optimization)                             │   │
│  │  - Triggers (counter maintenance)                                     │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Read Replicas (Future)                          │   │
│  │                                                                       │   │
│  │  - Feed queries routed to replicas                                    │   │
│  │  - Reporting queries on dedicated replica                             │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Schema Design

```sql
-- Users (Identity Context)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_email (email),
    INDEX idx_status (status)
);

-- User Profiles (Profile Context)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    location VARCHAR(100),
    is_private BOOLEAN DEFAULT false,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_id (user_id),
    INDEX idx_display_name_trgm USING gin (display_name gin_trgm_ops)
);

-- Posts (Content Context)
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    visibility VARCHAR(50) DEFAULT 'public',
    comments_count INTEGER DEFAULT 0,
    reactions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    INDEX idx_author_id (author_id),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_visibility (visibility),
    INDEX idx_deleted_at (deleted_at) WHERE deleted_at IS NULL
);

-- Comments with Materialized Path (Content Context)
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    path TEXT NOT NULL,  -- Materialized path: 'root_id.parent_id.this_id'
    depth INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    reactions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    INDEX idx_post_id (post_id),
    INDEX idx_author_id (author_id),
    INDEX idx_parent_id (parent_id),
    INDEX idx_path (path),
    CONSTRAINT chk_depth CHECK (depth <= 2)  -- Max 3 levels (0, 1, 2)
);

-- Follows (Social Graph Context)
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active',  -- active, pending
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (follower_id, following_id),
    INDEX idx_follower_id (follower_id),
    INDEX idx_following_id (following_id),
    INDEX idx_status (status),
    CONSTRAINT chk_no_self_follow CHECK (follower_id != following_id)
);

-- Blocks (Social Graph Context)
CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (blocker_id, blocked_id),
    INDEX idx_blocker_id (blocker_id),
    INDEX idx_blocked_id (blocked_id),
    CONSTRAINT chk_no_self_block CHECK (blocker_id != blocked_id)
);

-- Groups (Community Context)
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id),
    is_private BOOLEAN DEFAULT false,
    members_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_owner_id (owner_id),
    INDEX idx_name_trgm USING gin (name gin_trgm_ops)
);

-- Group Members (Community Context)
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',  -- owner, moderator, member
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (group_id, user_id),
    INDEX idx_group_id (group_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role (role)
);

-- Notifications (Partitioned by Month)
CREATE TABLE notifications (
    id UUID NOT NULL,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    source_id UUID,
    content JSONB NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id, created_at),
    INDEX idx_recipient_id (recipient_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at DESC)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE notifications_2025_01 PARTITION OF notifications
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE notifications_2025_02 PARTITION OF notifications
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- Additional partitions created via cron job
```

### Notification Partition Lifecycle

#### Auto-Creation
Partitions are created 3 months ahead by a scheduled job:

```sql
-- Scheduled job runs monthly on the 1st at 00:00 UTC
-- Creates partitions 3 months into the future
CREATE OR REPLACE FUNCTION create_future_partitions()
RETURNS void AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  FOR i IN 0..2 LOOP
    partition_date := DATE_TRUNC('month', NOW()) + (i || ' months')::INTERVAL;
    partition_name := 'notifications_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := partition_date;
    end_date := partition_date + '1 month'::INTERVAL;

    -- Create partition if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF notifications FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

#### Retention Policy
- **Active partitions**: Last 6 months of notifications retained in PostgreSQL
- **Archive**: Partitions older than 6 months are exported to cold storage (S3) and detached
- **Deletion**: Archived partitions are deleted from PostgreSQL after successful export verification

```sql
-- Monthly cleanup job: detach partitions older than 6 months
CREATE OR REPLACE FUNCTION archive_old_partitions()
RETURNS void AS $$
DECLARE
  cutoff_date DATE := DATE_TRUNC('month', NOW()) - '6 months'::INTERVAL;
  partition_name TEXT;
BEGIN
  FOR partition_name IN
    SELECT tablename FROM pg_tables
    WHERE tablename LIKE 'notifications_%'
    AND tablename < 'notifications_' || TO_CHAR(cutoff_date, 'YYYY_MM')
  LOOP
    -- Detach (does not delete data, allows export first)
    EXECUTE format('ALTER TABLE notifications DETACH PARTITION %I', partition_name);
    -- After export verification, drop:
    -- EXECUTE format('DROP TABLE %I', partition_name);
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### PostgreSQL-Specific Features Used

#### 1. Recursive CTE for Comment Trees

```sql
-- Load entire comment tree in single query
WITH RECURSIVE comment_tree AS (
    -- Base case: root comments
    SELECT id, post_id, author_id, parent_id, path, depth, content, created_at
    FROM comments
    WHERE post_id = $1 AND parent_id IS NULL AND deleted_at IS NULL

    UNION ALL

    -- Recursive case: child comments
    SELECT c.id, c.post_id, c.author_id, c.parent_id, c.path, c.depth, c.content, c.created_at
    FROM comments c
    INNER JOIN comment_tree ct ON c.parent_id = ct.id
    WHERE c.deleted_at IS NULL
)
SELECT * FROM comment_tree
ORDER BY path;
```

#### 2. Triggers for Counter Maintenance

```sql
-- Trigger to update follower counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        UPDATE user_profiles SET followers_count = followers_count + 1 WHERE user_id = NEW.following_id;
        UPDATE user_profiles SET following_count = following_count + 1 WHERE user_id = NEW.follower_id;
    ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status != 'active') THEN
        UPDATE user_profiles SET followers_count = followers_count - 1 WHERE user_id = OLD.following_id;
        UPDATE user_profiles SET following_count = following_count - 1 WHERE user_id = OLD.follower_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_follow_counts
AFTER INSERT OR UPDATE OR DELETE ON follows
FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
```

#### 3. Full-Text Search with pg_trgm

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Search users by name
SELECT * FROM user_profiles
WHERE display_name % $1  -- Fuzzy match
ORDER BY similarity(display_name, $1) DESC
LIMIT 20;
```

## Alternatives Considered

### Option A: MongoDB (Rejected)

**Implementation**: Document store for flexible schema.

```javascript
// MongoDB document structure
{
  _id: ObjectId,
  email: "user@example.com",
  profile: {
    displayName: "John Doe",
    bio: "...",
    avatarUrl: "..."
  },
  stats: {
    followers: 150,
    following: 75,
    posts: 42
  }
}
```

**Pros**:
- Flexible schema for rapid iteration
- Document model matches API responses
- Horizontal scaling with sharding
- Good for write-heavy workloads

**Cons**:
- **No joins**: Feed queries require multiple round trips or denormalization
- **Eventual consistency**: Risk of stale follower counts
- **No transactions**: Multi-document updates not atomic (pre-4.0)
- **No foreign keys**: Referential integrity not enforced
- **Aggregation complexity**: Social graph queries harder

**Why Rejected**:
- **Relational data**: Users, posts, comments, follows are highly relational
- **Feed queries**: Need to join posts with authors, filter by follows, exclude blocks
- **Data integrity**: User accounts require ACID guarantees
- **Nested comments**: Tree queries natural in SQL with CTEs

### Option B: Neo4j (Rejected)

**Implementation**: Graph database for social relationships.

```cypher
// Neo4j query for feed
MATCH (user:User {id: $userId})-[:FOLLOWS]->(following:User)-[:POSTED]->(post:Post)
WHERE NOT (user)-[:BLOCKS]->(following)
RETURN post
ORDER BY post.createdAt DESC
LIMIT 20
```

**Pros**:
- Natural for social graph traversal
- Efficient "friends of friends" queries
- Graph algorithms built-in

**Cons**:
- **Operational complexity**: Another database to manage
- **Limited ecosystem**: Fewer hosting options, tools
- **Overkill for MVP**: Simple follows/blocks don't need graph DB
- **Learning curve**: Cypher query language

**Why Rejected**:
- PostgreSQL handles follow/block queries efficiently with proper indexing
- MVP scale (10K users) doesn't need graph database performance
- Operational simplicity more valuable than graph query performance

### Option C: PostgreSQL + TimescaleDB (Partially Adopted)

**Implementation**: TimescaleDB extension for time-series data.

**Decision**: Use native PostgreSQL partitioning for notifications (simpler), but consider TimescaleDB for analytics/metrics if needed later.

## Consequences

### Positive

- **ACID Compliance**: Strong consistency for user data
- **Relational Model**: Natural fit for domain relationships
- **Rich Query Language**: Complex queries with CTEs, window functions
- **Proven Scale**: PostgreSQL handles 10K+ users easily
- **Ecosystem**: Excellent tooling (pgAdmin, DBeaver, TypeORM)
- **Operational Maturity**: Well-understood backup, replication, monitoring

### Negative

- **Vertical Scaling**: Eventually hits limits (mitigated by caching)
- **Schema Migrations**: Require careful planning
- **Connection Limits**: Need connection pooling

### Mitigation Strategies

| Risk | Mitigation |
|------|------------|
| Vertical scaling limits | Redis caching (85-90% hit rate), read replicas |
| Schema migrations | TypeORM migrations, blue-green deployments |
| Connection limits | PgBouncer connection pooling (20 connections) |

## Performance Optimizations

### Index Strategy

```sql
-- Covering indexes for common queries
CREATE INDEX idx_posts_feed ON posts (author_id, created_at DESC)
    INCLUDE (content, visibility) WHERE deleted_at IS NULL;

-- Partial indexes for filtered queries
CREATE INDEX idx_notifications_unread ON notifications (recipient_id, created_at DESC)
    WHERE is_read = false;

-- GIN index for JSONB queries
CREATE INDEX idx_notifications_content ON notifications USING gin (content);
```

### Connection Pooling

```typescript
// TypeORM configuration
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: 5432,
  database: 'csn',
  username: process.env.DB_USER,
  password: process.env.DB_PASS,

  // Connection pooling
  extra: {
    max: 20,                    // Maximum connections
    idleTimeoutMillis: 30000,   // Close idle connections after 30s
    connectionTimeoutMillis: 5000,
  },

  // Query logging (development only)
  logging: process.env.NODE_ENV === 'development',
});
```

### Query Performance Targets

| Query Type | Target Latency | Strategy |
|------------|---------------|----------|
| User lookup by ID | < 5ms | Primary key + Redis cache |
| Feed (20 posts) | < 100ms | Covering index + Redis cache |
| Comment tree | < 50ms | Recursive CTE + path index |
| User search | < 100ms | pg_trgm GIN index |
| Notification count | < 10ms | Partial index + Redis |

### Scale Limits and Intervention Points

PostgreSQL performance degrades predictably at certain data volumes. These thresholds trigger infrastructure changes:

| Data Volume | Impact | Intervention |
|------------|--------|-------------|
| users > 50K | User search slows (pg_trgm index grows) | Consider Elasticsearch for search |
| posts > 1M | Feed queries slow (index scans grow) | Add covering indexes, materialized views |
| posts > 5M | Feed generation exceeds 100ms target | Add read replica for feed queries |
| comments > 5M | Comment tree CTEs slow | Consider denormalized comment counts table |
| notifications > 50M | Partition management overhead | Automate partition archival to cold storage |
| follows > 500K | Social graph queries slow | Consider graph cache in Redis |
| DB size > 100 GB | Backup times increase significantly | Move to incremental backup (pg_basebackup + WAL) |
| Connections > 100 | PostgreSQL process overhead | Deploy PgBouncer in transaction mode |

**Monitoring queries** to track data volume:
```sql
-- Run weekly to track growth
SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS row_count,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

### Backup and Recovery Strategy

| Component | Backup Method | Frequency | Retention | RTO | RPO |
|-----------|--------------|-----------|-----------|-----|-----|
| PostgreSQL | pg_dump full backup | Daily at 02:00 UTC | 30 days | 4 hours | 24 hours |
| PostgreSQL | WAL archiving | Continuous | 7 days | 1 hour | < 5 minutes |
| Redis | RDB snapshots | Every 15 minutes | 24 hours | 15 minutes | 15 minutes |
| Redis | AOF persistence | Continuous | 24 hours | 5 minutes | < 1 second |

**Point-in-Time Recovery**: WAL archiving enables recovery to any point within the 7-day retention window.

**Disaster Recovery**: Full backups are stored in a separate availability zone/region.

## References

- PostgreSQL 15 Documentation: https://www.postgresql.org/docs/15/
- TypeORM Documentation: https://typeorm.io/
- pg_trgm Extension: https://www.postgresql.org/docs/current/pgtrgm.html
- Table Partitioning: https://www.postgresql.org/docs/current/ddl-partitioning.html
- System Architecture Specification: `docs/architecture/SYSTEM_ARCHITECTURE_SPECIFICATION.md`

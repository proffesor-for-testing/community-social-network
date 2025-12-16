# M7 Notifications & WebSocket - Architecture Design

**Project**: Community Social Network MVP
**Milestone**: M7 - Notifications & Real-time Communication
**Phase**: SPARC Phase 3 - Architecture
**Version**: 1.0.0
**Date**: 2025-12-16
**Status**: ARCHITECTURE DRAFT

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Component Architecture](#3-component-architecture)
4. [WebSocket Connection Lifecycle](#4-websocket-connection-lifecycle)
5. [Room & Channel Architecture](#5-room--channel-architecture)
6. [Database Schema](#6-database-schema)
7. [Message Queue Architecture](#7-message-queue-architecture)
8. [Multi-Server Synchronization](#8-multi-server-synchronization)
9. [Reconnection & Failover Strategy](#9-reconnection--failover-strategy)
10. [Rate Limiting & Backpressure](#10-rate-limiting--backpressure)
11. [Notification Delivery Pipeline](#11-notification-delivery-pipeline)
12. [API Contracts](#12-api-contracts)
13. [Scalability Design](#13-scalability-design)
14. [Security Architecture](#14-security-architecture)
15. [Monitoring & Observability](#15-monitoring--observability)

---

## 1. System Overview

### 1.1 Business Requirements

The M7 Notifications & WebSocket system provides:
- Real-time bidirectional communication using Socket.IO
- Push notifications for user interactions (likes, comments, follows, messages)
- Notification preferences and delivery channels
- Multi-device support (up to 5 concurrent connections per user)
- Horizontal scaling to support 10,000+ concurrent connections
- Sub-second notification delivery (p95 < 500ms)

### 1.2 Technical Goals

- **Scalability**: Support 10,000 concurrent WebSocket connections per server
- **Availability**: 99.9% uptime with automatic failover
- **Performance**: p95 latency < 500ms for notification delivery
- **Reliability**: At-least-once delivery guarantee
- **Multi-tenant**: Isolated notification streams per user/group

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Client Applications                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │  Web App │  │ Mobile   │  │  Desktop │  │  Browser │                │
│  │          │  │  (iOS/   │  │   App    │  │  Ext     │                │
│  │ (React)  │  │ Android) │  │ (Electron)│  │          │                │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘                │
│       │             │             │             │                        │
│       └─────────────┴─────────────┴─────────────┘                        │
│                          │                                                │
│                    WebSocket (Socket.IO)                                  │
└─────────────────────────┼────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────────────┐
│                      Load Balancer (Nginx)                                │
│               - Sticky sessions (IP hash)                                 │
│               - WebSocket upgrade support                                 │
│               - Health checks                                             │
└─────────┬──────────────────────────────────────┬──────────────────────────┘
          │                                       │
   ┌──────▼──────┐                         ┌──────▼──────┐
   │  WS Server  │                         │  WS Server  │
   │  Instance 1 │◄───────Redis Pub/Sub───►│  Instance 2 │
   │             │                         │             │
   │ Socket.IO   │                         │ Socket.IO   │
   │ + Adapter   │                         │ + Adapter   │
   └──────┬──────┘                         └──────┬──────┘
          │                                       │
          └───────────────┬───────────────────────┘
                          │
        ┌─────────────────┼─────────────────┬───────────────┐
        │                 │                 │               │
   ┌────▼─────┐    ┌──────▼──────┐   ┌─────▼─────┐  ┌─────▼─────┐
   │  Redis   │    │   Message   │   │ REST API  │  │ PostgreSQL│
   │  Cache   │    │   Queue     │   │  Service  │  │ Database  │
   │          │    │             │   │           │  │           │
   │ Sessions │    │ Bull Queue  │   │ Express   │  │ Tables:   │
   │ Rooms    │    │ + Redis     │   │           │  │ - notifs  │
   │ Users    │    │             │   │           │  │ - prefs   │
   └──────────┘    └──────┬──────┘   └─────┬─────┘  └─────┬─────┘
                          │                │              │
                          └────────────────┴──────────────┘
```

---

## 3. Component Architecture

### 3.1 Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket Gateway Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Connection   │  │ Auth         │  │ Room         │         │
│  │ Manager      │  │ Middleware   │  │ Manager      │         │
│  │              │  │              │  │              │         │
│  │ - Establish  │  │ - JWT verify │  │ - Join       │         │
│  │ - Monitor    │  │ - Session    │  │ - Leave      │         │
│  │ - Disconnect │  │ - Refresh    │  │ - Broadcast  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────────────┐
│                   Event Processing Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Event        │  │ Rate         │  │ Validation   │         │
│  │ Router       │  │ Limiter      │  │ Service      │         │
│  │              │  │              │  │              │         │
│  │ - Route      │  │ - Token      │  │ - Schema     │         │
│  │ - Transform  │  │   bucket     │  │ - Sanitize   │         │
│  │ - Enrich     │  │ - Sliding    │  │ - Authorize  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────────────┐
│                  Notification Processing Layer                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Notification │  │ Preference   │  │ Delivery     │         │
│  │ Creator      │  │ Filter       │  │ Dispatcher   │         │
│  │              │  │              │  │              │         │
│  │ - Create     │  │ - Check      │  │ - WebSocket  │         │
│  │ - Enqueue    │  │   prefs      │  │ - Email      │         │
│  │ - Batch      │  │ - Filter     │  │ - Push       │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────────────┐
│                      Data Persistence Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ PostgreSQL   │  │ Redis        │  │ Message      │         │
│  │ Repository   │  │ Cache        │  │ Queue        │         │
│  │              │  │              │  │              │         │
│  │ - CRUD       │  │ - Sessions   │  │ - Jobs       │         │
│  │ - Queries    │  │ - Counters   │  │ - Retries    │         │
│  │ - Indexes    │  │ - Pub/Sub    │  │ - DLQ        │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

```yaml
application_layer:
  runtime: "Node.js 18 LTS"
  framework: "Express 4.18"
  websocket: "Socket.IO 4.6"
  language: "TypeScript 5.0"

websocket_infrastructure:
  server: "Socket.IO Server"
  adapter: "@socket.io/redis-adapter 8.2"
  redis_client: "ioredis 5.3"
  protocol: "WebSocket + fallback (long-polling)"

message_queue:
  library: "Bull 4.11"
  backend: "Redis 7.0"
  features:
    - job_scheduling
    - retry_logic
    - priority_queues

data_persistence:
  primary: "PostgreSQL 15"
  cache: "Redis 7.0"
  orm: "Prisma 5.0"

monitoring:
  metrics: "Prometheus + Grafana"
  logging: "Winston + ELK Stack"
  tracing: "OpenTelemetry"
  apm: "New Relic / DataDog"
```

---

## 4. WebSocket Connection Lifecycle

### 4.1 Connection Flow Diagram

```
Client                  Load Balancer         WS Server           Redis           Database
  │                           │                   │                 │                 │
  │ 1. WS Handshake          │                   │                 │                 │
  │─────────────────────────>│                   │                 │                 │
  │                           │ 2. Route (sticky) │                 │                 │
  │                           │──────────────────>│                 │                 │
  │                           │                   │ 3. Check capacity                │
  │                           │                   │─────────────────>│                 │
  │                           │                   │ (current < 10k?) │                 │
  │                           │                   │<─────────────────│                 │
  │                           │                   │                 │                 │
  │                           │                   │ 4. Verify JWT   │                 │
  │                           │                   │─────────────────────────────────>│
  │                           │                   │ (SELECT user)   │                 │
  │                           │                   │<─────────────────────────────────│
  │                           │                   │                 │                 │
  │                           │                   │ 5. Check max connections         │
  │                           │                   │─────────────────>│                 │
  │                           │                   │ GET user:*:conns │                 │
  │                           │                   │<─────────────────│                 │
  │                           │                   │                 │                 │
  │                           │                   │ 6. Store socket │                 │
  │                           │                   │─────────────────>│                 │
  │                           │                   │ SET socket:*    │                 │
  │                           │                   │                 │                 │
  │                           │                   │ 7. Join personal room              │
  │                           │                   │─────────────────>│                 │
  │                           │                   │ SADD room:user:* │                 │
  │                           │                   │                 │                 │
  │                           │                   │ 8. Fetch pending notifications    │
  │                           │                   │─────────────────────────────────>│
  │                           │                   │ SELECT * FROM... │                 │
  │                           │                   │<─────────────────────────────────│
  │                           │                   │                 │                 │
  │ 9. connected event       │                   │                 │                 │
  │<──────────────────────────────────────────────│                 │                 │
  │                           │                   │                 │                 │
  │ 10. notifications:pending │                   │                 │                 │
  │<──────────────────────────────────────────────│                 │                 │
  │                           │                   │                 │                 │
  │ 11. Periodic ping/pong   │                   │                 │                 │
  │<─────────────────────────────────────────────>│                 │                 │
  │    (every 25s)           │                   │                 │                 │
  │                           │                   │                 │                 │
```

### 4.2 Connection States

```typescript
enum ConnectionState {
  CONNECTING = 'connecting',      // Initial handshake
  AUTHENTICATING = 'authenticating', // JWT verification
  CONNECTED = 'connected',        // Active connection
  RECONNECTING = 'reconnecting',  // Temporary disconnect
  DISCONNECTED = 'disconnected',  // Clean disconnect
  ERROR = 'error'                 // Error state
}

interface ConnectionContext {
  socketId: string;
  userId: string;
  state: ConnectionState;
  connectedAt: Date;
  lastPing: Date;
  rooms: string[];
  deviceInfo: DeviceInfo;
  reconnectAttempts: number;
  metrics: {
    messagesReceived: number;
    messagesSent: number;
    bytesReceived: number;
    bytesSent: number;
    avgLatency: number;
  };
}
```

---

## 5. Room & Channel Architecture

### 5.1 Room Types

```yaml
room_types:
  personal:
    pattern: "user:{userId}"
    purpose: "Individual user notifications"
    members: 1
    example: "user:123"

  group:
    pattern: "group:{groupId}"
    purpose: "Group-wide announcements"
    members: "1-1000"
    example: "group:456"

  post:
    pattern: "post:{postId}"
    purpose: "Post-specific updates (likes, comments)"
    members: "1-10000"
    example: "post:789"

  direct_message:
    pattern: "dm:{conversationId}"
    purpose: "1-on-1 or group chat"
    members: "2-10"
    example: "dm:abc123"

  admin:
    pattern: "admin:broadcast"
    purpose: "System-wide announcements"
    members: "all_admins"
    example: "admin:broadcast"
```

### 5.2 Room Management

```
┌──────────────────────────────────────────────────────────────┐
│                      Room Manager                             │
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │ Join Handler    │  │ Leave Handler   │  │ Broadcast    ││
│  │                 │  │                 │  │ Handler      ││
│  │ 1. Authorize    │  │ 1. Remove from  │  │              ││
│  │ 2. Add to room  │  │    room         │  │ 1. Filter    ││
│  │ 3. Sync Redis   │  │ 2. Sync Redis   │  │    members   ││
│  │ 4. Notify       │  │ 3. Cleanup      │  │ 2. Send      ││
│  └─────────────────┘  └─────────────────┘  └──────────────┘│
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    Redis Room Storage                         │
│                                                               │
│  Key Pattern: room:{type}:{id}:members                       │
│  Type: SET                                                    │
│  Value: [socketId1, socketId2, ...]                          │
│  TTL: 3600s (auto-cleanup)                                   │
│                                                               │
│  Example:                                                     │
│  room:user:123:members → {socket-abc, socket-def}           │
│  room:post:789:members → {socket-xyz, socket-123, ...}      │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Room Authorization Matrix

```yaml
room_authorization:
  user:
    - action: join
      rule: "userId === room.userId"

  group:
    - action: join
      rule: "user.groupIds.includes(room.groupId)"

  post:
    - action: join
      rule: "user.canAccessPost(room.postId)"

  dm:
    - action: join
      rule: "user.id IN conversation.participants"

  admin:
    - action: join
      rule: "user.roles.includes('admin')"
```

---

## 6. Database Schema

### 6.1 Entity Relationship Diagram

```sql
┌─────────────────────────────────────────────────────────────────┐
│                         NOTIFICATIONS                            │
├─────────────────────────────────────────────────────────────────┤
│ PK │ id                UUID                                      │
│ FK │ recipient_id      UUID          → users.id                 │
│ FK │ actor_id          UUID          → users.id (who triggered) │
│ FK │ entity_id         UUID          → polymorphic reference    │
│    │ entity_type       VARCHAR(50)    (Post, Comment, etc.)     │
│    │ type              VARCHAR(50)    (like, comment, follow)   │
│    │ content           TEXT           (notification message)    │
│    │ read_at           TIMESTAMP                                │
│    │ delivered_at      TIMESTAMP                                │
│    │ metadata          JSONB          (additional data)         │
│    │ priority          SMALLINT       (0=low, 1=normal, 2=high) │
│    │ created_at        TIMESTAMP                                │
│    │ expires_at        TIMESTAMP      (optional TTL)            │
├─────────────────────────────────────────────────────────────────┤
│ Indexes:                                                         │
│ - idx_recipient_created (recipient_id, created_at DESC)         │
│ - idx_recipient_read (recipient_id, read_at) WHERE read_at NULL│
│ - idx_entity (entity_type, entity_id)                           │
│ - idx_created_at (created_at) - for cleanup                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NOTIFICATION_PREFERENCES                       │
├─────────────────────────────────────────────────────────────────┤
│ PK │ id                UUID                                      │
│ FK │ user_id           UUID          → users.id                 │
│    │ notification_type VARCHAR(50)   (like, comment, follow)    │
│    │ channel           VARCHAR(20)   (websocket, email, push)   │
│    │ enabled           BOOLEAN        DEFAULT true              │
│    │ frequency         VARCHAR(20)   (instant, daily, weekly)   │
│    │ quiet_hours_start TIME                                     │
│    │ quiet_hours_end   TIME                                     │
│    │ created_at        TIMESTAMP                                │
│    │ updated_at        TIMESTAMP                                │
├─────────────────────────────────────────────────────────────────┤
│ Indexes:                                                         │
│ - idx_user_type (user_id, notification_type)                   │
│ Constraints:                                                     │
│ - UNIQUE(user_id, notification_type, channel)                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 DDL Statements

```sql
-- Notifications table with partitioning
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    entity_id UUID,
    entity_type VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    read_at TIMESTAMP,
    delivered_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    priority SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    CONSTRAINT fk_recipient FOREIGN KEY (recipient_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_actor FOREIGN KEY (actor_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_priority CHECK (priority BETWEEN 0 AND 2),
    CONSTRAINT chk_type CHECK (type IN (
        'like', 'comment', 'follow', 'mention',
        'message', 'group_invite', 'system'
    ))
) PARTITION BY RANGE (created_at);

-- Partition by month for efficient archival
CREATE TABLE notifications_2025_12 PARTITION OF notifications
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Indexes for performance
CREATE INDEX idx_notifications_recipient_created
    ON notifications (recipient_id, created_at DESC);

CREATE INDEX idx_notifications_recipient_unread
    ON notifications (recipient_id, read_at)
    WHERE read_at IS NULL;

CREATE INDEX idx_notifications_entity
    ON notifications (entity_type, entity_id);

CREATE INDEX idx_notifications_created
    ON notifications (created_at);

-- Notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    frequency VARCHAR(20) DEFAULT 'instant',
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_channel CHECK (channel IN ('websocket', 'email', 'push')),
    CONSTRAINT chk_frequency CHECK (frequency IN ('instant', 'daily', 'weekly')),
    CONSTRAINT uniq_user_type_channel
        UNIQUE (user_id, notification_type, channel)
);

CREATE INDEX idx_prefs_user_type
    ON notification_preferences (user_id, notification_type);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prefs_updated_at BEFORE UPDATE
    ON notification_preferences FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## 7. Message Queue Architecture

### 7.1 Queue Design

```
┌──────────────────────────────────────────────────────────────────┐
│                      Notification Queues                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           HIGH PRIORITY QUEUE (priority: 2)             │    │
│  │  - System alerts                                         │    │
│  │  - Security notifications                                │    │
│  │  - Direct messages                                       │    │
│  │  Concurrency: 10 workers, Timeout: 5s                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │          NORMAL PRIORITY QUEUE (priority: 1)            │    │
│  │  - Likes, Comments                                       │    │
│  │  - Follows, Mentions                                     │    │
│  │  - Group notifications                                   │    │
│  │  Concurrency: 20 workers, Timeout: 10s                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            LOW PRIORITY QUEUE (priority: 0)             │    │
│  │  - Digest emails                                         │    │
│  │  - Weekly summaries                                      │    │
│  │  - Promotional notifications                             │    │
│  │  Concurrency: 5 workers, Timeout: 30s                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              DEAD LETTER QUEUE (DLQ)                    │    │
│  │  - Failed jobs after 3 retries                           │    │
│  │  - Manual review required                                │    │
│  │  Retention: 7 days                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Bull Queue Configuration

```typescript
// Queue setup with Redis backend
import Bull from 'bull';

const notificationQueue = new Bull('notifications', {
  redis: {
    host: process.env.REDIS_HOST,
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    enableOfflineQueue: false,
  },

  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: {
      age: 86400, // 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 604800, // 7 days
    },
  },

  settings: {
    lockDuration: 30000, // 30s
    stalledInterval: 5000, // Check every 5s
    maxStalledCount: 2,
  },
});

// Job processor
notificationQueue.process('send-notification', 20, async (job) => {
  const { notificationId, userId, type, content } = job.data;

  // 1. Check user preferences
  const shouldSend = await checkPreferences(userId, type);
  if (!shouldSend) {
    return { skipped: true, reason: 'user_preference' };
  }

  // 2. Deliver via WebSocket
  const delivered = await deliverViaWebSocket(userId, {
    id: notificationId,
    type,
    content,
  });

  // 3. Update delivery status
  await updateDeliveryStatus(notificationId, delivered);

  return { delivered, timestamp: Date.now() };
});

// Error handling
notificationQueue.on('failed', (job, err) => {
  logger.error('Job failed', {
    jobId: job.id,
    data: job.data,
    error: err.message,
    attempts: job.attemptsMade,
  });

  // Move to DLQ after max retries
  if (job.attemptsMade >= 3) {
    deadLetterQueue.add('failed-notification', job.data);
  }
});
```

---

## 8. Multi-Server Synchronization

### 8.1 Redis Adapter Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Socket.IO Cluster                            │
│                                                                 │
│  ┌──────────────┐        ┌──────────────┐        ┌──────────┐│
│  │ WS Server 1  │        │ WS Server 2  │        │ WS Server││
│  │              │        │              │        │    N     ││
│  │ Socket.IO    │        │ Socket.IO    │        │ Socket.IO││
│  │ + Adapter    │        │ + Adapter    │        │ + Adapter││
│  └──────┬───────┘        └──────┬───────┘        └─────┬────┘│
│         │                       │                       │     │
│         │     Redis Pub/Sub     │                       │     │
│         └───────────┬───────────┴───────────────────────┘     │
│                     │                                          │
└─────────────────────┼──────────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │    Redis Cluster       │
         │                        │
         │  Channels:             │
         │  - socket.io-adapter   │
         │  - socket.io-rooms     │
         │  - socket.io-presence  │
         │                        │
         │  Data:                 │
         │  - Active sockets      │
         │  - Room memberships    │
         │  - User presence       │
         └────────────────────────┘
```

### 8.2 Implementation

```typescript
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

// Create Redis clients for pub/sub
const pubClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
});

const subClient = pubClient.duplicate();

await Promise.all([
  pubClient.connect(),
  subClient.connect(),
]);

// Create Socket.IO server with Redis adapter
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
  adapter: createAdapter(pubClient, subClient),
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Broadcast to all servers
io.to(`user:${userId}`).emit('notification', data);

// Server-to-server acknowledgment
io.to(`user:${userId}`).timeout(5000).emit('notification', data, (err, responses) => {
  if (err) {
    // Handle timeout
  } else {
    // All servers acknowledged
  }
});
```

### 8.3 Synchronization Patterns

```yaml
broadcast_patterns:
  single_user:
    pattern: "io.to(`user:${userId}`).emit('event', data)"
    scope: "All servers with user connections"
    use_case: "Personal notifications"

  room:
    pattern: "io.to(`room:${roomId}`).emit('event', data)"
    scope: "All servers with room members"
    use_case: "Group notifications"

  server_specific:
    pattern: "io.local.emit('event', data)"
    scope: "Current server only"
    use_case: "Server health checks"

  broadcast_all:
    pattern: "io.emit('event', data)"
    scope: "All connected clients across all servers"
    use_case: "System announcements"
```

---

## 9. Reconnection & Failover Strategy

### 9.1 Client Reconnection Logic

```typescript
// Client-side reconnection configuration
const socket = io('wss://api.example.com', {
  auth: {
    token: getAuthToken(),
  },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5, // Random jitter
  timeout: 20000,
  transports: ['websocket', 'polling'],
});

// Exponential backoff with jitter
function calculateBackoff(attempt: number): number {
  const baseDelay = 1000;
  const maxDelay = 30000;
  const jitter = Math.random() * 0.5;

  const delay = Math.min(
    baseDelay * Math.pow(2, attempt) * (1 + jitter),
    maxDelay
  );

  return delay;
}

// Connection state management
socket.on('connect', () => {
  console.log('Connected:', socket.id);
  reconnectAttempts = 0;

  // Rejoin rooms
  const rooms = loadPersistedRooms();
  rooms.forEach(room => socket.emit('room:join', room));

  // Request missed notifications
  const lastTimestamp = loadLastNotificationTimestamp();
  socket.emit('notifications:sync', { since: lastTimestamp });
});

socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server initiated disconnect, manual reconnect
    socket.connect();
  }
  // Otherwise, auto-reconnect is handled by Socket.IO
});

socket.on('connect_error', (error) => {
  reconnectAttempts++;

  if (error.message === 'Token expired') {
    // Refresh token and reconnect
    refreshAuthToken()
      .then(newToken => {
        socket.auth.token = newToken;
        socket.connect();
      });
  }

  // Show user feedback
  if (reconnectAttempts > 5) {
    showReconnectionBanner('Connection issues. Retrying...');
  }
});
```

### 9.2 Server Failover

```yaml
failover_strategy:
  health_checks:
    interval: 10s
    timeout: 5s
    unhealthy_threshold: 3
    healthy_threshold: 2

  load_balancer:
    type: "Nginx"
    algorithm: "ip_hash" # Sticky sessions
    backup_servers: true

    upstream:
      - server ws1.example.com:3000 max_fails=3 fail_timeout=30s
      - server ws2.example.com:3000 max_fails=3 fail_timeout=30s
      - server ws3.example.com:3000 backup

  graceful_shutdown:
    1_stop_accepting: "Stop accepting new connections"
    2_drain_period: "Wait 30s for existing connections to close"
    3_force_close: "Force close remaining connections"
    4_cleanup: "Clear Redis state"

  automatic_recovery:
    - detect_failure: "Health check fails"
    - remove_from_pool: "Load balancer marks unhealthy"
    - notify_admin: "Alert sent to ops team"
    - auto_restart: "Systemd restarts service"
    - health_check: "Wait for healthy status"
    - add_to_pool: "Load balancer marks healthy"
```

---

## 10. Rate Limiting & Backpressure

### 10.1 Rate Limiting Strategy

```typescript
// Token bucket rate limiter
class RateLimiter {
  private buckets = new Map<string, TokenBucket>();

  constructor(
    private maxTokens: number,
    private refillRate: number,
    private refillInterval: number
  ) {}

  async checkLimit(key: string): Promise<boolean> {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = new TokenBucket(this.maxTokens, this.refillRate);
      this.buckets.set(key, bucket);
    }

    return bucket.consume();
  }
}

// Apply rate limiting to WebSocket events
io.use(async (socket, next) => {
  const userId = socket.data.userId;

  // Global rate limit: 100 events/minute per user
  const allowed = await rateLimiter.checkLimit(`user:${userId}`, {
    max: 100,
    window: 60000,
  });

  if (!allowed) {
    return next(new Error('Rate limit exceeded'));
  }

  next();
});

// Per-event rate limiting
socket.on('notification:send', async (data) => {
  const allowed = await rateLimiter.checkLimit(
    `user:${socket.data.userId}:send`,
    { max: 10, window: 60000 }
  );

  if (!allowed) {
    return socket.emit('error', {
      code: 'RATE_LIMIT',
      message: 'Too many notifications sent',
      retryAfter: 60,
    });
  }

  // Process notification
});
```

### 10.2 Backpressure Handling

```yaml
backpressure_mechanisms:
  connection_limits:
    max_per_server: 10000
    max_per_user: 5
    action: "Disconnect oldest connection"

  message_queue:
    max_queue_size: 100000
    action: "Reject new jobs, return 503"
    monitoring: "Alert when queue > 80% capacity"

  broadcast_throttling:
    max_recipients: 10000
    batch_size: 1000
    delay_between_batches: 100ms

  buffer_management:
    socket_buffer_limit: 1048576  # 1MB
    action: "Pause socket, drain buffer"
    timeout: 30s

  circuit_breaker:
    failure_threshold: 50%
    timeout: 30s
    half_open_requests: 10
```

---

## 11. Notification Delivery Pipeline

### 11.1 End-to-End Flow

```
┌─────────┐
│ Trigger │ (User likes post)
└────┬────┘
     │
     ▼
┌─────────────────────┐
│ Notification Creator│
│ - Build payload     │
│ - Determine type    │
│ - Set priority      │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Preference Filter   │
│ - Check enabled     │
│ - Check quiet hours │
│ - Check frequency   │
└────┬────────────────┘
     │
     ├─(Skip)───> [End]
     │
     ▼
┌─────────────────────┐
│ Persist to DB       │
│ INSERT notification │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Enqueue Job         │
│ Bull Queue (Redis)  │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Job Processor       │
│ - Dequeue job       │
│ - Acquire lock      │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Delivery Dispatcher │
│ - WebSocket (pri 1) │
│ - Email (pri 2)     │
│ - Push (pri 3)      │
└────┬────────────────┘
     │
     ├──[WebSocket]──>┌─────────────────┐
     │                 │ Check Redis for │
     │                 │ active sockets  │
     │                 └────┬────────────┘
     │                      │
     │                      ├─(Online)──>┌──────────────┐
     │                      │             │ io.to().emit │
     │                      │             └──────────────┘
     │                      │
     │                      └─(Offline)──> [Queue for push]
     │
     ├──[Email]──────>┌─────────────────┐
     │                 │ Send via SES    │
     │                 └─────────────────┘
     │
     └──[Push]───────>┌─────────────────┐
                       │ Send via FCM    │
                       └─────────────────┘
```

### 11.2 Delivery Guarantees

```yaml
delivery_semantics:
  websocket:
    guarantee: "At-most-once"
    fallback: "Push notification if offline"
    retry: false

  email:
    guarantee: "At-least-once"
    retry: true
    max_attempts: 3

  push:
    guarantee: "At-least-once"
    retry: true
    max_attempts: 5

idempotency:
  mechanism: "notification_id as deduplication key"
  window: "24 hours"
  storage: "Redis SET with TTL"
```

---

## 12. API Contracts

### 12.1 REST API

```yaml
openapi: 3.0.0
info:
  title: Notifications API
  version: 1.0.0

paths:
  /api/notifications:
    get:
      summary: Get user notifications
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
        - name: unreadOnly
          in: query
          schema:
            type: boolean
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  notifications:
                    type: array
                    items:
                      $ref: '#/components/schemas/Notification'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

  /api/notifications/{id}/read:
    patch:
      summary: Mark notification as read
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        200:
          description: Marked as read

  /api/notifications/read-all:
    post:
      summary: Mark all notifications as read
      responses:
        200:
          description: All marked as read

  /api/notifications/preferences:
    get:
      summary: Get notification preferences
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/NotificationPreference'

    put:
      summary: Update preferences
      requestBody:
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/NotificationPreference'
      responses:
        200:
          description: Preferences updated

components:
  schemas:
    Notification:
      type: object
      properties:
        id:
          type: string
          format: uuid
        type:
          type: string
          enum: [like, comment, follow, mention, message]
        content:
          type: string
        actor:
          $ref: '#/components/schemas/User'
        readAt:
          type: string
          format: date-time
        createdAt:
          type: string
          format: date-time
```

### 12.2 WebSocket Events

```typescript
// Client → Server events
interface ClientToServerEvents {
  // Room management
  'room:join': (roomName: string) => void;
  'room:leave': (roomName: string) => void;

  // Notification actions
  'notification:read': (notificationId: string) => void;
  'notification:readAll': () => void;

  // Sync
  'notifications:sync': (params: { since: Date }) => void;

  // Presence
  'presence:update': (status: 'online' | 'away' | 'offline') => void;
}

// Server → Client events
interface ServerToClientEvents {
  // Connection lifecycle
  'connected': (data: { socketId: string; userId: string }) => void;
  'error': (error: { code: string; message: string }) => void;

  // Notifications
  'notification': (notification: Notification) => void;
  'notifications:pending': (data: {
    notifications: Notification[];
    hasMore: boolean;
  }) => void;

  // Room events
  'room:joined': (roomName: string) => void;
  'room:left': (roomName: string) => void;
  'room:message': (message: RoomMessage) => void;

  // Presence
  'presence:user:online': (userId: string) => void;
  'presence:user:offline': (userId: string) => void;
}
```

---

## 13. Scalability Design

### 13.1 Horizontal Scaling

```yaml
scaling_strategy:
  application_tier:
    instances: "2-10 auto-scaling"
    cpu_threshold: 70%
    memory_threshold: 80%
    connections_per_instance: 10000

  redis_tier:
    topology: "Redis Cluster"
    nodes: 6 (3 primary + 3 replica)
    sharding: "Hash slots"
    failover: "Automatic"

  database_tier:
    primary: 1
    read_replicas: 3
    connection_pooling:
      min: 10
      max: 100

  message_queue:
    workers: "Auto-scale 5-50"
    queue_length_threshold: 1000
```

### 13.2 Performance Targets

```yaml
performance_slas:
  websocket_connection:
    p50: "< 100ms"
    p95: "< 300ms"
    p99: "< 500ms"

  notification_delivery:
    p50: "< 200ms"
    p95: "< 500ms"
    p99: "< 1000ms"

  message_throughput:
    per_server: "50,000 msg/sec"
    cluster: "500,000 msg/sec"

  concurrent_connections:
    per_server: 10000
    cluster: 100000+
```

---

## 14. Security Architecture

### 14.1 Authentication & Authorization

```yaml
security_layers:
  websocket_authentication:
    method: JWT
    location: "Handshake auth header"
    validation: "Verify signature + expiry"
    refresh: "Auto-refresh before expiry"

  authorization:
    model: RBAC
    checks:
      - room_access: "User can join room"
      - notification_access: "User owns notification"
      - action_permission: "User can perform action"

  encryption:
    in_transit: "TLS 1.3"
    websocket: "WSS (WebSocket Secure)"

  rate_limiting:
    connection: "5 per user"
    events: "100/min per user"
    broadcast: "10/min per user"
```

### 14.2 Threat Mitigation

```yaml
security_controls:
  ddos_protection:
    - cloudflare_proxy
    - rate_limiting
    - connection_limits

  injection_prevention:
    - input_validation
    - output_sanitization
    - parameterized_queries

  xss_prevention:
    - content_security_policy
    - sanitize_html
    - escape_user_content

  authentication_attacks:
    - bcrypt_password_hashing
    - jwt_signature_verification
    - token_expiry
    - refresh_token_rotation
```

---

## 15. Monitoring & Observability

### 15.1 Metrics

```yaml
prometheus_metrics:
  connection_metrics:
    - websocket_connections_active{server_id}
    - websocket_connections_total
    - websocket_connection_duration_seconds
    - websocket_stale_connections_total

  message_metrics:
    - websocket_messages_sent_total{event_type}
    - websocket_messages_received_total{event_type}
    - websocket_message_size_bytes
    - websocket_broadcast_duration_seconds

  notification_metrics:
    - notifications_created_total{type}
    - notifications_delivered_total{channel}
    - notifications_failed_total{reason}
    - notification_delivery_latency_seconds

  queue_metrics:
    - queue_jobs_active
    - queue_jobs_completed_total
    - queue_jobs_failed_total
    - queue_job_duration_seconds
```

### 15.2 Logging Strategy

```yaml
structured_logging:
  connection_events:
    - connect
    - disconnect
    - reconnect
    - authentication_failed

  notification_events:
    - created
    - enqueued
    - delivered
    - failed
    - read

  error_events:
    - rate_limit_exceeded
    - authorization_failed
    - queue_error
    - redis_error

  log_format: JSON
  log_level: INFO
  retention: 30 days
```

---

## Appendix

### Technology Decisions

| Decision | Technology | Rationale |
|----------|-----------|-----------|
| WebSocket Library | Socket.IO | Built-in reconnection, rooms, Redis adapter |
| Message Queue | Bull | Redis-backed, retries, priorities |
| Cache/Pub-Sub | Redis | High performance, clustering support |
| Database | PostgreSQL | ACID, JSON support, partitioning |
| Load Balancer | Nginx | Sticky sessions, WebSocket support |

### Glossary

- **Room**: A logical channel for broadcasting messages to specific groups
- **Adapter**: Mechanism for synchronizing Socket.IO across multiple servers
- **Backpressure**: System's ability to handle load by slowing input
- **DLQ**: Dead Letter Queue for failed message processing
- **Sticky Session**: Routing strategy to maintain client-server affinity

---

**Document Status**: ARCHITECTURE DRAFT
**Next Phase**: SPARC Phase 4 - Refinement (TDD Implementation)
**Generated**: 2025-12-16

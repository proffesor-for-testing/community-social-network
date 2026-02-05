# ADR-012: Observability Strategy

**Status**: Accepted
**Date**: 2026-02-05
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-002 (Modular Monolith), ADR-003 (REST API), ADR-005 (SQL Database), ADR-007 (Bounded Contexts), ADR-009 (Domain Events), ADR-010 (Repository Pattern)

## Context

The Community Social Network platform is a modular monolith (ADR-002) with 7 bounded contexts (ADR-007), ~40 domain events (ADR-009), 3-tier caching with Redis (ADR-010), Bull Queue for asynchronous event processing (ADR-009), and Socket.IO for real-time WebSocket delivery (ADR-009). Without a structured observability strategy, diagnosing production issues in this event-driven system would be extremely difficult.

The QE Requirements Validation Report identified the absence of observability as a P0 (CRITICAL) gap:

> "There is no ADR covering logging, metrics, health checks, alerting, or distributed tracing. ADR-009 mentions 'correlation IDs and distributed tracing' in mitigations but provides no specification. For a system with ~40 domain events, 7 bounded contexts, and 3-tier caching, production debugging without observability tooling would be extremely difficult."

Specific observability needs arising from existing ADRs:

1. **Event Tracing** (ADR-009): Domain events flow through in-process dispatchers, Bull Queue, and Socket.IO. A single user action (e.g., creating a publication) fans out into multiple asynchronous handlers across bounded contexts. Without correlation IDs and tracing, reconstructing these flows is infeasible.
2. **Cache Monitoring** (ADR-010): The 3-tier caching strategy targets 85-90% hit rate. Without metrics, there is no way to verify this target or detect degradation.
3. **Queue Health** (ADR-009): Bull Queue processes integration events with 3 retries and exponential backoff. Failed events move to a Dead Letter Queue. Without queue depth and DLQ monitoring, handler bugs accumulate silently.
4. **Performance SLAs** (ADR-002, ADR-005): The system targets p50 < 100ms, p95 < 500ms, p99 < 1000ms. Without request latency histograms, SLA violations go undetected.
5. **Health Checks** (ADR-002): ADR-002 mentions "health checks, auto-restart, multiple replicas" but provides no specification.
6. **Audit Trail** (ADR-009): Security events (authentication failures, blocks, admin actions) require structured logging for forensic analysis.

Key technical constraints:
- **NestJS** application framework with built-in interceptors and middleware
- **PostgreSQL 15+** as primary database (connection pool of 20)
- **Redis 7+** for caching, Bull Queue, and Socket.IO adapter
- **Bull Queue** for asynchronous event processing
- **Socket.IO** for real-time WebSocket delivery
- **Modular monolith** deployment (single process, multiple modules)

## Decision

We adopt a **three-pillar observability strategy** covering Structured Logging, Application Metrics, and Distributed Tracing, supplemented by Health Check endpoints and Alerting thresholds.

### Observability Architecture

```
+---------------------------------------------------------------------------+
|                       Observability Architecture                          |
+---------------------------------------------------------------------------+

                        +------------------+
                        |   Application    |
                        |  (NestJS Modules)|
                        +--------+---------+
                                 |
              +------------------+------------------+
              |                  |                  |
              v                  v                  v
     +-----------------+ +----------------+ +------------------+
     | Structured Logs | | Metrics        | | Distributed      |
     | (Pino)          | | (Prometheus)   | | Tracing (OTel)   |
     |                 | |                | |                  |
     | - JSON format   | | - Histograms   | | - Correlation ID |
     | - Log levels    | | - Counters     | | - Span context   |
     | - Request ID    | | - Gauges       | | - Trace export   |
     | - PII masking   | |                | |                  |
     +---------+-------+ +--------+-------+ +--------+---------+
               |                  |                  |
               v                  v                  v
     +-----------------+ +----------------+ +------------------+
     | Log Aggregation | | Prometheus     | | Trace Collector  |
     | (stdout/file)   | | Server         | | (OTel Collector) |
     +---------+-------+ +--------+-------+ +--------+---------+
               |                  |                  |
               +------------------+------------------+
                                 |
                                 v
                        +------------------+
                        |    Grafana       |
                        |   Dashboards     |
                        +------------------+
                                 |
                                 v
                        +------------------+
                        | Alertmanager     |
                        | (PagerDuty /     |
                        |  Slack / Email)  |
                        +------------------+
```

### Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Logging | Pino + `nestjs-pino` | Fastest JSON logger for Node.js; native NestJS integration |
| Metrics | `prom-client` | De facto standard for Prometheus metrics in Node.js |
| Tracing | OpenTelemetry SDK | Vendor-neutral; supports Jaeger, Zipkin, OTLP backends |
| Visualization | Grafana | Unified dashboards for logs, metrics, and traces |
| Alerting | Prometheus Alertmanager | Native integration with Prometheus; flexible routing |
| Health Checks | `@nestjs/terminus` | Built-in NestJS health check module |

---

### 1. Structured Logging

#### Logging Library

We use **Pino** with the `nestjs-pino` integration. Pino produces JSON-structured logs with minimal performance overhead (benchmarked at ~5x faster than Winston for JSON serialization).

#### Log Levels

| Level | Numeric | Usage | Environments |
|-------|---------|-------|-------------|
| `fatal` | 60 | Application cannot continue; process will exit | All |
| `error` | 50 | Operation failed; requires investigation | All |
| `warn` | 40 | Unexpected condition that does not prevent operation | All |
| `info` | 30 | Significant business events (user registered, post created) | Production, Staging |
| `debug` | 20 | Detailed operational data (cache hit/miss, query timing) | Development, Staging |
| `trace` | 10 | Extremely detailed debugging (full request/response bodies) | Development only |

#### Log Level Configuration per Environment

| Environment | Minimum Level | Rationale |
|-------------|--------------|-----------|
| `production` | `info` | Minimize log volume; capture business events and errors |
| `staging` | `debug` | Enable detailed debugging for pre-production validation |
| `development` | `debug` | Full visibility for local development |
| `test` | `warn` | Suppress noise during test execution |

#### Required Log Fields

Every log entry MUST include the following fields:

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `timestamp` | ISO 8601 string | Pino automatic | When the log entry was created |
| `level` | string | Pino automatic | Log level name |
| `requestId` | UUID | `X-Request-ID` header or generated | Correlation ID for request tracing |
| `userId` | string or `null` | JWT `sub` claim | Authenticated user ID (null for unauthenticated) |
| `context` | string | NestJS module/service name | Origin of the log entry |
| `message` | string | Developer-provided | Human-readable log message |

#### Pino Configuration

```typescript
// src/infrastructure/observability/logging/LoggerConfig.ts

import { Params } from 'nestjs-pino';

export function createLoggerConfig(env: string): Params {
  return {
    pinoHttp: {
      level: getLogLevel(env),
      transport: env === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined, // JSON in production

      genReqId: (req) => {
        return req.headers['x-request-id'] as string
          || crypto.randomUUID();
      },

      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          headers: {
            'user-agent': req.headers['user-agent'],
            'content-type': req.headers['content-type'],
          },
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },

      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.confirmPassword',
          'req.body.currentPassword',
          'req.body.newPassword',
          'req.body.token',
          'req.body.refreshToken',
        ],
        censor: '[REDACTED]',
      },

      customProps: (req) => ({
        userId: (req as any).user?.sub ?? null,
        context: 'HTTP',
      }),
    },
  };
}

function getLogLevel(env: string): string {
  switch (env) {
    case 'production': return 'info';
    case 'staging': return 'debug';
    case 'test': return 'warn';
    default: return 'debug';
  }
}
```

#### Sensitive Data Masking

All log output MUST mask sensitive data. The following masking rules apply:

| Data Type | Masking Rule | Example |
|-----------|-------------|---------|
| Passwords | Full redaction | `[REDACTED]` |
| Tokens (JWT, refresh) | Full redaction | `[REDACTED]` |
| Authorization header | Full redaction | `[REDACTED]` |
| Cookies | Full redaction | `[REDACTED]` |
| Email addresses | Partial masking | `j***@example.com` |
| IP addresses | Logged as-is (operational necessity) | `192.168.1.100` |

```typescript
// src/infrastructure/observability/logging/SensitiveDataMasker.ts

export class SensitiveDataMasker {
  static maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 1) return `*@${domain}`;
    return `${local[0]}***@${domain}`;
  }

  static maskPII(data: Record<string, unknown>): Record<string, unknown> {
    const masked = { ...data };
    if (typeof masked.email === 'string') {
      masked.email = SensitiveDataMasker.maskEmail(masked.email);
    }
    const sensitiveKeys = ['password', 'token', 'secret', 'credential'];
    for (const key of Object.keys(masked)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        masked[key] = '[REDACTED]';
      }
    }
    return masked;
  }
}
```

#### Request/Response Logging Middleware

Every HTTP request MUST be logged with method, path, status code, and duration.

```typescript
// Pino HTTP middleware (configured via nestjs-pino) automatically logs:
// - Request: method, url, requestId
// - Response: statusCode, responseTime (ms)

// Example log output (production, JSON):
```

```json
{
  "level": "info",
  "time": "2026-02-05T14:23:45.123Z",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "usr_abc123",
  "context": "HTTP",
  "req": {
    "method": "POST",
    "url": "/api/v1/posts"
  },
  "res": {
    "statusCode": 201
  },
  "responseTime": 87,
  "message": "request completed"
}
```

```json
{
  "level": "info",
  "time": "2026-02-05T14:23:45.200Z",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "usr_abc123",
  "context": "ContentService",
  "message": "Publication created",
  "publicationId": "pub_xyz789",
  "visibility": "public",
  "mentionCount": 2
}
```

```json
{
  "level": "error",
  "time": "2026-02-05T14:23:46.050Z",
  "requestId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "userId": null,
  "context": "AuthService",
  "message": "Authentication failed",
  "email": "j***@example.com",
  "reason": "invalid_credentials",
  "failedAttempts": 3
}
```

#### Domain Event Logging

All domain events published through any channel (in-process, Bull Queue, Socket.IO) MUST be logged at `info` level with the event type, aggregate ID, and correlation ID.

```typescript
// src/infrastructure/observability/logging/EventLogger.ts

import { Logger } from '@nestjs/common';
import { DomainEvent } from '../../../domain/shared/events/DomainEvent';

export class EventLogger {
  private readonly logger = new Logger('DomainEvents');

  logPublished(event: DomainEvent, channel: string, requestId: string): void {
    this.logger.log({
      message: 'Domain event published',
      requestId,
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      channel,
      version: event.version,
    });
  }

  logConsumed(event: DomainEvent, handler: string, requestId: string, durationMs: number): void {
    this.logger.log({
      message: 'Domain event consumed',
      requestId,
      eventId: event.eventId,
      eventType: event.eventType,
      handler,
      durationMs,
    });
  }

  logFailed(event: DomainEvent, handler: string, requestId: string, error: Error, attempt: number): void {
    this.logger.error({
      message: 'Domain event processing failed',
      requestId,
      eventId: event.eventId,
      eventType: event.eventType,
      handler,
      attempt,
      error: error.message,
      stack: error.stack,
    });
  }
}
```

---

### 2. Application Metrics (Prometheus)

We expose application metrics via a `/metrics` endpoint in Prometheus exposition format using the `prom-client` library.

#### Metrics Endpoint

```typescript
// src/infrastructure/observability/metrics/MetricsModule.ts

import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'csn_', // Community Social Network prefix
        },
      },
    }),
  ],
})
export class MetricsModule {}
```

#### HTTP Request Metrics

```typescript
// src/infrastructure/observability/metrics/HttpMetrics.ts

import { Histogram, Counter } from 'prom-client';

export const httpRequestDuration = new Histogram({
  name: 'csn_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
});

export const httpRequestsTotal = new Counter({
  name: 'csn_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
});
```

#### HTTP Metrics Interceptor

```typescript
// src/infrastructure/observability/metrics/HttpMetricsInterceptor.ts

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { httpRequestDuration, httpRequestsTotal } from './HttpMetrics';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const path = this.normalizePath(req.route?.path || req.url);
    const timer = httpRequestDuration.startTimer({ method, path });

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = context.switchToHttp().getResponse().statusCode;
          timer({ status_code: String(statusCode) });
          httpRequestsTotal.inc({ method, path, status_code: String(statusCode) });
        },
        error: (err) => {
          const statusCode = err.status || 500;
          timer({ status_code: String(statusCode) });
          httpRequestsTotal.inc({ method, path, status_code: String(statusCode) });
        },
      }),
    );
  }

  /**
   * Normalize path to avoid high-cardinality labels.
   * Replace dynamic segments (UUIDs, IDs) with placeholders.
   */
  private normalizePath(path: string): string {
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }
}
```

#### Business Metrics

```typescript
// src/infrastructure/observability/metrics/BusinessMetrics.ts

import { Counter } from 'prom-client';

// Identity Context
export const usersRegisteredTotal = new Counter({
  name: 'csn_users_registered_total',
  help: 'Total number of user registrations',
});

export const authSuccessTotal = new Counter({
  name: 'csn_auth_success_total',
  help: 'Total number of successful authentications',
});

export const authFailuresTotal = new Counter({
  name: 'csn_auth_failures_total',
  help: 'Total number of failed authentication attempts',
  labelNames: ['reason'], // invalid_credentials, account_locked, account_suspended
});

export const tokenRefreshTotal = new Counter({
  name: 'csn_token_refresh_total',
  help: 'Total number of token refresh operations',
  labelNames: ['result'], // success, expired, revoked, reuse_detected
});

export const accountLockoutsTotal = new Counter({
  name: 'csn_account_lockouts_total',
  help: 'Total number of account lockouts',
});

// Content Context
export const postsCreatedTotal = new Counter({
  name: 'csn_posts_created_total',
  help: 'Total number of posts created',
  labelNames: ['visibility'], // public, followers_only, group
});

export const commentsCreatedTotal = new Counter({
  name: 'csn_comments_created_total',
  help: 'Total number of comments created',
});

export const reactionsTotal = new Counter({
  name: 'csn_reactions_total',
  help: 'Total number of reactions added',
  labelNames: ['type'], // like, love, etc.
});

// Social Graph Context
export const followsTotal = new Counter({
  name: 'csn_follows_total',
  help: 'Total number of follow operations',
  labelNames: ['action'], // followed, unfollowed, requested, approved, rejected
});

export const blocksTotal = new Counter({
  name: 'csn_blocks_total',
  help: 'Total number of block operations',
  labelNames: ['action'], // blocked, unblocked
});

// Community Context
export const groupsCreatedTotal = new Counter({
  name: 'csn_groups_created_total',
  help: 'Total number of groups created',
});

export const membershipChangesTotal = new Counter({
  name: 'csn_membership_changes_total',
  help: 'Total number of group membership changes',
  labelNames: ['action'], // joined, left, kicked, promoted, demoted
});
```

#### Cache Metrics

```typescript
// src/infrastructure/observability/metrics/CacheMetrics.ts

import { Counter, Gauge } from 'prom-client';

export const cacheHitTotal = new Counter({
  name: 'csn_cache_hit_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_prefix', 'tier'], // tier: local, redis
});

export const cacheMissTotal = new Counter({
  name: 'csn_cache_miss_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_prefix'],
});

export const cacheHitRate = new Gauge({
  name: 'csn_cache_hit_rate',
  help: 'Cache hit rate (0-1) computed over a sliding window',
  labelNames: ['cache_prefix'],
});

export const cacheEvictionsTotal = new Counter({
  name: 'csn_cache_evictions_total',
  help: 'Total number of cache evictions',
  labelNames: ['cache_prefix', 'reason'], // reason: ttl_expired, manual_invalidation
});
```

#### Queue Metrics

```typescript
// src/infrastructure/observability/metrics/QueueMetrics.ts

import { Gauge, Histogram, Counter } from 'prom-client';

export const queueDepth = new Gauge({
  name: 'csn_queue_depth',
  help: 'Current number of jobs in queue',
  labelNames: ['queue_name', 'state'], // state: waiting, active, delayed, failed
});

export const queueProcessingDuration = new Histogram({
  name: 'csn_queue_processing_duration_seconds',
  help: 'Duration of queue job processing in seconds',
  labelNames: ['queue_name', 'event_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0],
});

export const queueFailedTotal = new Counter({
  name: 'csn_queue_failed_total',
  help: 'Total number of failed queue jobs',
  labelNames: ['queue_name', 'event_type'],
});

export const queueCompletedTotal = new Counter({
  name: 'csn_queue_completed_total',
  help: 'Total number of completed queue jobs',
  labelNames: ['queue_name', 'event_type'],
});

export const dlqDepth = new Gauge({
  name: 'csn_dlq_depth',
  help: 'Current number of jobs in dead letter queue',
});
```

#### WebSocket Metrics

```typescript
// src/infrastructure/observability/metrics/WebSocketMetrics.ts

import { Gauge, Counter } from 'prom-client';

export const websocketConnectionsActive = new Gauge({
  name: 'csn_websocket_connections_active',
  help: 'Current number of active WebSocket connections',
});

export const websocketConnectionsTotal = new Counter({
  name: 'csn_websocket_connections_total',
  help: 'Total number of WebSocket connections established',
});

export const websocketDisconnectsTotal = new Counter({
  name: 'csn_websocket_disconnects_total',
  help: 'Total number of WebSocket disconnections',
  labelNames: ['reason'], // reason: client_close, timeout, error
});

export const websocketMessagesSentTotal = new Counter({
  name: 'csn_websocket_messages_sent_total',
  help: 'Total number of WebSocket messages sent to clients',
  labelNames: ['event_type'],
});

export const websocketRoomMemberships = new Gauge({
  name: 'csn_websocket_room_memberships',
  help: 'Current number of room memberships',
  labelNames: ['room_type'], // room_type: personal, group, post, direct_message, admin
});
```

#### Database Metrics

```typescript
// src/infrastructure/observability/metrics/DatabaseMetrics.ts

import { Histogram, Gauge } from 'prom-client';

export const dbQueryDuration = new Histogram({
  name: 'csn_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'], // operation: select, insert, update, delete
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
});

export const dbConnectionPoolActive = new Gauge({
  name: 'csn_db_connection_pool_active',
  help: 'Number of active connections in the database connection pool',
});

export const dbConnectionPoolIdle = new Gauge({
  name: 'csn_db_connection_pool_idle',
  help: 'Number of idle connections in the database connection pool',
});

export const dbConnectionPoolWaiting = new Gauge({
  name: 'csn_db_connection_pool_waiting',
  help: 'Number of requests waiting for a database connection',
});

export const dbQueryErrorsTotal = new Counter({
  name: 'csn_db_query_errors_total',
  help: 'Total number of database query errors',
  labelNames: ['operation', 'error_type'], // error_type: timeout, constraint_violation, connection_error
});
```

#### Complete Metrics Catalog

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `csn_http_request_duration_seconds` | Histogram | method, path, status_code | HTTP request latency |
| `csn_http_requests_total` | Counter | method, path, status_code | Total HTTP requests |
| `csn_users_registered_total` | Counter | -- | User registrations |
| `csn_auth_success_total` | Counter | -- | Successful logins |
| `csn_auth_failures_total` | Counter | reason | Failed login attempts |
| `csn_token_refresh_total` | Counter | result | Token refresh operations |
| `csn_account_lockouts_total` | Counter | -- | Account lockouts |
| `csn_posts_created_total` | Counter | visibility | Posts created |
| `csn_comments_created_total` | Counter | -- | Comments created |
| `csn_reactions_total` | Counter | type | Reactions added |
| `csn_follows_total` | Counter | action | Follow operations |
| `csn_blocks_total` | Counter | action | Block operations |
| `csn_groups_created_total` | Counter | -- | Groups created |
| `csn_membership_changes_total` | Counter | action | Group membership changes |
| `csn_cache_hit_total` | Counter | cache_prefix, tier | Cache hits |
| `csn_cache_miss_total` | Counter | cache_prefix | Cache misses |
| `csn_cache_hit_rate` | Gauge | cache_prefix | Cache hit rate (0-1) |
| `csn_cache_evictions_total` | Counter | cache_prefix, reason | Cache evictions |
| `csn_queue_depth` | Gauge | queue_name, state | Queue job count |
| `csn_queue_processing_duration_seconds` | Histogram | queue_name, event_type | Job processing time |
| `csn_queue_failed_total` | Counter | queue_name, event_type | Failed queue jobs |
| `csn_queue_completed_total` | Counter | queue_name, event_type | Completed queue jobs |
| `csn_dlq_depth` | Gauge | -- | Dead letter queue depth |
| `csn_websocket_connections_active` | Gauge | -- | Active WebSocket connections |
| `csn_websocket_connections_total` | Counter | -- | Total WebSocket connections |
| `csn_websocket_disconnects_total` | Counter | reason | WebSocket disconnections |
| `csn_websocket_messages_sent_total` | Counter | event_type | WebSocket messages sent |
| `csn_websocket_room_memberships` | Gauge | room_type | Room membership count |
| `csn_db_query_duration_seconds` | Histogram | operation, table | Database query latency |
| `csn_db_connection_pool_active` | Gauge | -- | Active DB connections |
| `csn_db_connection_pool_idle` | Gauge | -- | Idle DB connections |
| `csn_db_connection_pool_waiting` | Gauge | -- | Waiting DB connection requests |
| `csn_db_query_errors_total` | Counter | operation, error_type | Database query errors |

---

### 3. Distributed Tracing

#### Correlation ID Propagation

Every request entering the system receives a correlation ID (also called request ID) that is propagated through all layers: HTTP handlers, domain services, event publishers, queue consumers, and WebSocket emitters.

```
+---------------------------------------------------------------------------+
|                     Correlation ID Propagation Flow                       |
+---------------------------------------------------------------------------+

Client Request
    |
    | X-Request-ID: abc-123 (or auto-generated)
    v
+-------------------+
| HTTP Middleware    |  <-- Extracts or generates X-Request-ID
| (CorrelationID)   |  <-- Stores in AsyncLocalStorage
+--------+----------+
         |
         | requestId available in all downstream calls
         v
+-------------------+     +-------------------+     +-------------------+
| Application       |---->| Domain Event      |---->| Bull Queue Job    |
| Service           |     | (includes         |     | (includes         |
| (reads from ALS)  |     |  correlationId)   |     |  correlationId)   |
+-------------------+     +-------------------+     +-------------------+
         |                                                   |
         v                                                   v
+-------------------+     +-------------------+     +-------------------+
| Database Query    |     | Socket.IO Emit    |     | Queue Consumer    |
| (span created     |     | (includes         |     | (restores         |
|  with traceId)    |     |  correlationId)   |     |  correlationId    |
+-------------------+     +-------------------+     |  into ALS)        |
                                                    +-------------------+
```

#### Correlation ID Middleware

```typescript
// src/infrastructure/observability/tracing/CorrelationIdMiddleware.ts

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface RequestContext {
  requestId: string;
  userId: string | null;
  startTime: number;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    const userId = (req as any).user?.sub ?? null;

    // Set response header for client correlation
    res.setHeader('X-Request-ID', requestId);

    const context: RequestContext = {
      requestId,
      userId,
      startTime: Date.now(),
    };

    requestContextStorage.run(context, () => {
      next();
    });
  }
}
```

#### Correlation ID in Domain Events

Domain events carry the correlation ID so that asynchronous handlers can reconstruct the original request context.

```typescript
// Extended DomainEvent with correlation ID support

export abstract class DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly version: number;
  readonly correlationId: string; // Added for distributed tracing

  constructor(
    aggregateId: string,
    aggregateType: string,
    version: number = 1,
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
    this.version = version;

    // Capture correlation ID from current request context
    const context = requestContextStorage.getStore();
    this.correlationId = context?.requestId || randomUUID();

    Object.freeze(this);
  }

  toJSON(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      occurredOn: this.occurredOn.toISOString(),
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      version: this.version,
      correlationId: this.correlationId,
      payload: this.getPayload(),
    };
  }

  abstract get eventType(): string;
  protected abstract getPayload(): Record<string, unknown>;
}
```

#### Correlation ID in Bull Queue Jobs

```typescript
// src/infrastructure/shared/events/BullQueueEventPublisher.ts (updated)

export class BullQueueEventPublisher implements IntegrationEventPublisher {
  async publish(event: DomainEvent): Promise<void> {
    await this.queue.add(event.eventType, {
      ...event.toJSON(),
      correlationId: event.correlationId, // Propagated to job data
    }, {
      priority: this.getPriority(event),
    });
  }
}

// Queue consumer restores correlation ID
export class IntegrationEventConsumer {
  async process(job: Job): Promise<void> {
    const correlationId = job.data.correlationId || randomUUID();

    // Restore context for downstream logging and tracing
    const context: RequestContext = {
      requestId: correlationId,
      userId: null,
      startTime: Date.now(),
    };

    await requestContextStorage.run(context, async () => {
      await this.handler.handle(job.data);
    });
  }
}
```

#### OpenTelemetry Integration

```typescript
// src/infrastructure/observability/tracing/TracingConfig.ts

import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export function initTracing(): NodeSDK {
  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'community-social-network',
      [ATTR_SERVICE_VERSION]: process.env.APP_VERSION || '0.0.0',
      'deployment.environment': process.env.NODE_ENV || 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new NestInstrumentation(),
      new PgInstrumentation({
        enhancedDatabaseReporting: true,
      }),
      new RedisInstrumentation(),
    ],
  });

  sdk.start();
  return sdk;
}
```

#### Span Creation Strategy

Spans are created automatically by OpenTelemetry instrumentation for HTTP, PostgreSQL, and Redis operations. Custom spans are created for the following application-level operations:

| Operation | Span Name | Attributes |
|-----------|----------|------------|
| HTTP request (auto) | `HTTP {METHOD} {PATH}` | method, path, status_code |
| Database query (auto) | `pg.query:{OPERATION}` | db.statement, db.name |
| Redis operation (auto) | `redis-{COMMAND}` | db.system, db.statement |
| Cache get/set | `cache.{get\|set\|delete}` | cache_prefix, hit (bool) |
| Domain event publish | `event.publish:{EVENT_TYPE}` | event_type, channel, aggregate_id |
| Queue job process | `queue.process:{EVENT_TYPE}` | event_type, queue_name, attempt |
| Socket.IO emit | `websocket.emit:{EVENT_TYPE}` | event_type, room, recipient_count |

```typescript
// src/infrastructure/observability/tracing/CustomSpans.ts

import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('community-social-network');

export async function traceOperation<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { kind: SpanKind.INTERNAL }, async (span) => {
    try {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

#### Trace Context Propagation Between Synchronous and Asynchronous Operations

```
+---------------------------------------------------------------------------+
|              Trace Context Across Sync and Async Boundaries               |
+---------------------------------------------------------------------------+

         Synchronous (same process)           Asynchronous (Bull Queue)
         ---------------------------          ---------------------------

Request -----> Controller -----> Service       Queue Consumer -----> Handler
  |               |                |                |                   |
  |  traceId=T1   |  traceId=T1   |                |  traceId=T2      |
  |  spanId=S1    |  spanId=S2    |                |  spanId=S4       |
  |               |  parent=S1    |                |                   |
  |               |                |                |                   |
  |               |                +---publish----->|                   |
  |               |                | correlationId  |  linked to T1    |
  |               |                | stored in job  |  via link attr   |
  |               |                |                |                   |
  v               v                v                v                   v

In synchronous flows, OpenTelemetry propagates trace context automatically
via Node.js AsyncLocalStorage. For asynchronous flows (Bull Queue), the
correlationId in the job data links the consumer trace to the original
request trace. OpenTelemetry span links are used to connect the two traces.
```

---

### 4. Health Check Endpoints

Health check endpoints enable container orchestrators (Docker, Kubernetes) and load balancers to determine application readiness and liveness.

#### Endpoint Specification

| Endpoint | Purpose | Checks Performed | Use Case |
|----------|---------|-------------------|----------|
| `GET /health/live` | Liveness probe | Process is running | Kubernetes liveness probe; restart if fails |
| `GET /health/ready` | Readiness probe | PostgreSQL, Redis, Bull Queue | Kubernetes readiness probe; remove from LB if fails |

#### Health Check Implementation

```typescript
// src/infrastructure/observability/health/HealthModule.ts

import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './HealthController';
import { PostgresHealthIndicator } from './PostgresHealthIndicator';
import { RedisHealthIndicator } from './RedisHealthIndicator';
import { BullQueueHealthIndicator } from './BullQueueHealthIndicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    PostgresHealthIndicator,
    RedisHealthIndicator,
    BullQueueHealthIndicator,
  ],
})
export class HealthModule {}
```

```typescript
// src/infrastructure/observability/health/HealthController.ts

import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { PostgresHealthIndicator } from './PostgresHealthIndicator';
import { RedisHealthIndicator } from './RedisHealthIndicator';
import { BullQueueHealthIndicator } from './BullQueueHealthIndicator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private postgres: PostgresHealthIndicator,
    private redis: RedisHealthIndicator,
    private queue: BullQueueHealthIndicator,
  ) {}

  /**
   * Liveness probe: returns 200 if the process is running.
   * No dependency checks. If this fails, the process is dead.
   */
  @Get('live')
  @HealthCheck()
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe: checks all critical dependencies.
   * Returns 200 (ok), 200 (degraded), or 503 (down).
   */
  @Get('ready')
  @HealthCheck()
  async readiness() {
    const checks = {
      postgres: await this.checkPostgres(),
      redis: await this.checkRedis(),
      queue: await this.checkQueue(),
    };

    const allOk = Object.values(checks).every(c => c === 'ok');
    const anyDown = checks.postgres === 'down'; // Postgres is critical

    let status: 'ok' | 'degraded' | 'down';
    if (allOk) {
      status = 'ok';
    } else if (anyDown) {
      status = 'down';
    } else {
      status = 'degraded';
    }

    const httpStatus = status === 'down' ? 503 : 200;

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
      httpStatus,
    };
  }

  private async checkPostgres(): Promise<'ok' | 'down'> {
    try {
      await this.postgres.pingCheck('postgres', { timeout: 3000 });
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<'ok' | 'down'> {
    try {
      await this.redis.pingCheck('redis', { timeout: 2000 });
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkQueue(): Promise<'ok' | 'down'> {
    try {
      await this.queue.isHealthy('queue');
      return 'ok';
    } catch {
      return 'down';
    }
  }
}
```

#### Response Format

Healthy response (`200 OK`):

```json
{
  "status": "ok",
  "timestamp": "2026-02-05T14:23:45.123Z",
  "checks": {
    "postgres": "ok",
    "redis": "ok",
    "queue": "ok"
  }
}
```

Degraded response (`200 OK` -- Redis or Queue down but Postgres operational):

```json
{
  "status": "degraded",
  "timestamp": "2026-02-05T14:23:45.123Z",
  "checks": {
    "postgres": "ok",
    "redis": "down",
    "queue": "ok"
  }
}
```

Down response (`503 Service Unavailable` -- Postgres down):

```json
{
  "status": "down",
  "timestamp": "2026-02-05T14:23:45.123Z",
  "checks": {
    "postgres": "down",
    "redis": "ok",
    "queue": "down"
  }
}
```

#### Health Status Logic

| PostgreSQL | Redis | Bull Queue | Overall Status | HTTP Code |
|-----------|-------|------------|----------------|-----------|
| ok | ok | ok | `ok` | 200 |
| ok | down | ok | `degraded` | 200 |
| ok | ok | down | `degraded` | 200 |
| ok | down | down | `degraded` | 200 |
| down | ok | ok | `down` | 503 |
| down | down | down | `down` | 503 |

**Rationale**: PostgreSQL is the only critical dependency. The application can operate in a degraded mode without Redis (cache misses hit the database directly) and without Bull Queue (events are queued in-memory temporarily). However, without PostgreSQL, no reads or writes can occur, making the service effectively down.

---

### 5. Alerting Thresholds

Alerting rules define the boundary between normal operation and conditions requiring investigation or intervention.

#### Alert Severity Levels

| Severity | Response Time | Notification Channel | Action Required |
|----------|--------------|---------------------|-----------------|
| `warning` | Within 1 business hour | Slack channel | Investigate root cause |
| `critical` | Within 15 minutes | PagerDuty (page on-call) | Immediate intervention |

#### Alert Threshold Table

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|-------------------|-------------------|--------|
| API p95 latency | > 500ms (5 min window) | > 1000ms (5 min window) | Scale up / investigate slow queries |
| Error rate (5xx) | > 1% of requests (5 min) | > 5% of requests (5 min) | Page on-call; check logs |
| Cache hit rate | < 85% (15 min window) | < 70% (15 min window) | Investigate cache config / TTLs |
| Queue depth (waiting) | > 100 jobs | > 500 jobs | Scale consumers / investigate slow handler |
| DLQ depth | > 10 events | > 50 events | Investigate handler bugs; replay or discard |
| DB connection pool usage | > 80% (16/20 active) | > 95% (19/20 active) | Scale pool / add read replicas |
| Memory usage (process RSS) | > 70% of limit | > 90% of limit | Scale up / investigate memory leak |
| WebSocket connections | > 800 (of 1000 target) | > 950 (of 1000 target) | Scale horizontally |
| Auth failure rate | > 10/min | > 50/min | Possible brute force; check lockout |
| DB query p95 latency | > 100ms | > 250ms | Check query plans; add indexes |
| Token reuse detections | > 1/hour | > 5/hour | Possible token theft; alert security |

#### Prometheus Alerting Rules

```yaml
# config/alerting/alert-rules.yml

groups:
  - name: csn_api_alerts
    rules:
      - alert: HighAPILatency
        expr: histogram_quantile(0.95, rate(csn_http_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API p95 latency exceeds 500ms"
          description: "p95 latency is {{ $value }}s over the last 5 minutes"

      - alert: CriticalAPILatency
        expr: histogram_quantile(0.95, rate(csn_http_request_duration_seconds_bucket[5m])) > 1.0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API p95 latency exceeds 1000ms"

      - alert: HighErrorRate
        expr: >
          sum(rate(csn_http_requests_total{status_code=~"5.."}[5m]))
          /
          sum(rate(csn_http_requests_total[5m]))
          > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "5xx error rate exceeds 1%"

      - alert: CriticalErrorRate
        expr: >
          sum(rate(csn_http_requests_total{status_code=~"5.."}[5m]))
          /
          sum(rate(csn_http_requests_total[5m]))
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "5xx error rate exceeds 5%"

  - name: csn_cache_alerts
    rules:
      - alert: LowCacheHitRate
        expr: csn_cache_hit_rate < 0.85
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Cache hit rate below 85% for {{ $labels.cache_prefix }}"

      - alert: CriticalCacheHitRate
        expr: csn_cache_hit_rate < 0.70
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: "Cache hit rate below 70% for {{ $labels.cache_prefix }}"

  - name: csn_queue_alerts
    rules:
      - alert: HighQueueDepth
        expr: csn_queue_depth{state="waiting"} > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Queue {{ $labels.queue_name }} has {{ $value }} waiting jobs"

      - alert: CriticalQueueDepth
        expr: csn_queue_depth{state="waiting"} > 500
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Queue {{ $labels.queue_name }} has {{ $value }} waiting jobs"

      - alert: DLQGrowing
        expr: csn_dlq_depth > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Dead letter queue has {{ $value }} events"

      - alert: CriticalDLQDepth
        expr: csn_dlq_depth > 50
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Dead letter queue has {{ $value }} events -- handler bug likely"

  - name: csn_db_alerts
    rules:
      - alert: HighDBPoolUsage
        expr: csn_db_connection_pool_active / 20 > 0.80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "DB connection pool usage at {{ $value | humanizePercentage }}"

      - alert: CriticalDBPoolUsage
        expr: csn_db_connection_pool_active / 20 > 0.95
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "DB connection pool near exhaustion"

  - name: csn_security_alerts
    rules:
      - alert: HighAuthFailureRate
        expr: rate(csn_auth_failures_total[5m]) * 60 > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Authentication failure rate exceeds 10/min"

      - alert: TokenReuseDetected
        expr: increase(csn_token_refresh_total{result="reuse_detected"}[1h]) > 1
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Token reuse detected -- possible session hijacking"
```

---

### 6. Dashboard Layout

Grafana dashboards organize metrics into actionable views for different operational concerns.

#### Dashboard Structure

```
+---------------------------------------------------------------------------+
|                        Grafana Dashboard Layout                           |
+---------------------------------------------------------------------------+

+-----------------------------------+
| Dashboard: CSN Overview           |
+-----------------------------------+
| +------+ +------+ +------+       |
| |Req/s | |Err%  | |p95   |       |  <-- Top row: key indicators
| | 245  | | 0.2% | |120ms |       |
| +------+ +------+ +------+       |
|                                   |
| +-------------------------------+ |
| | Request Rate (time series)    | |  <-- Requests per second over time
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Latency Distribution          | |  <-- p50, p95, p99 over time
| | (p50/p95/p99)                 | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Error Rate by Status Code     | |  <-- 4xx and 5xx breakdown
| +-------------------------------+ |
|                                   |
| +---------------+---------------+ |
| | Active WS     | Queue Depth   | |  <-- Real-time gauges
| | Connections    | (waiting)     | |
| +---------------+---------------+ |
+-----------------------------------+

+-----------------------------------+
| Dashboard: CSN Auth               |
+-----------------------------------+
| +------+ +------+ +------+       |
| |Login | |Login | |Lock- |       |
| |OK/min| |Fail/ | |outs  |       |
| |      | |min   | |      |       |
| +------+ +------+ +------+       |
|                                   |
| +-------------------------------+ |
| | Auth Success vs Failure       | |  <-- Time series comparison
| | (time series)                 | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Token Refresh Activity        | |  <-- success, expired, reuse
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Account Lockouts Over Time    | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Auth Failure Reasons          | |  <-- Pie chart breakdown
| | (by reason label)             | |
| +-------------------------------+ |
+-----------------------------------+

+-----------------------------------+
| Dashboard: CSN Content            |
+-----------------------------------+
| +------+ +------+ +------+       |
| |Posts/ | |Cmts/ | |React/|       |
| |hour  | |hour  | |hour  |       |
| +------+ +------+ +------+       |
|                                   |
| +-------------------------------+ |
| | Posts Created Over Time       | |  <-- By visibility label
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Comments Created Over Time    | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Reactions Over Time           | |  <-- By type label
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Social Graph Activity         | |  <-- follows, blocks
| +-------------------------------+ |
+-----------------------------------+

+-----------------------------------+
| Dashboard: CSN Infrastructure     |
+-----------------------------------+
| +------+ +------+ +------+       |
| |DB    | |Redis | |Queue |       |
| |Conns | |Memory| |Depth |       |
| +------+ +------+ +------+       |
|                                   |
| +-------------------------------+ |
| | DB Connection Pool            | |  <-- active, idle, waiting
| | (active / idle / waiting)     | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | DB Query Latency (p50/p95)    | |  <-- By operation type
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Cache Hit Rate by Prefix      | |  <-- Per-aggregate cache rate
| +-------------------------------+ |
|                                   |
| +---------------+---------------+ |
| | Queue Depth   | DLQ Depth     | |
| | (by state)    |               | |
| +---------------+---------------+ |
|                                   |
| +-------------------------------+ |
| | Queue Processing Latency     | |  <-- By event type
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | WebSocket Connections         | |  <-- Active connections gauge
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Process Memory (RSS/Heap)     | |  <-- Node.js default metrics
| +-------------------------------+ |
+-----------------------------------+
```

---

### NestJS Module Registration

```typescript
// src/infrastructure/observability/ObservabilityModule.ts

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { createLoggerConfig } from './logging/LoggerConfig';
import { CorrelationIdMiddleware } from './tracing/CorrelationIdMiddleware';
import { HttpMetricsInterceptor } from './metrics/HttpMetricsInterceptor';
import { MetricsModule } from './metrics/MetricsModule';
import { HealthModule } from './health/HealthModule';

@Module({
  imports: [
    LoggerModule.forRoot(createLoggerConfig(process.env.NODE_ENV || 'development')),
    MetricsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes('*');
  }
}
```

## Alternatives Considered

### Alternative 1: ELK Stack (Elasticsearch, Logstash, Kibana)

| Aspect | ELK Stack | Grafana Stack (Chosen) |
|--------|----------|----------------------|
| **Log aggregation** | Elasticsearch (powerful full-text search) | Loki (label-based, lower resource usage) |
| **Metrics** | Requires separate Metricbeat/Prometheus | Native Prometheus integration |
| **Tracing** | Elastic APM (proprietary agent) | OpenTelemetry (vendor-neutral) |
| **Resource cost** | HIGH (Elasticsearch requires significant RAM/disk) | MODERATE (Prometheus + Loki are lighter) |
| **Operational complexity** | HIGH (JVM tuning, shard management) | MODERATE (Prometheus is single-binary) |
| **Vendor lock-in** | MEDIUM (Elastic license changes) | LOW (all open-source, CNCF projects) |
| **NestJS integration** | Good (Elastic APM agent) | Good (prom-client, nestjs-pino, OTel SDK) |

**Decision**: Rejected ELK in favor of the Grafana stack (Prometheus + Loki + Tempo + Grafana) because:
1. Lower resource requirements suit a 1,000-concurrent-user scale
2. OpenTelemetry is vendor-neutral, allowing future backend changes
3. Prometheus is the de facto standard for Kubernetes-native monitoring
4. Grafana provides unified visualization for all three pillars

### Alternative 2: Commercial APM (Datadog, New Relic)

| Aspect | Commercial APM | Open-Source (Chosen) |
|--------|---------------|---------------------|
| **Setup effort** | LOW (agent installation) | MEDIUM (self-hosted infrastructure) |
| **Feature richness** | VERY HIGH (AI anomaly detection, etc.) | HIGH (covers all essential needs) |
| **Cost** | HIGH ($15-$30/host/month + per-metric pricing) | LOW (infrastructure cost only) |
| **Data ownership** | Vendor-hosted | Self-hosted |
| **Customization** | Limited to vendor features | Full control |

**Decision**: Rejected commercial APM because:
1. Cost scales with host count and metric volume; unsuitable for a project at this stage
2. Self-hosted gives full data ownership (relevant to GDPR considerations)
3. The open-source stack covers all requirements identified in this ADR
4. Migration to commercial APM remains possible via OpenTelemetry exporters

### Alternative 3: No Structured Observability (Status Quo)

**Decision**: Rejected. The QE Requirements Validation Report identifies this as a P0 (CRITICAL) gap. A system with ~40 domain events, 3-tier caching, asynchronous queue processing, and WebSocket delivery is undiagnosable without structured logging, metrics, and tracing.

## Consequences

### Positive

- **Production Debugging**: Correlation IDs enable end-to-end request tracing through HTTP handlers, domain events, queue consumers, and WebSocket emitters
- **SLA Monitoring**: Prometheus histograms provide p50/p95/p99 latency measurements to verify ADR-002 performance targets
- **Cache Verification**: Cache hit/miss counters verify the 85-90% hit rate target from ADR-005 and ADR-010
- **Queue Visibility**: Queue depth and DLQ monitoring prevent silent event processing failures (ADR-009)
- **Proactive Alerting**: Threshold-based alerts catch degradation before users are impacted
- **Health-Based Routing**: Health check endpoints enable load balancers and orchestrators to route traffic to healthy instances
- **Security Forensics**: Structured audit logs with correlation IDs support incident investigation
- **Vendor Neutrality**: OpenTelemetry allows switching tracing backends without application code changes

### Negative

- **Infrastructure Overhead**: Prometheus, Grafana, and (optionally) Loki/Tempo require additional deployment resources
- **Performance Cost**: Metric collection, log serialization, and span creation add latency (~1-3ms per request)
- **Operational Complexity**: Alerting rules require tuning to avoid alert fatigue (false positives)
- **Storage Growth**: Metrics retention and log storage grow with traffic volume
- **Learning Curve**: Team must learn Prometheus query language (PromQL) and Grafana dashboard building

### Mitigation

| Concern | Mitigation Strategy |
|---------|-------------------|
| Infrastructure overhead | Use lightweight components (Prometheus single-binary, Pino zero-overhead logging); scale observability infrastructure independently |
| Performance cost | Pino is benchmarked at ~5x faster than Winston; Prometheus collection adds < 1ms per request; OpenTelemetry sampling reduces trace volume in production |
| Alert fatigue | Start with conservative thresholds; review and tune weekly during first month; use `for` duration in alert rules to suppress transient spikes |
| Storage growth | Configure Prometheus retention (15 days default); use Loki retention policies; rotate log files daily with 7-day retention |
| Learning curve | Provide pre-built Grafana dashboards (documented above); include PromQL query examples in runbooks |

## Performance Impact Assessment

| Component | Impact | Measurement |
|-----------|--------|-------------|
| Pino JSON logging | < 0.5ms per log entry | Benchmarked: 30,000 log entries/second |
| Prometheus metrics | < 0.1ms per metric update | Counter increment is an atomic operation |
| OpenTelemetry spans | ~1ms per span (auto-instrumented) | Configurable sampling rate reduces production overhead |
| Correlation ID middleware | < 0.1ms per request | UUID generation + AsyncLocalStorage context |
| Health check endpoint | < 50ms per check | PostgreSQL ping + Redis ping + Queue check |
| **Total overhead per request** | **~1-3ms** | Well within p95 < 500ms SLA budget |

## References

- ADR-002: Modular Monolith Architecture -- Performance targets (p50/p95/p99)
- ADR-003: REST API Design -- Error response format, rate limiting, request ID
- ADR-005: SQL Database -- Cache hit rate target (85-90%), connection pool (20)
- ADR-007: Bounded Contexts -- 7 contexts requiring cross-context tracing
- ADR-009: Domain Events Strategy -- ~40 events, Bull Queue, Socket.IO, DLQ monitoring
- ADR-010: Repository Pattern -- 3-tier caching, cache TTLs per aggregate
- QE Requirements Validation Report -- P0 gap identification (R-01)
- Pino Logger -- https://github.com/pinojs/pino
- nestjs-pino -- https://github.com/iamolegga/nestjs-pino
- Prometheus Client for Node.js -- https://github.com/siimon/prom-client
- OpenTelemetry JavaScript SDK -- https://opentelemetry.io/docs/languages/js/
- NestJS Terminus (Health Checks) -- https://docs.nestjs.com/recipes/terminus
- Grafana -- https://grafana.com/
- Prometheus Alertmanager -- https://prometheus.io/docs/alerting/latest/alertmanager/

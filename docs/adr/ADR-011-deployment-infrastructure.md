# ADR-011: Deployment & Infrastructure

**Status**: Accepted
**Date**: 2026-02-05
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-002 (Modular Monolith), ADR-004 (JWT Auth), ADR-005 (PostgreSQL + Redis), ADR-009 (Domain Events / Bull Queue / Socket.IO)

## Context

The Community Social Network is a modular monolith (ADR-002) built on NestJS with PostgreSQL 15+ and Redis 7+ (ADR-005), Bull Queue for asynchronous event processing (ADR-009), and Socket.IO for real-time WebSocket notifications (ADR-009). The platform targets 10,000+ total users with 1,000 concurrent users (ADR-002).

The QE Requirements Validation Report identified deployment and infrastructure as a **P0 CRITICAL gap** -- the single most significant missing architectural decision. Specifically:

1. **No container strategy**: No Dockerfile, no Docker Compose, no orchestration defined
2. **No environment management**: No separation between development, staging, and production
3. **No secret management**: RSA keys (ADR-004), database credentials, and Redis credentials lack a storage strategy
4. **No CI/CD pipeline**: No build, test, or deployment automation
5. **No horizontal scaling configuration**: ADR-002 references "horizontal scaling with load balancer" but provides no implementation
6. **No health check specification**: ADR-002 mentions "health checks, auto-restart, multiple replicas" without details
7. **No database migration execution strategy**: ADR-005 defines schema but not how migrations run in production

Without this ADR, the system cannot be deployed to any environment beyond a developer's local machine.

### Key Constraints

- **Stateless application**: JWT-based auth (ADR-004) enables horizontal scaling without sticky sessions
- **Shared state in Redis**: Cache, Bull Queue, and Socket.IO adapter all depend on Redis 7+ (ADR-005, ADR-009)
- **Single database**: PostgreSQL 15+ with connection pooling (20 connections per instance, ADR-005)
- **Real-time WebSocket**: Socket.IO requires a Redis adapter for multi-instance support (ADR-009)
- **NX monorepo**: Build system uses NX affected commands for incremental builds (ADR-001)
- **TypeORM migrations**: Schema changes managed via TypeORM CLI (ADR-005)

## Decision

We adopt **Docker-based containerization** with Docker Compose for local development and a **production-ready Kubernetes configuration** for staging and production environments.

### Deployment Architecture

```
+---------------------------------------------------------------------------+
|                       Deployment Architecture                               |
+---------------------------------------------------------------------------+

+---------------------------------------------------------------------------+
|                           PRODUCTION (Kubernetes)                            |
|                                                                             |
|  +-------------------------------------------------------------------+    |
|  |                         Ingress Controller                          |    |
|  |                     (NGINX / Cloud Load Balancer)                   |    |
|  |                                                                     |    |
|  |  TLS termination, rate limiting, WebSocket upgrade support          |    |
|  +-----------------------------+---------------------------------------+    |
|                                |                                            |
|                                v                                            |
|  +-------------------------------------------------------------------+    |
|  |                         Kubernetes Service                          |    |
|  |                  (ClusterIP, headless for WS)                       |    |
|  +-----------------------------+---------------------------------------+    |
|                                |                                            |
|             +------------------+------------------+                         |
|             |                  |                  |                          |
|             v                  v                  v                          |
|  +------------------+ +------------------+ +------------------+            |
|  |   API Pod (1)    | |   API Pod (2)    | |   API Pod (N)    |            |
|  |                  | |                  | |                  |            |
|  |  NestJS App      | |  NestJS App      | |  NestJS App      |            |
|  |  Port 3000       | |  Port 3000       | |  Port 3000       |            |
|  |                  | |                  | |                  |            |
|  |  /health/live    | |  /health/live    | |  /health/live    |            |
|  |  /health/ready   | |  /health/ready   | |  /health/ready   |            |
|  +------------------+ +------------------+ +------------------+            |
|             |                  |                  |                          |
|             +------------------+------------------+                         |
|                                |                                            |
|             +------------------+------------------+                         |
|             |                                     |                         |
|             v                                     v                         |
|  +------------------------+          +------------------------+            |
|  |      PostgreSQL 15+    |          |       Redis 7+         |            |
|  |                        |          |                        |            |
|  |  - Primary database    |          |  - Cache layer         |            |
|  |  - Connection pool     |          |  - Bull Queue broker   |            |
|  |    (20 per pod)        |          |  - Socket.IO adapter   |            |
|  |  - PgBouncer (opt.)    |          |  - Token blacklist     |            |
|  +------------------------+          +------------------------+            |
|                                                                             |
+---------------------------------------------------------------------------+

+---------------------------------------------------------------------------+
|                         DEVELOPMENT (Docker Compose)                        |
|                                                                             |
|  +---------------+ +---------------+ +---------------+ +---------------+  |
|  |   api         | |   postgres    | |   redis       | |   pgadmin     |  |
|  |               | |               | |               | |               |  |
|  |  NestJS       | |  PostgreSQL   | |  Redis 7      | |  pgAdmin 4    |  |
|  |  Port 3000    | |  Port 5432    | |  Port 6379    | |  Port 5050    |  |
|  |  Hot reload   | |  Volume mount | |  No password  | |  Web UI       |  |
|  +---------------+ +---------------+ +---------------+ +---------------+  |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

### 1. Container Strategy

#### Multi-Stage Dockerfile

```dockerfile
# Dockerfile

# ============================================================
# Stage 1: Build
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npx nx build api --configuration=production

# Prune devDependencies
RUN npm prune --production

# ============================================================
# Stage 2: Production
# ============================================================
FROM node:20-alpine AS production

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/dist/apps/api ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1

# Run as non-root
USER appuser

# Start application
CMD ["node", "dist/main.js"]
```

#### Docker Compose for Local Development

```yaml
# docker-compose.yml

version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    command: npx nx serve api
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://csn:csn_dev_password@postgres:5432/csn_dev
      - REDIS_URL=redis://redis:6379
      - JWT_PRIVATE_KEY=${JWT_PRIVATE_KEY}
      - JWT_PUBLIC_KEY=${JWT_PUBLIC_KEY}
      - COOKIE_DOMAIN=localhost
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: csn
      POSTGRES_PASSWORD: csn_dev_password
      POSTGRES_DB: csn_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U csn -d csn_dev']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  pgadmin:
    image: dpage/pgadmin4:latest
    ports:
      - '5050:80'
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@csn.local
      PGADMIN_DEFAULT_PASSWORD: admin
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

#### Container Resource Limits

| Container | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-----------|------------|-----------|----------------|--------------|
| API pod | 250m | 500m | 256Mi | 512Mi |
| PostgreSQL | 500m | 1000m | 512Mi | 1Gi |
| Redis | 100m | 250m | 128Mi | 256Mi |

---

### 2. Environment Management

#### Three Environments

| Property | Development | Staging | Production |
|----------|------------|---------|------------|
| **Purpose** | Local development | Pre-production validation | Live traffic |
| **Infrastructure** | Docker Compose | Kubernetes (single replica) | Kubernetes (2-6 replicas) |
| **Database** | Local PostgreSQL container | Managed PostgreSQL (small) | Managed PostgreSQL (HA) |
| **Redis** | Local Redis container | Managed Redis (small) | Managed Redis (cluster) |
| **TLS** | None (HTTP) | Self-signed or Let's Encrypt | Production certificate |
| **Logging** | Console (stdout) | Structured JSON | Structured JSON + aggregation |
| **Debug** | Source maps enabled | Source maps enabled | Source maps disabled |
| **Seed data** | Dev fixtures loaded | Staging fixtures loaded | No seed data |

#### Environment Variable Validation

All required environment variables are validated at application startup using `joi`. The application fails fast with a descriptive error message if any required variable is missing or invalid.

```typescript
// src/infrastructure/config/env.validation.ts

import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production')
    .required(),
  PORT: Joi.number().default(3000),

  // Database (ADR-005)
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required()
    .description('PostgreSQL connection string'),

  // Redis (ADR-005, ADR-009)
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required()
    .description('Redis connection string'),

  // Authentication (ADR-004)
  JWT_PRIVATE_KEY: Joi.string()
    .required()
    .description('Base64-encoded RSA private key for JWT signing'),
  JWT_PUBLIC_KEY: Joi.string()
    .required()
    .description('Base64-encoded RSA public key for JWT verification'),
  COOKIE_DOMAIN: Joi.string()
    .required()
    .description('Domain for refresh token cookie'),

  // Optional
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
  CORS_ORIGIN: Joi.string().default('http://localhost:4200'),
  BULL_QUEUE_PREFIX: Joi.string().default('csn'),
}).options({ abortEarly: false });
```

```typescript
// src/main.ts (startup validation)

import { envValidationSchema } from './infrastructure/config/env.validation';

async function bootstrap() {
  const { error, value: envVars } = envValidationSchema.validate(process.env);
  if (error) {
    const missing = error.details.map(d => d.message).join('\n  - ');
    console.error(`Environment validation failed:\n  - ${missing}`);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);
  // ... application setup
}
```

#### Required Environment Variables

| Variable | Required | Example (Development) | Example (Production) |
|----------|----------|----------------------|---------------------|
| `NODE_ENV` | Yes | `development` | `production` |
| `PORT` | No (default: 3000) | `3000` | `3000` |
| `DATABASE_URL` | Yes | `postgresql://csn:csn_dev_password@localhost:5432/csn_dev` | `postgresql://csn:***@db.internal:5432/csn_prod` |
| `REDIS_URL` | Yes | `redis://localhost:6379` | `rediss://***@redis.internal:6380` |
| `JWT_PRIVATE_KEY` | Yes | `base64(dev-private.pem)` | `base64(prod-private.pem)` (from secret manager) |
| `JWT_PUBLIC_KEY` | Yes | `base64(dev-public.pem)` | `base64(prod-public.pem)` (from secret manager) |
| `COOKIE_DOMAIN` | Yes | `localhost` | `.community-social.example.com` |
| `LOG_LEVEL` | No (default: info) | `debug` | `info` |
| `CORS_ORIGIN` | No (default: localhost:4200) | `http://localhost:4200` | `https://community-social.example.com` |
| `BULL_QUEUE_PREFIX` | No (default: csn) | `csn` | `csn-prod` |

---

### 3. Secret Management

#### Strategy by Environment

| Environment | Secret Storage | Access Method |
|-------------|---------------|---------------|
| Development | `.env` file (git-ignored) | `dotenv` / Docker Compose `env_file` |
| Staging | Cloud Secret Manager | Kubernetes `ExternalSecret` or init container |
| Production | Cloud Secret Manager (AWS Secrets Manager / HashiCorp Vault) | Kubernetes `ExternalSecret` or CSI driver |

#### RSA Key Storage

RSA keys for JWT signing (ADR-004) are stored as **base64-encoded environment variables** to avoid multiline string issues in shell environments and container runtimes.

```bash
# Generate keys (one-time, in secure offline environment)
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Encode for environment variable
export JWT_PRIVATE_KEY=$(base64 -w 0 private.pem)
export JWT_PUBLIC_KEY=$(base64 -w 0 public.pem)
```

```typescript
// src/infrastructure/config/jwt-key.loader.ts

export function loadJwtKeys(): { privateKey: string; publicKey: string } {
  const privateKeyBase64 = process.env.JWT_PRIVATE_KEY;
  const publicKeyBase64 = process.env.JWT_PUBLIC_KEY;

  if (!privateKeyBase64 || !publicKeyBase64) {
    throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set');
  }

  return {
    privateKey: Buffer.from(privateKeyBase64, 'base64').toString('utf-8'),
    publicKey: Buffer.from(publicKeyBase64, 'base64').toString('utf-8'),
  };
}
```

#### Secret Management Rules

1. **No secrets in source code**: `.env` files are git-ignored; secrets never appear in commits
2. **No secrets in Docker images**: Multi-stage build copies only production artifacts; environment variables injected at runtime
3. **No secrets in logs**: Startup validation logs variable names, never values
4. **Production rotation**: RSA keys rotated via the dual-key overlap procedure defined in ADR-004, Section 5
5. **Access audit**: Cloud secret manager provides access logging for compliance

#### Kubernetes Secret Configuration (Production)

```yaml
# k8s/base/external-secret.yaml (ExternalSecrets Operator)

apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: csn-api-secrets
  namespace: csn
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: csn-api-secrets
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: csn/production/database-url
    - secretKey: REDIS_URL
      remoteRef:
        key: csn/production/redis-url
    - secretKey: JWT_PRIVATE_KEY
      remoteRef:
        key: csn/production/jwt-private-key
    - secretKey: JWT_PUBLIC_KEY
      remoteRef:
        key: csn/production/jwt-public-key
```

---

### 4. CI/CD Pipeline

#### Pipeline Architecture

```
+---------------------------------------------------------------------------+
|                          CI/CD Pipeline (GitHub Actions)                     |
+---------------------------------------------------------------------------+

  push / PR                                                     merge to main
     |                                                               |
     v                                                               v
+--------------------+   +--------------------+   +--------------------+
|      LINT          |   |       TEST         |   |      BUILD         |
|                    |   |                    |   |                    |
| nx affected:lint   |-->| nx affected:test   |-->| docker build       |
| eslint + prettier  |   | jest --coverage    |   | multi-stage        |
| type-check         |   | coverage >= 80%    |   | tag: sha + latest  |
+--------------------+   +--------------------+   +--------------------+
                                                          |
                                   +----------------------+
                                   |
                                   v
                          +--------------------+
                          |     DEPLOY         |
                          |                    |
                          | push to registry   |
                          | run migrations     |
                          | rolling update     |
                          | smoke test         |
                          +--------------------+
```

#### GitHub Actions Workflow

```yaml
# .github/workflows/ci-cd.yml

name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/api

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - uses: nrwl/nx-set-shas@v4
      - run: npx nx affected --target=lint --parallel=3
      - run: npx nx affected --target=typecheck --parallel=3

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: csn
          POSTGRES_PASSWORD: test
          POSTGRES_DB: csn_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - uses: nrwl/nx-set-shas@v4
      - run: npx nx affected --target=test --parallel=3 --coverage
        env:
          DATABASE_URL: postgresql://csn:test@localhost:5432/csn_test
          REDIS_URL: redis://localhost:6379
      - name: Check coverage threshold
        run: |
          npx nx affected --target=test --parallel=3 --coverageThreshold='{"global":{"branches":80,"functions":80,"lines":80,"statements":80}}'

  build:
    needs: [lint, test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: [build]
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Run database migrations
        run: |
          npx typeorm migration:run -d src/infrastructure/config/typeorm.config.ts
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
      - name: Deploy to staging
        run: |
          kubectl set image deployment/csn-api \
            csn-api=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace csn-staging
          kubectl rollout status deployment/csn-api \
            --namespace csn-staging --timeout=120s
      - name: Smoke test
        run: |
          curl --fail --retry 5 --retry-delay 10 \
            https://staging.community-social.example.com/health/ready

  deploy-production:
    needs: [deploy-staging]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Run database migrations
        run: |
          npx typeorm migration:run -d src/infrastructure/config/typeorm.config.ts
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
      - name: Deploy to production (rolling update)
        run: |
          kubectl set image deployment/csn-api \
            csn-api=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace csn-production
          kubectl rollout status deployment/csn-api \
            --namespace csn-production --timeout=180s
      - name: Smoke test
        run: |
          curl --fail --retry 5 --retry-delay 10 \
            https://community-social.example.com/health/ready
```

#### NX Affected Commands

NX affected commands ensure only modified projects are built, tested, and linted:

| Command | Purpose | Triggered By |
|---------|---------|-------------|
| `npx nx affected --target=lint` | Lint only changed projects | PR, push |
| `npx nx affected --target=test` | Test only changed projects | PR, push |
| `npx nx affected --target=build` | Build only changed projects | push to main |
| `npx nx affected --target=typecheck` | Type-check only changed projects | PR, push |

---

### 5. Horizontal Scaling

#### Scaling Strategy

The modular monolith is designed for horizontal scaling because:

1. **Stateless application**: JWT-based authentication (ADR-004) requires no server-side session state; any replica can handle any request
2. **Shared Redis**: Cache (ADR-005), Bull Queue (ADR-009), Socket.IO adapter (ADR-009), and token blacklist (ADR-004) all use Redis as the shared coordination layer
3. **Connection pooling**: Each pod maintains its own PostgreSQL connection pool of 20 connections (ADR-005)

```
+---------------------------------------------------------------------------+
|                        Horizontal Scaling Architecture                       |
+---------------------------------------------------------------------------+

                          +--------------------+
                          |   Load Balancer    |
                          |   (L7 / Ingress)   |
                          +---------+----------+
                                    |
               +--------------------+--------------------+
               |                    |                    |
               v                    v                    v
     +------------------+ +------------------+ +------------------+
     |   API Pod (1)    | |   API Pod (2)    | |   API Pod (N)    |
     |                  | |                  | |                  |
     |  NestJS App      | |  NestJS App      | |  NestJS App      |
     |  Bull Workers    | |  Bull Workers    | |  Bull Workers    |
     |  Socket.IO       | |  Socket.IO       | |  Socket.IO       |
     |                  | |                  | |                  |
     |  Pool: 20 conns  | |  Pool: 20 conns  | |  Pool: 20 conns  |
     +--------+---------+ +--------+---------+ +--------+---------+
              |                    |                    |
              +--------------------+--------------------+
              |                                         |
              v                                         v
     +------------------+                    +------------------+
     |  PostgreSQL 15+  |                    |    Redis 7+      |
     |                  |                    |                  |
     |  Max connections:|                    |  Shared state:   |
     |  100 (PgBouncer) |                    |  - Cache         |
     |                  |                    |  - Bull Queue    |
     |                  |                    |  - Socket.IO     |
     |                  |                    |    adapter       |
     |                  |                    |  - Token         |
     |                  |                    |    blacklist     |
     +------------------+                    +------------------+
```

#### Kubernetes Horizontal Pod Autoscaler (HPA)

```yaml
# k8s/production/hpa.yaml

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: csn-api-hpa
  namespace: csn-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: csn-api
  minReplicas: 2
  maxReplicas: 6
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
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

#### Scaling Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Min replicas | 2 | High availability; survive single pod failure |
| Max replicas | 6 | 1,000 concurrent users / ~200 per pod with headroom |
| CPU scale-up trigger | > 70% average | Scale before saturation (80%+ causes latency spikes) |
| Memory scale-up trigger | > 80% average | Memory pressure indicates need for more pods |
| Scale-up window | 60 seconds | React to load within 1 minute |
| Scale-down window | 300 seconds | Avoid thrashing on transient load drops |
| Max scale-up rate | 1 pod per 60s | Gradual scale-up to avoid connection storms |
| Max scale-down rate | 1 pod per 120s | Gentle scale-down preserves WebSocket connections |

#### Socket.IO Redis Adapter

Socket.IO requires a Redis adapter so that WebSocket events are broadcast across all pod instances. Without this, a notification emitted from Pod 1 would not reach clients connected to Pod 2.

```typescript
// src/infrastructure/websocket/socket-io.adapter.ts

import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisSocketIOAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: any): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: process.env.CORS_ORIGIN,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    server.adapter(this.adapterConstructor);
    return server;
  }
}
```

#### Connection Budget

With 6 maximum API pods and 20 connections per pod:

| Component | Connections per Pod | Max Pods | Total Max | PostgreSQL Limit |
|-----------|-------------------|----------|-----------|-----------------|
| TypeORM pool | 20 | 6 | 120 | 100 (PgBouncer) |

**Important**: At max scale (6 pods), the total connection demand (120) exceeds a typical PostgreSQL `max_connections` default (100). PgBouncer in transaction mode is required in production to multiplex connections.

```
# PgBouncer configuration (production)
[pgbouncer]
pool_mode = transaction
max_client_conn = 200
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
```

---

### 6. Health Checks

#### Endpoints

| Endpoint | Type | Purpose | Checks |
|----------|------|---------|--------|
| `/health/live` | Liveness | Is the process running? | App responds to HTTP |
| `/health/ready` | Readiness | Can the app serve traffic? | PostgreSQL connected, Redis connected |

#### Implementation

```typescript
// src/infrastructure/health/health.controller.ts

import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  /**
   * Liveness probe: Is the application process alive?
   * Should return 200 if the NestJS process is running.
   * Kubernetes uses this to decide whether to restart the pod.
   */
  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  /**
   * Readiness probe: Can the application serve traffic?
   * Checks that PostgreSQL and Redis are reachable.
   * Kubernetes uses this to decide whether to route traffic to the pod.
   */
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1500 }),
      () => this.redis.pingCheck('redis', { timeout: 1500 }),
    ]);
  }
}
```

#### Health Check Response Format

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

#### Kubernetes Probe Configuration

```yaml
# k8s/base/deployment.yaml (probe section)

spec:
  containers:
    - name: csn-api
      image: ghcr.io/community-social-network/api:latest
      ports:
        - containerPort: 3000
      resources:
        requests:
          cpu: 250m
          memory: 256Mi
        limits:
          cpu: 500m
          memory: 512Mi
      env:
        - name: NODE_ENV
          value: production
      envFrom:
        - secretRef:
            name: csn-api-secrets
      livenessProbe:
        httpGet:
          path: /health/live
          port: 3000
        initialDelaySeconds: 15
        periodSeconds: 15
        timeoutSeconds: 5
        failureThreshold: 3
        successThreshold: 1
      readinessProbe:
        httpGet:
          path: /health/ready
          port: 3000
        initialDelaySeconds: 10
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 3
        successThreshold: 1
      startupProbe:
        httpGet:
          path: /health/live
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 5
        failureThreshold: 6
```

#### Probe Timing Rationale

| Probe | Setting | Value | Rationale |
|-------|---------|-------|-----------|
| Startup | `initialDelaySeconds` | 5 | Give app 5s before first check |
| Startup | `failureThreshold` | 6 | Allow up to 30s total startup (5 + 6*5) |
| Liveness | `initialDelaySeconds` | 15 | After startup probe passes |
| Liveness | `periodSeconds` | 15 | Check every 15s; balance between detection speed and overhead |
| Liveness | `failureThreshold` | 3 | Restart after 45s of failure (3 * 15) |
| Readiness | `initialDelaySeconds` | 10 | After startup probe passes |
| Readiness | `periodSeconds` | 10 | Check every 10s; traffic routing is more latency-sensitive |
| Readiness | `failureThreshold` | 3 | Remove from service after 30s of failure (3 * 10) |

---

### 7. Database Migrations

#### Migration Execution Strategy

Database migrations run as a **Kubernetes init container** (or pre-deploy job) before the application pods start. This ensures the database schema is updated before any application code that depends on the new schema begins serving traffic.

```
+---------------------------------------------------------------------------+
|                       Migration Execution Flow                              |
+---------------------------------------------------------------------------+

  Deploy triggered
       |
       v
  +--------------------+
  |  Init Container:   |     Runs BEFORE application container starts
  |  migration-runner  |
  |                    |
  |  npx typeorm       |
  |  migration:run     |
  +--------+-----------+
           |
           | Success?
           |
     +-----+-----+
     |           |
    YES          NO
     |           |
     v           v
  +----------+ +----------+
  |  Start   | |  Pod     |
  |  API     | |  fails   |
  |  container| |  (CrashLoopBackOff)
  +----------+ +----------+
```

#### Kubernetes Init Container Configuration

```yaml
# k8s/base/deployment.yaml (initContainers section)

spec:
  initContainers:
    - name: migration-runner
      image: ghcr.io/community-social-network/api:latest
      command: ['npx', 'typeorm', 'migration:run', '-d', 'dist/infrastructure/config/typeorm.config.js']
      envFrom:
        - secretRef:
            name: csn-api-secrets
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 250m
          memory: 256Mi
```

#### Migration Rules

1. **All migrations must be reversible**: Every migration must implement both `up()` and `down()` methods
2. **Backward-compatible changes only**: Migrations must not break the currently running application version
3. **No data-destructive operations in migrations**: Column drops or table drops require a two-phase approach
4. **Naming convention**: `YYYYMMDDHHMMSS-DescriptiveName.ts` (e.g., `20260205120000-AddGroupMemberIndex.ts`)

#### Two-Phase Migration for Breaking Changes

Breaking schema changes (column renames, column drops, type changes) use a two-phase deployment to maintain backward compatibility:

| Phase | Deployment N | Deployment N+1 |
|-------|-------------|----------------|
| Step 1 | Add new column (nullable) | Remove old column |
| Step 2 | Deploy code that writes to both columns | Deploy code that reads only new column |
| Step 3 | Backfill new column from old column | Drop old column migration |

```typescript
// Example: Renaming user_profiles.display_name to user_profiles.full_name
//
// Phase 1 migration (deploy N):
export class AddFullNameColumn1706000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('user_profiles', new TableColumn({
      name: 'full_name',
      type: 'varchar',
      length: '100',
      isNullable: true,
    }));
    // Backfill
    await queryRunner.query(
      `UPDATE user_profiles SET full_name = display_name WHERE full_name IS NULL`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('user_profiles', 'full_name');
  }
}

// Phase 2 migration (deploy N+1, after all pods run code using full_name):
export class DropDisplayNameColumn1706100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('user_profiles', 'display_name');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('user_profiles', new TableColumn({
      name: 'display_name',
      type: 'varchar',
      length: '100',
      isNullable: true,
    }));
  }
}
```

---

### 8. Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Application startup time | < 30 seconds | Startup probe: `initialDelaySeconds` 5 + `failureThreshold` 6 * `periodSeconds` 5 = 35s max |
| Liveness probe response | < 100ms | `timeoutSeconds: 5` (generous); expect < 100ms |
| Readiness probe response | < 100ms | DB ping + Redis ping; expect < 100ms combined |
| Docker image size | < 200 MB | Multi-stage build, Alpine base, production-only dependencies |
| Rolling update (zero-downtime) | < 120 seconds | `maxSurge: 1`, `maxUnavailable: 0`, readiness gate |
| Time to first request (cold start) | < 30 seconds | NestJS initialization + TypeORM connection + Redis connection |
| Scale-up reaction time | < 120 seconds | HPA polling (15s) + stabilization (60s) + pod startup (30s) |

#### Kubernetes Deployment Strategy

```yaml
# k8s/base/deployment.yaml (strategy section)

spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

The `maxUnavailable: 0` setting ensures zero-downtime deployments: at least 2 pods are always serving traffic during a rolling update.

---

## Alternatives Considered

### Option A: Bare Metal / VM Deployment (Rejected)

**Implementation**: Deploy the NestJS application directly on virtual machines using PM2 or systemd.

**Pros**:
- Simplest initial setup
- No container runtime overhead
- Direct filesystem access

**Cons**:
- **No environment parity**: "Works on my machine" problems between dev and production
- **Manual scaling**: No auto-scaling; manual provisioning of new VMs
- **Snowflake servers**: Configuration drift between instances
- **Slow deployments**: No immutable artifacts; deployment involves SSH and scripts
- **No rollback**: No built-in rollback mechanism

**Why Rejected**: Inconsistent environments and manual operations do not meet the reliability requirements for 1,000 concurrent users. Container-based deployment provides reproducible builds and environments.

### Option B: AWS ECS / Fargate (Considered)

**Implementation**: Deploy Docker containers on AWS ECS with Fargate serverless compute.

**Pros**:
- Simpler than Kubernetes
- No cluster management overhead
- Native AWS integration (RDS, ElastiCache, Secrets Manager)
- Auto-scaling built in

**Cons**:
- **Vendor lock-in**: Tightly coupled to AWS
- **Less portable**: Cannot run locally with full fidelity
- **Limited ecosystem**: Fewer tools compared to Kubernetes
- **Cost**: Fargate pricing higher than self-managed containers at scale

**Why Not Selected as Primary**: Kubernetes was chosen for portability and ecosystem breadth. However, ECS/Fargate is a valid alternative if the team is AWS-focused. The Docker containerization layer is the same regardless.

### Option C: Platform-as-a-Service (Railway, Render, Fly.io) (Rejected)

**Implementation**: Deploy to a managed PaaS platform.

**Pros**:
- Zero infrastructure management
- Built-in CI/CD
- Automatic TLS
- Quick initial setup

**Cons**:
- **Limited control**: Cannot tune connection pools, resource limits, or networking
- **Cost at scale**: PaaS pricing becomes expensive at 1,000 concurrent users
- **WebSocket limitations**: Some platforms have WebSocket connection limits or timeouts
- **No multi-region**: Limited geographic distribution options
- **Vendor lock-in**: Platform-specific configuration

**Why Rejected**: WebSocket support limitations and lack of fine-grained control over scaling parameters make PaaS unsuitable for the real-time notification requirements (ADR-009) at target scale.

---

## Consequences

### Positive

- **Environment parity**: Docker ensures development, staging, and production run identical software stacks
- **Reproducible builds**: Multi-stage Dockerfile produces the same image from the same commit every time
- **Horizontal scaling**: Kubernetes HPA auto-scales from 2 to 6 pods based on load
- **Zero-downtime deployments**: Rolling updates with readiness probes ensure no dropped requests
- **Fast feedback**: NX affected commands reduce CI time by only building/testing changed code
- **Secret security**: Production secrets managed by cloud secret manager with audit logging
- **Database safety**: Init container migrations with reversibility requirements protect against schema errors

### Negative

- **Kubernetes complexity**: Kubernetes has a steep learning curve for a small team (2-5 developers)
- **Infrastructure cost**: Running a Kubernetes cluster (even managed) costs more than a single VM
- **Connection pool pressure**: 6 pods x 20 connections = 120 connections requires PgBouncer
- **Redis single point of failure**: All horizontal scaling coordination depends on Redis availability
- **Migration bottleneck**: Init container migrations block deployment; long migrations increase deployment time

### Mitigation

| Risk | Mitigation |
|------|------------|
| Kubernetes complexity | Use managed Kubernetes (EKS/GKE/AKS); Docker Compose for local dev |
| Infrastructure cost | Start with 2 replicas; HPA scales only when needed; use spot instances for non-production |
| Connection pool pressure | Deploy PgBouncer as sidecar or standalone; monitor connection utilization |
| Redis SPOF | Use managed Redis with replication (ElastiCache/Memorystore); fallback to degraded mode (no cache, no real-time) |
| Migration bottleneck | Keep migrations small and fast (< 30s); avoid data backfills in migration; use background jobs for large data operations |
| Docker image bloat | Multi-stage build; Alpine base; `.dockerignore` excludes test files, docs, and dev configs |

---

## References

- ADR-002: Modular Monolith Architecture - Horizontal scaling and health check requirements
- ADR-004: JWT Authentication - Stateless auth enabling horizontal scaling; RSA key management
- ADR-005: PostgreSQL + Redis - Connection pooling, database schema, caching infrastructure
- ADR-009: Domain Events Strategy - Bull Queue (Redis), Socket.IO (Redis adapter)
- ADR-010: Repository Pattern - Connection pool configuration (20 per instance)
- Docker Multi-Stage Builds: https://docs.docker.com/build/building/multi-stage/
- Kubernetes HPA: https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/
- NestJS Terminus Health Checks: https://docs.nestjs.com/recipes/terminus
- Socket.IO Redis Adapter: https://socket.io/docs/v4/redis-adapter/
- TypeORM Migrations: https://typeorm.io/migrations
- ExternalSecrets Operator: https://external-secrets.io/
- QE Requirements Validation Report: `docs/adr/ADR-REQUIREMENTS-VALIDATION-REPORT.md`

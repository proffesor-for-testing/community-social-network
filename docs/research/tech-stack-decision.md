# Tech Stack Decision Matrix - Community Social Network MVP

## Final Recommendations

Based on comprehensive research for the Serbian Agentics Foundation & StartIT community social network:

---

## ✅ RECOMMENDED STACK

### Backend
```yaml
Runtime: Node.js 20 LTS
Framework: Express.js 4.x
Language: TypeScript 5.x
ORM: Prisma (or raw SQL with pg)

Rationale:
  - Excellent real-time capabilities (critical for social feeds)
  - Large ecosystem for social features
  - Same language as frontend (developer efficiency)
  - Strong TypeScript support
  - Proven at scale (Instagram, LinkedIn use Node.js)
  - Fast development cycle
```

### Database
```yaml
Primary: PostgreSQL 15+
Cache: Redis 7+

Rationale:
  - ACID compliance for user data integrity
  - Excellent support for complex relationships (social graph)
  - JSON/JSONB support for flexible fields
  - Full-text search built-in (MVP needs)
  - Proven at massive scale (Instagram, Reddit)
  - Open source, cost-effective
  - Better than MySQL for recursive queries (social connections)
  - Better than MongoDB for relational data
```

### Frontend
```yaml
Framework: React 18 + TypeScript
Build Tool: Vite 5
UI Library: Tailwind CSS + shadcn/ui
State Management: React Query + Context
Routing: React Router v6

Rationale:
  - Largest talent pool in Serbia
  - Rich ecosystem for social features
  - Excellent developer experience
  - Mobile path via React Native
  - Component reusability
  - Strong TypeScript support
  - Fast build times (Vite)
```

### DevOps
```yaml
MVP Hosting: Railway.app (easiest, $20-30/month)
Alternative: DigitalOcean App Platform ($35/month)
CI/CD: GitHub Actions
Monitoring: Sentry + UptimeRobot
Containers: Docker + Docker Compose

Rationale:
  - Minimal DevOps overhead for MVP
  - Built-in CI/CD
  - Easy scaling path
  - Free SSL certificates
  - Managed database included
  - Cost-effective for early stage
```

---

## 🎯 Architecture Decision Records (ADRs)

### ADR-001: Node.js vs Python

**Decision**: Node.js + Express

**Context**: Need to build real-time social network with feed updates, notifications

**Options Considered**:
1. Node.js + Express
2. Python + FastAPI
3. Ruby on Rails

**Decision Factors**:
| Factor | Node.js | Python | Ruby |
|--------|---------|--------|------|
| Real-time support | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Development speed | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Ecosystem | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Community size | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Scalability | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Job market | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |

**Consequence**:
- ✅ Native WebSocket support
- ✅ Single language across stack (JS/TS)
- ✅ Fast development for real-time features
- ❌ Less ideal for ML/AI (can add Python microservice later)

---

### ADR-002: PostgreSQL vs MongoDB

**Decision**: PostgreSQL

**Context**: Need to store users, groups, posts, relationships (social graph)

**Options Considered**:
1. PostgreSQL
2. MySQL
3. MongoDB

**Decision Factors**:
| Factor | PostgreSQL | MySQL | MongoDB |
|--------|-----------|-------|---------|
| Relationships | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Data integrity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| JSON support | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Full-text search | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Social graph | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Scalability | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Cost | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Consequence**:
- ✅ Excellent for complex joins (social graph queries)
- ✅ ACID compliance (data consistency)
- ✅ Recursive queries for connections
- ✅ JSON support for flexible fields
- ❌ Requires more careful query optimization
- ❌ Vertical scaling more complex than MongoDB

---

### ADR-003: React vs Vue vs Svelte

**Decision**: React

**Context**: Need modern, performant frontend with good ecosystem

**Options Considered**:
1. React
2. Vue.js
3. Svelte

**Decision Factors**:
| Factor | React | Vue | Svelte |
|--------|-------|-----|--------|
| Ecosystem | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Job market | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Mobile path | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Learning curve | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Performance | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| TypeScript | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Consequence**:
- ✅ Largest talent pool in Serbia
- ✅ React Native for mobile (future)
- ✅ Huge ecosystem (UI libraries, tools)
- ✅ Strong community support
- ❌ Slightly steeper learning curve than Vue
- ❌ More boilerplate than Svelte

---

### ADR-004: REST vs GraphQL

**Decision**: REST (MVP), GraphQL (Post-MVP consideration)

**Context**: Need API design pattern for MVP

**Options Considered**:
1. RESTful API
2. GraphQL
3. tRPC

**Decision Factors**:
| Factor | REST | GraphQL | tRPC |
|--------|------|---------|------|
| Simplicity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Development speed | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Flexibility | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Caching | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Tooling | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Learning curve | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

**Consequence**:
- ✅ Faster MVP development
- ✅ Simpler to understand and debug
- ✅ Better HTTP caching
- ✅ Standard tooling (Postman, Swagger)
- ❌ Over-fetching/under-fetching data
- ❌ Multiple requests for complex views
- 🔄 Can migrate to GraphQL post-MVP if needed

---

### ADR-005: Prisma vs Raw SQL

**Decision**: Start with Prisma, fallback to raw SQL for complex queries

**Context**: Need database access layer with type safety

**Options Considered**:
1. Prisma ORM
2. TypeORM
3. Raw SQL (pg library)

**Decision Factors**:
| Factor | Prisma | TypeORM | Raw SQL |
|--------|--------|---------|---------|
| Type safety | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Developer experience | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Performance | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Migrations | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Learning curve | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Flexibility | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Consequence**:
- ✅ Excellent TypeScript support
- ✅ Auto-generated types
- ✅ Great migration system
- ✅ Prisma Studio for debugging
- ❌ Complex queries may need raw SQL
- 🔄 Hybrid approach: Prisma for CRUD, raw SQL for complex analytics

---

### ADR-006: Railway.app vs DigitalOcean vs AWS

**Decision**: Railway.app (MVP), migrate to DigitalOcean if needed

**Context**: Need hosting platform for MVP with minimal DevOps overhead

**Options Considered**:
1. Railway.app
2. DigitalOcean App Platform
3. AWS (EC2 + RDS)
4. Self-hosted VPS

**Decision Factors**:
| Factor | Railway | DigitalOcean | AWS | VPS |
|--------|---------|--------------|-----|-----|
| Ease of use | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Cost (MVP) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Scaling | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| DevOps overhead | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Free tier | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ❌ |

**Consequence**:
- ✅ Zero DevOps for MVP
- ✅ Free $5/month credit
- ✅ Built-in CI/CD
- ✅ One-click PostgreSQL + Redis
- ❌ Usage-based pricing (monitor costs)
- 🔄 Can migrate to DigitalOcean/AWS at scale

---

## 🔧 Detailed Stack Components

### Backend Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "typescript": "^5.3.3",
    "@prisma/client": "^5.8.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "zod": "^3.22.4",
    "redis": "^4.6.12",
    "socket.io": "^4.6.1",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0",
    "multer": "^1.4.5-lts.1",
    "sharp": "^0.33.2"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/express": "^4.17.21",
    "prisma": "^5.8.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.4",
    "ts-node": "^10.9.2",
    "nodemon": "^3.0.3",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.4"
  }
}
```

### Frontend Dependencies
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.3",
    "@tanstack/react-query": "^5.17.19",
    "axios": "^1.6.5",
    "zod": "^3.22.4",
    "react-hook-form": "^7.49.3",
    "socket.io-client": "^4.6.1",
    "tailwindcss": "^3.4.1",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.309.0",
    "date-fns": "^3.3.1"
  },
  "devDependencies": {
    "vite": "^5.0.11",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "vitest": "^1.2.1",
    "@testing-library/react": "^14.1.2",
    "playwright": "^1.41.1",
    "eslint": "^8.56.0",
    "prettier": "^3.2.4"
  }
}
```

---

## 🎯 Performance Targets

### Backend Performance
```yaml
API Response Time:
  - P50: <100ms
  - P95: <200ms
  - P99: <500ms

Database Queries:
  - Simple queries: <10ms
  - Complex joins: <50ms
  - Full-text search: <100ms

Throughput:
  - Requests per second: >100 (single instance)
  - Concurrent connections: >1,000

Memory:
  - Baseline: <200MB
  - Under load: <500MB
```

### Frontend Performance
```yaml
Core Web Vitals:
  - LCP (Largest Contentful Paint): <2.5s
  - FID (First Input Delay): <100ms
  - CLS (Cumulative Layout Shift): <0.1

Lighthouse Scores:
  - Performance: >90
  - Accessibility: >90
  - Best Practices: >90
  - SEO: >90

Bundle Size:
  - Initial JS: <200KB gzipped
  - Initial CSS: <50KB gzipped
  - Total page weight: <1MB
```

### Database Performance
```yaml
Connection Pool:
  - Min connections: 2
  - Max connections: 10 (MVP), 20 (production)

Query Performance:
  - Index usage: >95%
  - Sequential scans: <5%
  - Cache hit ratio: >90%

Backup:
  - Frequency: Daily (automated)
  - Retention: 7 days (MVP), 30 days (production)
```

---

## 🔐 Security Configuration

### Authentication
```typescript
// JWT Configuration
const jwtConfig = {
  accessToken: {
    secret: process.env.JWT_SECRET,
    expiresIn: '15m',
    algorithm: 'HS256'
  },
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: '7d',
    algorithm: 'HS256'
  }
};

// Password Requirements
const passwordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false // Optional for MVP
};

// Bcrypt Rounds
const BCRYPT_ROUNDS = 12;
```

### Rate Limiting
```typescript
// Auth endpoints (stricter)
const authLimiter = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many attempts, please try again later'
};

// API endpoints (standard)
const apiLimiter = {
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false
};

// File upload (very strict)
const uploadLimiter = {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  skipSuccessfulRequests: false
};
```

### CORS Configuration
```typescript
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

---

## 📦 Project Structure

```
/community-social-network
├── /backend
│   ├── /src
│   │   ├── /config           # Environment & app config
│   │   │   ├── database.ts
│   │   │   ├── redis.ts
│   │   │   └── app.ts
│   │   ├── /domains          # Domain-driven design
│   │   │   ├── /users
│   │   │   │   ├── user.model.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   ├── user.controller.ts
│   │   │   │   ├── user.repository.ts
│   │   │   │   ├── user.routes.ts
│   │   │   │   └── user.validation.ts
│   │   │   ├── /groups
│   │   │   │   └── (same structure)
│   │   │   ├── /posts
│   │   │   ├── /comments
│   │   │   ├── /auth
│   │   │   └── /feed
│   │   ├── /middleware       # Auth, validation, errors
│   │   │   ├── auth.middleware.ts
│   │   │   ├── validation.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   └── rate-limit.middleware.ts
│   │   ├── /utils           # Helpers, constants
│   │   │   ├── logger.ts
│   │   │   ├── errors.ts
│   │   │   └── validators.ts
│   │   ├── /jobs            # Background jobs (Bull)
│   │   │   ├── email.job.ts
│   │   │   └── notification.job.ts
│   │   ├── /websockets      # Real-time handlers
│   │   │   └── socket.handler.ts
│   │   └── server.ts        # Main entry point
│   ├── /tests
│   │   ├── /unit
│   │   ├── /integration
│   │   └── /e2e
│   ├── /prisma
│   │   ├── schema.prisma
│   │   └── /migrations
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── /frontend
│   ├── /src
│   │   ├── /components      # Reusable UI components
│   │   │   ├── /ui          # shadcn/ui components
│   │   │   ├── /layout
│   │   │   └── /common
│   │   ├── /features        # Feature modules
│   │   │   ├── /auth
│   │   │   │   ├── components
│   │   │   │   ├── hooks
│   │   │   │   ├── api
│   │   │   │   └── types
│   │   │   ├── /profile
│   │   │   ├── /groups
│   │   │   ├── /feed
│   │   │   └── /posts
│   │   ├── /hooks           # Custom React hooks
│   │   ├── /services        # API clients
│   │   │   ├── api.ts
│   │   │   └── socket.ts
│   │   ├── /store           # State management
│   │   │   └── auth.context.tsx
│   │   ├── /utils           # Helpers
│   │   ├── /types           # TypeScript types
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── routes.tsx
│   ├── /public
│   ├── /tests
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── /shared                  # Shared types (monorepo)
│   └── /types
│       ├── user.types.ts
│       ├── group.types.ts
│       └── post.types.ts
├── /docs
│   ├── /research
│   ├── /api
│   └── /architecture
├── docker-compose.yml
├── .github
│   └── /workflows
│       └── ci-cd.yml
└── README.md
```

---

## ✅ Decision Summary

| Component | Choice | Alternative Considered |
|-----------|--------|------------------------|
| **Backend Runtime** | Node.js 20 | Python 3.11 |
| **Backend Framework** | Express.js | FastAPI, NestJS |
| **Language** | TypeScript | JavaScript |
| **Database** | PostgreSQL 15+ | MySQL, MongoDB |
| **Cache** | Redis 7+ | Memcached |
| **ORM** | Prisma | TypeORM, Raw SQL |
| **Frontend Framework** | React 18 | Vue 3, Svelte |
| **Build Tool** | Vite 5 | Webpack, esbuild |
| **UI Library** | Tailwind + shadcn/ui | Material-UI, Ant Design |
| **State Management** | React Query + Context | Redux, Zustand |
| **API Style** | REST | GraphQL, tRPC |
| **Authentication** | JWT | Session-based, OAuth |
| **File Upload** | Multer → S3 | Cloudinary, local |
| **Real-time** | Socket.io | SSE, WebSockets native |
| **Testing** | Jest + Playwright | Vitest + Cypress |
| **CI/CD** | GitHub Actions | GitLab CI, CircleCI |
| **Hosting (MVP)** | Railway.app | DigitalOcean, Heroku |
| **Monitoring** | Sentry + UptimeRobot | New Relic, DataDog |

---

## 📊 Cost-Benefit Analysis

### Why This Stack Over Alternatives?

#### Node.js vs Python
```
Node.js Benefits:
+ Real-time: Native WebSocket, event-driven
+ Development: Same language (JS/TS) frontend/backend
+ Ecosystem: npm has 2M+ packages
+ Community: 18M+ developers
+ Scalability: Non-blocking I/O, excellent for I/O-heavy apps

Python Trade-offs:
- Real-time: Requires ASGI (uvicorn), less mature
- Development: Context switching (Python ↔ JavaScript)
+ ML/AI: Better ecosystem (future microservice)
+ Type safety: Native type hints (vs TypeScript compilation)

Verdict: Node.js wins for MVP due to real-time requirements
```

#### PostgreSQL vs MongoDB
```
PostgreSQL Benefits:
+ Relationships: Native joins, foreign keys
+ Integrity: ACID compliance, transactions
+ Social graph: Recursive CTEs, graph queries
+ JSON: JSONB support (best of both worlds)
+ Cost: Free, open source

MongoDB Trade-offs:
- Relationships: Manual joins, no foreign keys
- Integrity: Limited transactions (improved in 4.0+)
+ Scalability: Easier horizontal sharding
+ Flexibility: Schema-less (can be a con)
- Cost: Atlas pricing can be higher

Verdict: PostgreSQL wins for relational social data
```

#### React vs Vue vs Svelte
```
React Benefits:
+ Ecosystem: Largest, most mature
+ Jobs: 3x more React jobs than Vue
+ Mobile: React Native (proven path)
+ Community: Massive support, resources
+ TypeScript: Excellent support

Vue/Svelte Trade-offs:
+ Learning: Easier for beginners
+ Performance: Svelte is fastest (marginal for most apps)
- Ecosystem: Smaller (still good for Vue)
- Jobs: Fewer opportunities
- Mobile: Less mature options

Verdict: React wins for job market and mobile path
```

---

## 🔄 Migration Paths

### If Stack Needs Change

#### Backend Migration
```yaml
Node.js → Python (for ML/AI):
  - Extract ML service as microservice
  - Keep Node.js for API gateway and real-time
  - Use message queue for communication
  - Timeline: 2-4 weeks

Express → NestJS:
  - Refactor to modular architecture
  - Gradual migration (controllers first)
  - Timeline: 4-6 weeks
  - Benefit: Better structure, dependency injection
```

#### Database Migration
```yaml
PostgreSQL → PostgreSQL + MongoDB (hybrid):
  - Use PostgreSQL for user/group/posts
  - Use MongoDB for logs, analytics
  - Timeline: 1-2 weeks
  - Benefit: Best of both worlds

PostgreSQL → Graph Database (Neo4j):
  - For advanced social graph features
  - Sync data from PostgreSQL
  - Timeline: 2-3 weeks
  - Benefit: Better for complex relationship queries
```

#### Frontend Migration
```yaml
React → Next.js:
  - Add SSR for SEO
  - Gradual adoption (pages-first)
  - Timeline: 2-3 weeks
  - Benefit: Better SEO, performance

React → React Native (mobile):
  - Reuse components and logic
  - Platform-specific UI
  - Timeline: 6-8 weeks
  - Benefit: Native mobile apps
```

---

**Document Version**: 1.0
**Last Updated**: 2025-11-14
**Status**: ✅ Final Decision

**Next Steps**:
1. Setup development environment
2. Initialize repositories with chosen stack
3. Create database schema in Prisma
4. Begin Week 1 development (Auth system)

# System Architecture Specification
## Community Social Network - SPARC Phase 1

**Document Version:** 1.0.0
**Date:** 2025-12-04
**Status:** Draft - SPARC Specification Phase
**Classification:** Architecture Specification (NO CODE)
**Agent:** System Architecture Specification Agent
**Swarm ID:** swarm_1764870584933_5ucxzwuly

---

## Executive Summary

This document defines the complete system architecture for the Community Social Network platform serving the Serbian Agentics Foundation and StartIT community. The architecture is designed to support 10,000+ users, 300,000+ posts, and 1,000 concurrent users while maintaining high availability (99.5%+), security, and performance.

**Key Architecture Principles:**
1. **Scalability First**: Horizontal scaling from day one
2. **Security by Design**: Defense in depth across all layers
3. **Performance Optimized**: Sub-500ms p95 response times
4. **Cloud-Native**: Container-based, stateless services
5. **Observable**: Comprehensive monitoring and tracing

**Technology Stack:**
- Backend: Node.js 20, NestJS, TypeScript
- Database: PostgreSQL 15+ (primary), Redis 7+ (cache)
- Frontend: React 18, TypeScript, Vite
- Infrastructure: Docker, Kubernetes, AWS/DigitalOcean

---

## Table of Contents

1. [System Context](#1-system-context)
2. [Container Architecture](#2-container-architecture)
3. [Component Architecture](#3-component-architecture)
4. [Data Architecture](#4-data-architecture)
5. [Security Architecture](#5-security-architecture)
6. [Scalability Architecture](#6-scalability-architecture)
7. [Integration Architecture](#7-integration-architecture)
8. [Non-Functional Requirements](#8-non-functional-requirements)

---

## 1. System Context

### 1.1 System Boundary

```
┌────────────────────────────────────────────────────────────────┐
│                    EXTERNAL ACTORS                             │
│                                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   Web    │  │  Mobile  │  │  Admin   │  │   API    │     │
│  │  Users   │  │  Users   │  │  Users   │  │ Clients  │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
└───────┼─────────────┼─────────────┼─────────────┼────────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                         │
        ┌────────────────▼───────────────────────┐
        │   COMMUNITY SOCIAL NETWORK SYSTEM      │
        │                                        │
        │  ┌──────────────────────────────┐     │
        │  │     API Gateway Layer        │     │
        │  │  (Auth, Rate Limit, Route)   │     │
        │  └────────────┬─────────────────┘     │
        │               │                       │
        │  ┌────────────▼─────────────────┐     │
        │  │   Application Services       │     │
        │  │  (NestJS Microservices)      │     │
        │  └────────────┬─────────────────┘     │
        │               │                       │
        │  ┌────────────▼─────────────────┐     │
        │  │    Data & Cache Layer        │     │
        │  │  (PostgreSQL, Redis)         │     │
        │  └──────────────────────────────┘     │
        └────────────────────────────────────────┘
                         │
        ┌────────────────▼───────────────────────┐
        │       EXTERNAL SYSTEMS                 │
        │                                        │
        │  ┌──────┐  ┌──────┐  ┌──────┐        │
        │  │ SMTP │  │  S3  │  │ CDN  │        │
        │  │Email │  │Store │  │Assets│        │
        │  └──────┘  └──────┘  └──────┘        │
        └────────────────────────────────────────┘
```

### 1.2 External Systems & Interfaces

| System | Protocol | Purpose | SLA | Failover |
|--------|----------|---------|-----|----------|
| **Email Service** | SMTP/TLS | Transactional emails | 99.9% | Queue + retry |
| **Object Storage** | S3 API/HTTPS | Media files | 99.99% | CDN cache |
| **CDN** | HTTPS | Static assets | 99.95% | Multi-region |
| **Monitoring** | HTTPS | Metrics/logs | 99.9% | Local buffer |
| **Auth Provider** | OAuth2 | Social login (future) | 99% | Graceful degrade |

### 1.3 User Types & Access Patterns

| User Type | Count (MVP) | Access Pattern | Peak Load |
|-----------|-------------|----------------|-----------|
| **Registered Users** | 10,000 | Daily active: 40% | 4,000 DAU |
| **Anonymous Visitors** | 5,000/day | Browse public content | 200 concurrent |
| **Moderators** | 50 | Review content | 10 concurrent |
| **Administrators** | 5 | System management | 2 concurrent |
| **API Consumers** | 10 | Programmatic access | 50 req/min |

---

## 2. Container Architecture

### 2.1 High-Level Container Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    CLIENT TIER                                │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  React SPA │  │ Mobile App │  │  Admin UI  │           │
│  │  (Vite)    │  │  (Future)  │  │  (React)   │           │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘           │
└────────┼────────────────┼────────────────┼───────────────────┘
         │                │                │
         │ HTTPS/WSS      │ HTTPS/WSS      │ HTTPS
         │                │                │
┌────────▼────────────────▼────────────────▼───────────────────┐
│                    CDN / LOAD BALANCER                        │
│                   (CloudFront / Nginx)                        │
└────────┬──────────────────────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────────────────────────┐
│                    API GATEWAY TIER                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         NestJS API Gateway Container                 │   │
│  │                                                      │   │
│  │  - JWT Authentication Middleware                    │   │
│  │  - Rate Limiting (Redis-backed)                     │   │
│  │  - Request Routing & Load Balancing                 │   │
│  │  - CORS & Security Headers                          │   │
│  │  - Request/Response Logging                         │   │
│  │  - Circuit Breaker                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────┬──────────────────────────────────────────────────────┘
         │
         │ Internal Network
         │
┌────────▼──────────────────────────────────────────────────────┐
│                APPLICATION SERVICE TIER                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   User       │  │    Post      │  │    Group     │     │
│  │   Service    │  │   Service    │  │   Service    │     │
│  │              │  │              │  │              │     │
│  │ - Auth       │  │ - CRUD       │  │ - CRUD       │     │
│  │ - Profiles   │  │ - Feed Gen   │  │ - RBAC       │     │
│  │ - Following  │  │ - Comments   │  │ - Members    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│  ┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐     │
│  │Notification │  │    Media     │  │  Moderation  │     │
│  │  Service    │  │   Service    │  │   Service    │     │
│  │             │  │              │  │              │     │
│  │ - Real-time │  │ - Upload     │  │ - Reports    │     │
│  │ - Email     │  │ - Process    │  │ -审核队列   │     │
│  │ - WebSocket │  │ - CDN Sync   │  │ - Actions    │     │
│  └─────────────┘  └──────────────┘  └──────────────┘     │
└────────┬──────────────────────────────────────────────────────┘
         │
         │ Connection Pool
         │
┌────────▼──────────────────────────────────────────────────────┐
│                    DATA TIER                                  │
│                                                              │
│  ┌──────────────┐                  ┌──────────────┐         │
│  │  PostgreSQL  │◄────Replication──┤  PostgreSQL  │         │
│  │   Primary    │                  │   Replica 1  │         │
│  │              │                  │   (Read)     │         │
│  └──────┬───────┘                  └──────────────┘         │
│         │                                                    │
│         │ Replication                                        │
│         │                          ┌──────────────┐         │
│         └─────────────────────────►│  PostgreSQL  │         │
│                                    │   Replica 2  │         │
│                                    │   (Read)     │         │
│                                    └──────────────┘         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Redis Cluster (3 Shards)                   │   │
│  │                                                      │   │
│  │  - Session Store (JWT blacklist)                    │   │
│  │  - Cache Layer (Feed, User, Group)                  │   │
│  │  - Rate Limiting Counters                           │   │
│  │  - WebSocket Pub/Sub                                │   │
│  │  - Job Queue (Background tasks)                     │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────────────────────────┐
│                  STORAGE TIER                                 │
│                                                              │
│  ┌──────────────┐                  ┌──────────────┐         │
│  │  S3 Storage  │◄────Replication──┤  S3 Replica  │         │
│  │   (Primary)  │                  │  (Disaster)  │         │
│  │              │                  │              │         │
│  │ - User Media │                  │ - DR Backup  │         │
│  │ - Group Imgs │                  │              │         │
│  │ - Attachments│                  │              │         │
│  └──────────────┘                  └──────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Service Responsibilities

#### API Gateway Service
**Technology:** NestJS, Express
**Instances:** 3+ (auto-scale)
**Purpose:** Single entry point for all client requests

**Responsibilities:**
- JWT token validation and user authentication
- Rate limiting enforcement (Redis-backed)
- Request routing to downstream services
- Security headers injection (CSP, HSTS, etc.)
- CORS policy enforcement
- Request/response logging
- Circuit breaker for failing services
- Load balancing across service instances

**Interfaces:**
- **Input:** HTTPS (443), WebSocket (443)
- **Output:** HTTP to internal services
- **Dependencies:** Redis (rate limits), Auth Service

---

#### User Service
**Technology:** NestJS, TypeORM/Prisma
**Instances:** 2+ (auto-scale)
**Database:** PostgreSQL (users, profiles, auth_tokens)

**Responsibilities:**
- User registration and email verification
- Authentication (JWT generation/refresh)
- Password hashing (bcrypt, 12 rounds)
- Profile CRUD operations
- User search and discovery
- Following/follower relationships
- Block list management
- Account deletion and data export

**API Endpoints:**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User authentication
- `POST /api/auth/refresh` - Token refresh
- `GET /api/users/:id` - Get user profile
- `PATCH /api/users/:id` - Update profile
- `POST /api/users/:id/follow` - Follow user
- `GET /api/users/:id/followers` - Get followers

**Cache Strategy:**
- User profiles: 15-minute TTL
- Follower counts: 5-minute TTL
- Block lists: 30-minute TTL

---

#### Post Service
**Technology:** NestJS, TypeORM/Prisma
**Instances:** 3+ (auto-scale)
**Database:** PostgreSQL (posts, comments, reactions)

**Responsibilities:**
- Post CRUD with XSS sanitization
- Comment management (nested, 3 levels)
- Reaction handling (like, love, etc.)
- Feed generation (home, group, profile)
- Post sharing and resharing
- Content moderation queue
- Post search and filtering

**API Endpoints:**
- `POST /api/posts` - Create post
- `GET /api/posts/:id` - Get post details
- `PATCH /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/comments` - Add comment
- `POST /api/posts/:id/reactions` - React to post
- `GET /api/feed/home` - Get home feed
- `GET /api/feed/group/:groupId` - Get group feed

**Cache Strategy:**
- Home feed: 2-minute TTL
- Group feed: 3-minute TTL
- Profile feed: 5-minute TTL
- Post details: 10-minute TTL

**Performance Targets:**
- Home feed p95: < 300ms
- Post creation: < 200ms
- Comment load: < 100ms

---

#### Group Service
**Technology:** NestJS, TypeORM/Prisma
**Instances:** 2+ (auto-scale)
**Database:** PostgreSQL (groups, memberships, roles)

**Responsibilities:**
- Group CRUD operations
- RBAC enforcement (Owner, Moderator, Member)
- Membership management (invite, approve, remove)
- Privacy controls (public/private)
- Group content filtering
- Role assignment and transitions
- Group search and discovery

**API Endpoints:**
- `POST /api/groups` - Create group
- `GET /api/groups/:id` - Get group details
- `PATCH /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group
- `POST /api/groups/:id/members` - Add member
- `DELETE /api/groups/:id/members/:userId` - Remove member
- `POST /api/groups/:id/moderators/:userId` - Assign moderator
- `GET /api/groups/:id/members` - List members

**RBAC Matrix:**
- Owner: All permissions
- Moderator: Content moderation, member management (non-moderators)
- Member: Post, comment, react

---

#### Notification Service
**Technology:** NestJS, Socket.io, Bull Queue
**Instances:** 2+ (stateful, session affinity)
**Database:** PostgreSQL (notifications), Redis (pub/sub)

**Responsibilities:**
- Real-time notifications via WebSocket
- Email notifications (transactional)
- In-app notification center
- Push notifications (future: mobile)
- Notification preferences management
- Delivery tracking and retry logic
- Digest email generation

**API Endpoints:**
- `GET /api/notifications` - Get user notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `POST /api/notifications/preferences` - Update preferences
- WebSocket: `/notifications` (subscribe)

**Event Types:**
- New follower
- Post reaction
- Comment mention
- Group invitation
- Moderation action

---

#### Media Service
**Technology:** NestJS, Sharp, Multer
**Instances:** 2+ (CPU-intensive, auto-scale)
**Storage:** S3-compatible object storage

**Responsibilities:**
- File upload validation (magic bytes)
- Image processing (resize, optimize)
- Malware scanning integration
- CDN synchronization
- Media metadata extraction
- Thumbnail generation
- Storage quota management

**API Endpoints:**
- `POST /api/media/upload` - Upload file
- `GET /api/media/:id` - Get media metadata
- `DELETE /api/media/:id` - Delete media

**Security Requirements:**
- Magic byte validation (no extension trust)
- MIME type verification (3-way check)
- Max file size: 5 MB (images), 10 MB (video future)
- Supported types: JPEG, PNG, GIF, WebP, AVIF
- Blocked types: SVG, TIFF, BMP, executables

**Processing Pipeline:**
1. Validate file signature
2. Scan for malware (ClamAV)
3. Generate thumbnails (256px, 512px, 1024px)
4. Optimize compression (Sharp)
5. Upload to S3
6. Invalidate CDN cache
7. Return CDN URLs

---

#### Moderation Service
**Technology:** NestJS, Bull Queue
**Instances:** 1-2 (background processing)
**Database:** PostgreSQL (reports, actions, audit_logs)

**Responsibilities:**
- Content report queue
- Automated content filtering
- Moderation action enforcement
- Audit trail logging
- Moderator tools API
- Appeal processing
- Violation tracking

**API Endpoints:**
- `POST /api/moderation/reports` - Submit report
- `GET /api/moderation/queue` - Get moderation queue
- `POST /api/moderation/actions` - Take action
- `GET /api/moderation/audit` - Audit logs

**Auto-Moderation Rules:**
- Profanity filter (configurable)
- Spam detection (rate-based)
- NSFW image detection (ML, future)
- Account age restrictions

---

### 2.3 Service Communication Patterns

| Pattern | Use Case | Protocol | Example |
|---------|----------|----------|---------|
| **Synchronous HTTP** | CRUD operations | REST/JSON | User Service → Post Service |
| **Asynchronous Queue** | Background jobs | Redis Bull | Email sending, media processing |
| **Event Bus** | Real-time updates | Redis Pub/Sub | New post → notification |
| **WebSocket** | Client push | Socket.io | Real-time notifications |
| **Database Polling** | Job pickup | PostgreSQL | Moderation queue |

---

## 3. Component Architecture

### 3.1 NestJS Module Structure

```
src/
├── main.ts                     # Application entry point
├── app.module.ts               # Root module
│
├── common/                     # Shared modules
│   ├── guards/
│   │   ├── jwt-auth.guard.ts   # JWT authentication
│   │   ├── roles.guard.ts      # RBAC authorization
│   │   └── rate-limit.guard.ts # Rate limiting
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   ├── cache.interceptor.ts
│   │   └── transform.interceptor.ts
│   ├── filters/
│   │   ├── http-exception.filter.ts
│   │   └── validation.filter.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   └── pipes/
│       ├── validation.pipe.ts
│       └── sanitization.pipe.ts
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       └── login.dto.ts
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   │
│   ├── posts/
│   │   ├── posts.module.ts
│   │   ├── posts.controller.ts
│   │   ├── posts.service.ts
│   │   ├── posts.repository.ts
│   │   ├── feed.service.ts
│   │   ├── entities/
│   │   │   ├── post.entity.ts
│   │   │   ├── comment.entity.ts
│   │   │   └── reaction.entity.ts
│   │   └── dto/
│   │       └── create-post.dto.ts
│   │
│   ├── groups/
│   │   ├── groups.module.ts
│   │   ├── groups.controller.ts
│   │   ├── groups.service.ts
│   │   ├── rbac.service.ts
│   │   ├── entities/
│   │   │   ├── group.entity.ts
│   │   │   └── membership.entity.ts
│   │   └── dto/
│   │
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── notifications.gateway.ts    # WebSocket
│   │   ├── notifications.service.ts
│   │   ├── email.service.ts
│   │   └── dto/
│   │
│   ├── media/
│   │   ├── media.module.ts
│   │   ├── media.controller.ts
│   │   ├── media.service.ts
│   │   ├── upload.service.ts
│   │   ├── processing.service.ts
│   │   └── validators/
│   │       ├── file-signature.validator.ts
│   │       └── mime-type.validator.ts
│   │
│   └── moderation/
│       ├── moderation.module.ts
│       ├── moderation.controller.ts
│       ├── moderation.service.ts
│       ├── queue.service.ts
│       └── dto/
│
├── config/
│   ├── database.config.ts
│   ├── redis.config.ts
│   ├── jwt.config.ts
│   ├── s3.config.ts
│   └── sanitization.config.ts     # XSS prevention
│
├── security/
│   ├── xss/
│   │   ├── sanitizer.service.ts
│   │   └── content-security-policy.ts
│   ├── file-validation/
│   │   ├── magic-bytes.ts
│   │   └── malware-scanner.ts
│   └── rate-limiting/
│       └── distributed-limiter.ts
│
└── utils/
    ├── logger.service.ts
    ├── cache.service.ts
    └── pagination.util.ts
```

### 3.2 Layered Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                     │
│  (Controllers, Gateways, DTOs, Validation)              │
│                                                         │
│  - HTTP REST Controllers                                │
│  - WebSocket Gateways                                   │
│  - Request/Response DTOs                                │
│  - Input Validation Pipes                               │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                  APPLICATION LAYER                      │
│  (Services, Business Logic, Use Cases)                  │
│                                                         │
│  - User Service (auth, profiles)                        │
│  - Post Service (CRUD, feed generation)                 │
│  - Group Service (RBAC, membership)                     │
│  - Notification Service (real-time, email)              │
│  - Media Service (upload, processing)                   │
│  - Moderation Service (reports, actions)                │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                   DOMAIN LAYER                          │
│  (Entities, Value Objects, Domain Logic)                │
│                                                         │
│  - User Entity (id, email, profile)                     │
│  - Post Entity (id, content, author)                    │
│  - Group Entity (id, name, privacy)                     │
│  - Comment Entity (id, content, post)                   │
│  - Reaction Entity (id, type, user)                     │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│               INFRASTRUCTURE LAYER                      │
│  (Repositories, External Services, Adapters)            │
│                                                         │
│  - TypeORM/Prisma Repositories                          │
│  - Redis Cache Service                                  │
│  - S3 Storage Adapter                                   │
│  - SMTP Email Adapter                                   │
│  - External API Clients                                 │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Cross-Cutting Concerns

| Concern | Implementation | Location |
|---------|---------------|----------|
| **Authentication** | JWT Guards | `common/guards/jwt-auth.guard.ts` |
| **Authorization** | RBAC Guards | `common/guards/roles.guard.ts` |
| **Validation** | Class Validator | DTOs + Validation Pipe |
| **Sanitization** | DOMPurify | `security/xss/sanitizer.service.ts` |
| **Logging** | Winston | `utils/logger.service.ts` |
| **Error Handling** | Exception Filters | `common/filters/*.filter.ts` |
| **Caching** | Redis + Interceptor | `common/interceptors/cache.interceptor.ts` |
| **Rate Limiting** | Redis + Guard | `common/guards/rate-limit.guard.ts` |

---

## 4. Data Architecture

### 4.1 Database Schema Overview

**PostgreSQL 15+ (Primary Data Store)**

```sql
-- Core User Tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  bio TEXT,
  avatar_url VARCHAR(500),
  location VARCHAR(100),
  website VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Posts and Content
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES users(id),
  group_id UUID REFERENCES groups(id) NULL,
  content TEXT NOT NULL,
  sanitized_content TEXT NOT NULL,  -- XSS-safe version
  content_hash VARCHAR(64),          -- For duplicate detection
  status VARCHAR(20) DEFAULT 'published',  -- published, pending, deleted
  visibility VARCHAR(20) DEFAULT 'public', -- public, followers, group
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_posts_author ON posts(author_id, created_at DESC);
CREATE INDEX idx_posts_group ON posts(group_id, created_at DESC);
CREATE INDEX idx_posts_status ON posts(status, created_at DESC);

-- Comments (Nested, 3 levels max)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES comments(id) NULL,
  author_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  sanitized_content TEXT NOT NULL,
  depth INT DEFAULT 0,  -- 0-2 (max 3 levels)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_comments_post ON comments(post_id, created_at);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);

-- Reactions
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  post_id UUID REFERENCES posts(id) NULL,
  comment_id UUID REFERENCES comments(id) NULL,
  type VARCHAR(20) NOT NULL,  -- like, love, laugh, sad, angry
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, comment_id)
);

-- Groups and Membership
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  privacy VARCHAR(20) DEFAULT 'public',  -- public, private
  status VARCHAR(20) DEFAULT 'active',   -- active, archived, deleted
  owner_id UUID REFERENCES users(id),
  require_post_approval BOOLEAN DEFAULT FALSE,
  require_member_approval BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'member',  -- owner, moderator, member
  status VARCHAR(20) DEFAULT 'active', -- active, muted, banned
  muted_until TIMESTAMP NULL,
  banned_until TIMESTAMP NULL,
  ban_reason TEXT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id, role);
CREATE INDEX idx_group_members_user ON group_members(user_id);

-- Audit Logs (Immutable)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR(20),
  group_id UUID REFERENCES groups(id) NULL,
  target_user_id UUID REFERENCES users(id) NULL,
  target_resource_id UUID NULL,
  old_value JSONB NULL,
  new_value JSONB NULL,
  reason TEXT NULL,
  additional_data JSONB NULL,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  signature TEXT NOT NULL  -- Cryptographic integrity
);

CREATE INDEX idx_audit_logs_group ON audit_logs(group_id, timestamp DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, timestamp DESC);
CREATE INDEX idx_audit_logs_event ON audit_logs(event_type, timestamp DESC);

-- Relationships
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES users(id),
  following_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX idx_relationships_follower ON relationships(follower_id);
CREATE INDEX idx_relationships_following ON relationships(following_id);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL,  -- new_follower, post_reaction, comment, etc.
  actor_id UUID REFERENCES users(id) NULL,
  resource_type VARCHAR(50),  -- post, comment, group
  resource_id UUID,
  content TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- Media Metadata
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  filename VARCHAR(255),
  original_filename VARCHAR(255),
  mime_type VARCHAR(100),
  file_size BIGINT,
  width INT,
  height INT,
  storage_path VARCHAR(500),
  cdn_url VARCHAR(500),
  thumbnail_urls JSONB,  -- {256: "url", 512: "url", 1024: "url"}
  status VARCHAR(20) DEFAULT 'pending',  -- pending, processed, failed
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_media_user ON media(user_id, created_at DESC);
```

### 4.2 Redis Cache Structure

**Cache Namespaces and TTLs:**

```javascript
// User Data
user:{userId}:profile          // TTL: 15 min
user:{userId}:followers        // TTL: 5 min
user:{userId}:following        // TTL: 5 min
user:{userId}:blocklist        // TTL: 30 min

// Post Data
post:{postId}:details          // TTL: 10 min
post:{postId}:comments         // TTL: 5 min
post:{postId}:reactions        // TTL: 2 min

// Feed Data (Most Critical)
feed:home:{userId}             // TTL: 2 min
feed:group:{groupId}           // TTL: 3 min
feed:profile:{userId}          // TTL: 5 min

// Group Data
group:{groupId}:details        // TTL: 10 min
group:{groupId}:members        // TTL: 5 min
group:{groupId}:rbac:{userId}  // TTL: 15 min

// Rate Limiting
ratelimit:ip:{ipAddress}       // TTL: 60 sec
ratelimit:user:{userId}        // TTL: 60 sec
ratelimit:endpoint:{endpoint}  // TTL: 60 sec

// Session Management
session:jwt:{tokenId}          // TTL: 15 min (access token)
session:refresh:{tokenId}      // TTL: 7 days (refresh token)
session:blacklist:{tokenId}    // TTL: 15 min (logged out tokens)

// Real-Time (Pub/Sub)
notifications:user:{userId}    // Pub/Sub channel
chat:room:{roomId}             // Pub/Sub channel (future)

// Job Queue (Bull)
queue:email:jobs               // Persistent until processed
queue:media:processing         // Persistent until processed
queue:moderation:auto          // Persistent until processed
```

### 4.3 Data Flow Patterns

**Feed Generation Flow:**
```
User Request → API Gateway → Post Service
                                ↓
                          Check Redis Cache
                                ↓
                          Cache Hit? → Return
                                ↓ Cache Miss
                          Query PostgreSQL
                                ↓
                    Apply Business Logic (filter, sort)
                                ↓
                          Cache Result (2 min TTL)
                                ↓
                          Return to User
```

**Post Creation Flow:**
```
User Request → API Gateway → Post Service
                                ↓
                     Sanitize Content (XSS)
                                ↓
                     Validate (length, format)
                                ↓
                     Insert to PostgreSQL
                                ↓
                     Invalidate Cache (user, group feeds)
                                ↓
                     Emit Event (Redis Pub/Sub)
                                ↓
                     Notification Service → Real-time push
                                ↓
                     Return Success
```

---

## 5. Security Architecture

### 5.1 Security Layers

```
┌─────────────────────────────────────────────────────────┐
│              LAYER 7: CLIENT SECURITY                   │
│  - HTTPS only (TLS 1.3)                                 │
│  - Content Security Policy (CSP)                        │
│  - XSS Prevention (DOMPurify)                           │
│  - CSRF Protection                                      │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│          LAYER 6: CDN & LOAD BALANCER                   │
│  - DDoS Protection (CloudFront Shield)                  │
│  - WAF Rules (SQL injection, XSS)                       │
│  - Rate Limiting (IP-based)                             │
│  - SSL/TLS Termination                                  │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│            LAYER 5: API GATEWAY                         │
│  - JWT Authentication                                   │
│  - Rate Limiting (User-based)                           │
│  - Input Validation                                     │
│  - Security Headers                                     │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│        LAYER 4: APPLICATION SERVICES                    │
│  - RBAC Authorization                                   │
│  - Business Logic Validation                            │
│  - Content Sanitization                                 │
│  - Audit Logging                                        │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┘
│            LAYER 3: DATA ACCESS                         │
│  - Parameterized Queries (SQL injection prevention)     │
│  - Encryption at Rest (AES-256)                         │
│  - Connection Pooling (limit exposure)                  │
│  - Read Replicas (limit write access)                   │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│          LAYER 2: INFRASTRUCTURE                        │
│  - Network Segmentation (VPC)                           │
│  - Security Groups (firewall rules)                     │
│  - IAM Roles (least privilege)                          │
│  - Secrets Management (AWS Secrets Manager)             │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│          LAYER 1: PHYSICAL/CLOUD                        │
│  - AWS/DigitalOcean Security                            │
│  - Data Center Physical Security                        │
│  - Backup and Disaster Recovery                         │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Authentication & Authorization

**JWT Token Structure:**
```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-uuid",
    "email": "user@example.com",
    "role": "user",
    "iat": 1701734400,
    "exp": 1701735300,
    "jti": "token-id"
  }
}
```

**Token Lifecycle:**
- **Access Token:** 15 minutes TTL, short-lived, stored in memory
- **Refresh Token:** 7 days TTL, stored in httpOnly cookie
- **Token Rotation:** New refresh token issued on each refresh
- **Blacklist:** Logged-out tokens stored in Redis until expiry

**RBAC Permission Matrix:**

| Resource | Owner | Moderator | Member | Anonymous |
|----------|-------|-----------|--------|-----------|
| **Group Settings** | RW | R | R | - |
| **Group Delete** | W | - | - | - |
| **Member Management** | RW | RW* | - | - |
| **Post Approval** | RW | RW | - | - |
| **Post Create** | RW | RW | RW | - |
| **Post Edit (Own)** | RW | RW | RW | - |
| **Post Edit (Others)** | RW | RW | - | - |
| **Post Delete (Own)** | RW | RW | RW | - |
| **Post Delete (Others)** | RW | RW | - | - |

*Moderators cannot manage Owner or other Moderators

### 5.3 XSS Prevention Architecture

**Input Sanitization (Server-Side):**
```javascript
// DOMPurify Configuration
const SANITIZATION_CONFIG = {
  postContent: {
    ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/)/i,
    MAX_LENGTH: 10000
  },
  userBio: {
    ALLOWED_TAGS: [],  // Strip all HTML
    MAX_LENGTH: 500
  },
  username: {
    ALLOWED_PATTERN: /^[a-zA-Z0-9_]{3,20}$/,
    MAX_LENGTH: 20
  }
};
```

**Content Security Policy:**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM}';
  style-src 'self' 'nonce-{RANDOM}' https://fonts.googleapis.com;
  img-src 'self' data: https://cdn.startit.rs https://s3.amazonaws.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.startit.rs wss://api.startit.rs;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
  report-uri /api/csp-report;
```

### 5.4 File Upload Security

**Validation Flow:**
```
Upload Request
    ↓
1. Check File Size (< 5 MB)
    ↓
2. Validate Magic Bytes (file-type library)
    ↓
3. Verify MIME Consistency (header vs signature vs extension)
    ↓
4. Scan for Malware (ClamAV)
    ↓
5. Extract and Validate Image Dimensions
    ↓
6. Check for Decompression Bombs (pixel count)
    ↓
7. Process with Sharp (strip EXIF, optimize)
    ↓
8. Generate Thumbnails
    ↓
9. Upload to S3 with Restricted Permissions
    ↓
10. Return CDN URLs (not direct S3)
```

**Storage Security:**
- S3 Bucket: Private (no public listing)
- Access: Pre-signed URLs with 1-hour expiry
- CDN: CloudFront with signed cookies
- File Names: Randomized UUIDs (prevent enumeration)
- Content-Disposition: `attachment` (prevent inline execution)

---

## 6. Scalability Architecture

### 6.1 Horizontal Scaling Strategy

**Auto-Scaling Policies:**

| Component | Min Instances | Max Instances | Scale Up Trigger | Scale Down Trigger |
|-----------|---------------|---------------|------------------|-------------------|
| API Gateway | 2 | 10 | CPU > 70% | CPU < 30% |
| User Service | 2 | 5 | CPU > 60% | CPU < 25% |
| Post Service | 3 | 10 | CPU > 70% | CPU < 30% |
| Group Service | 2 | 5 | CPU > 60% | CPU < 25% |
| Media Service | 2 | 8 | CPU > 80% | CPU < 40% |
| Notification Service | 2 | 4 | WebSocket conn > 500 | Conn < 100 |

**Load Balancing:**
- **Algorithm:** Least Connections (for WebSocket), Round Robin (for HTTP)
- **Health Checks:** HTTP /health endpoint every 30 seconds
- **Session Affinity:** Enabled for WebSocket (sticky sessions)
- **Connection Draining:** 60 seconds before instance termination

### 6.2 Database Scaling

**Read Scaling (PostgreSQL Replication):**
```
┌──────────────┐
│   Primary    │ ◄─── All Writes
│ (Leader)     │
└──────┬───────┘
       │
       ├─────────────┬─────────────┐
       │             │             │
       ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Replica 1│  │ Replica 2│  │ Replica 3│
│ (Read)   │  │ (Read)   │  │ (Backup) │
└──────────┘  └──────────┘  └──────────┘
      ▲             ▲
      │             │
   Read Queries  Read Queries
```

**Write Scaling (Future - Sharding):**
- Shard by user_id hash (consistent hashing)
- Shard by group_id for group content
- Maintain global shard for relationships

**Query Optimization:**
```sql
-- Critical Indexes (Created in Migration Phase)
CREATE INDEX CONCURRENTLY idx_posts_feed
  ON posts(author_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_posts_group_feed
  ON posts(group_id, created_at DESC)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX CONCURRENTLY idx_comments_post
  ON comments(post_id, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_reactions_post
  ON reactions(post_id, type);

CREATE INDEX CONCURRENTLY idx_group_members_role
  ON group_members(group_id, role, status);
```

### 6.3 Caching Strategy

**Three-Tier Cache Architecture:**

```
┌──────────────────────────────────────────────────┐
│              TIER 1: In-Memory Cache             │
│           (Node.js LRU Cache, 100 MB)            │
│                                                  │
│  - Hot data (last 1000 requests)                 │
│  - TTL: 30 seconds                               │
│  - Hit Rate Target: 40%                          │
└────────────────┬─────────────────────────────────┘
                 │ Cache Miss
┌────────────────▼─────────────────────────────────┐
│              TIER 2: Redis Cache                 │
│          (Distributed, 10 GB Cluster)            │
│                                                  │
│  - User profiles, feeds, post details            │
│  - TTL: 2-15 minutes (based on data type)        │
│  - Hit Rate Target: 85-90%                       │
└────────────────┬─────────────────────────────────┘
                 │ Cache Miss
┌────────────────▼─────────────────────────────────┐
│           TIER 3: PostgreSQL Database            │
│        (Source of Truth, Persistent)             │
│                                                  │
│  - All data stored permanently                   │
│  - Query optimization via indexes                │
│  - Read replicas for scaling                     │
└──────────────────────────────────────────────────┘
```

**Cache Invalidation Strategy:**
- **Write-Through:** Update cache immediately on write
- **Time-Based:** TTL expiration (2-15 min)
- **Event-Based:** Invalidate on specific events (post created, user updated)
- **Pattern Matching:** Invalidate multiple keys with pattern (e.g., `feed:*:{userId}`)

### 6.4 CDN Architecture

**CloudFront Distribution:**
- **Origin:** S3 bucket (media files), API Gateway (dynamic content)
- **Edge Locations:** Global (closest to user)
- **Cache Behavior:**
  - Static assets (images, CSS, JS): 7 days
  - User avatars: 1 hour
  - Post images: 24 hours
  - API responses: No cache (dynamic)

**Cache Control Headers:**
```
# Static Assets
Cache-Control: public, max-age=604800, immutable

# User Avatars
Cache-Control: public, max-age=3600, must-revalidate

# Post Images
Cache-Control: public, max-age=86400, must-revalidate

# API Responses
Cache-Control: no-cache, no-store, must-revalidate
```

---

## 7. Integration Architecture

### 7.1 External Service Integration

**Email Service (SendGrid / Amazon SES):**
- **Protocol:** SMTP over TLS / REST API
- **Use Cases:**
  - Transactional emails (verification, password reset)
  - Notification digests (daily/weekly summary)
  - Moderation alerts (urgent reports)
- **Retry Logic:** Exponential backoff (3 retries max)
- **Failover:** Secondary provider if primary fails
- **Rate Limits:** 100 emails/second

**Object Storage (S3 / MinIO):**
- **Protocol:** S3-compatible API over HTTPS
- **Use Cases:**
  - User profile pictures
  - Group images
  - Post attachments
  - Media thumbnails
- **Security:** Pre-signed URLs, IAM roles
- **Lifecycle:** Transition to Glacier after 365 days
- **Backup:** Cross-region replication

**Monitoring (Prometheus + Grafana):**
- **Protocol:** HTTP pull (Prometheus) / HTTPS push (Grafana)
- **Metrics Collected:**
  - API response times (histograms)
  - Database query performance
  - Cache hit rates
  - Error rates by endpoint
  - Resource utilization (CPU, memory)
- **Alerts:** PagerDuty integration for critical issues

### 7.2 API Contracts (OpenAPI Specification)

**RESTful API Design Principles:**
- Resource-based URLs: `/api/users/{id}`, `/api/groups/{groupId}/posts`
- HTTP verbs: GET (read), POST (create), PATCH (update), DELETE (delete)
- Versioning: `/api/v1/users` (future-proof)
- Pagination: `?page=1&limit=20` (cursor-based for feeds)
- Filtering: `?status=published&author={userId}`
- Sorting: `?sort=-created_at` (descending)

**Response Format (JSON):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "post",
    "attributes": { ... },
    "relationships": { ... }
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 250,
      "hasNext": true
    }
  }
}
```

**Error Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action",
    "details": {
      "required_role": "moderator",
      "current_role": "member"
    },
    "timestamp": "2025-12-04T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

### 7.3 WebSocket Protocol (Real-Time Notifications)

**Connection Flow:**
```
Client                          Server
  │                               │
  ├──► WS Connect (wss://)       │
  │    + JWT in query param      │
  │                               │
  │   ◄──── Connection ACK       │
  │        { userId, sessionId } │
  │                               │
  ├──► Subscribe                 │
  │    { channel: "notifications" } │
  │                               │
  │   ◄──── Subscription OK      │
  │                               │
  │   ◄──── Push Notification    │
  │   ◄──── Push Notification    │
  │                               │
  ├──► Heartbeat (every 30s)     │
  │                               │
  │   ◄──── Pong                 │
  │                               │
  ├──► Unsubscribe               │
  │                               │
  ├──► WS Disconnect             │
```

**Message Format:**
```json
{
  "type": "notification",
  "event": "new_follower",
  "data": {
    "actorId": "user-uuid",
    "actorName": "John Doe",
    "timestamp": "2025-12-04T10:30:00Z",
    "resourceType": "user",
    "resourceId": "follower-uuid"
  }
}
```

---

## 8. Non-Functional Requirements

### 8.1 Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| **API Response Time (p50)** | < 100ms | Prometheus histogram |
| **API Response Time (p95)** | < 500ms | Prometheus histogram |
| **API Response Time (p99)** | < 1000ms | Prometheus histogram |
| **Home Feed Load (p95)** | < 300ms | Application logs |
| **Group Feed Load (p95)** | < 250ms | Application logs |
| **Database Query (p95)** | < 50ms | Query logs |
| **Cache Hit Rate** | 85-90% | Redis INFO stats |
| **CDN Cache Hit Rate** | 90%+ | CloudFront metrics |
| **WebSocket Latency** | < 100ms | Socket.io metrics |

### 8.2 Scalability Requirements

| Dimension | MVP Target | 6 Months | 12 Months |
|-----------|------------|----------|-----------|
| **Users** | 500 | 5,000 | 10,000 |
| **Posts** | 5,000 | 100,000 | 300,000 |
| **Concurrent Users** | 50 | 200 | 500 |
| **Requests Per Second** | 100 | 400 | 1,000 |
| **Database Size** | 500 MB | 5 GB | 15 GB |
| **Media Storage** | 5 GB | 50 GB | 200 GB |

### 8.3 Availability Requirements

| Component | Target Uptime | Acceptable Downtime/Month | Recovery Time |
|-----------|---------------|---------------------------|---------------|
| **Overall System** | 99.5% | 3 hours 36 minutes | < 15 minutes |
| **API Gateway** | 99.9% | 43 minutes | < 5 minutes |
| **PostgreSQL** | 99.9% | 43 minutes | < 10 minutes |
| **Redis Cache** | 99.5% | 3 hours 36 minutes | < 2 minutes |
| **S3 Storage** | 99.99% | 4 minutes | N/A (AWS SLA) |

**Disaster Recovery:**
- **RTO (Recovery Time Objective):** 15 minutes
- **RPO (Recovery Point Objective):** 5 minutes (data loss tolerance)
- **Backup Frequency:** Every 6 hours (automated)
- **Backup Retention:** 30 days (daily), 365 days (weekly)

### 8.4 Security Requirements

| Requirement | Specification | Validation |
|-------------|--------------|------------|
| **Data Encryption (Transit)** | TLS 1.3 | SSL Labs scan |
| **Data Encryption (Rest)** | AES-256 | AWS/DB config |
| **Password Hashing** | bcrypt (12 rounds) | Unit tests |
| **JWT Signing** | RS256 (2048-bit) | Security audit |
| **XSS Prevention** | DOMPurify + CSP | 30+ test vectors |
| **SQL Injection Prevention** | Parameterized queries | Automated scanning |
| **File Upload Security** | Magic byte + malware scan | Integration tests |
| **Rate Limiting** | 100 req/min per user | Load testing |
| **Audit Logging** | All critical actions | Log review |

### 8.5 Compliance Requirements

| Regulation | Applicable? | Requirements | Implementation |
|------------|-------------|--------------|----------------|
| **GDPR** | ✅ Yes (EU users) | Data portability, right to deletion | Export API, soft delete |
| **CCPA** | ❌ No (non-US business) | N/A | N/A |
| **ePrivacy** | ✅ Yes (cookies) | Cookie consent | Cookie banner |
| **COPPA** | ❌ No (13+ age gate) | N/A | Terms of Service |

**Data Retention Policy:**
- User data: Indefinite (until account deletion)
- Deleted content: 30-day soft delete grace period
- Audit logs: 2 years (moderation), 7 years (compliance)
- Backups: 30 days (daily), 365 days (weekly)

---

## Appendix A: Technology Justification

### Backend: NestJS + TypeScript
**Rationale:**
- Structured, scalable, enterprise-ready
- Dependency injection for testability
- Decorator-based (similar to Spring, .NET)
- TypeScript for type safety
- Large ecosystem (compatible with Express middleware)

**Alternatives Considered:**
- Express.js (too low-level, lacks structure)
- Fastify (faster but smaller ecosystem)
- Django (Python, different stack)

### Database: PostgreSQL 15+
**Rationale:**
- ACID compliance for financial transactions (future)
- JSON support (JSONB for audit logs, metadata)
- Full-text search (built-in)
- Strong replication support
- Mature, battle-tested

**Alternatives Considered:**
- MySQL (weaker JSON support)
- MongoDB (NoSQL, no ACID guarantees)
- CockroachDB (over-engineered for MVP)

### Cache: Redis 7+
**Rationale:**
- In-memory speed (sub-millisecond latency)
- Rich data structures (sorted sets for leaderboards)
- Pub/Sub for real-time events
- Cluster mode for horizontal scaling
- Persistence options (RDB + AOF)

**Alternatives Considered:**
- Memcached (simpler but less features)
- Hazelcast (Java-centric)

### Frontend: React 18 + Vite
**Rationale:**
- Component-based, reusable UI
- Large ecosystem (libraries, tools)
- Virtual DOM for performance
- Server-side rendering capable (future)
- Vite for fast dev experience

**Alternatives Considered:**
- Vue.js (smaller ecosystem)
- Angular (over-engineered for MVP)
- Svelte (smaller community)

---

## Appendix B: Deployment Architecture

### Development Environment
```
Developer Workstation
  ↓
Docker Compose (local)
  ├── API Gateway (port 3000)
  ├── PostgreSQL (port 5432)
  ├── Redis (port 6379)
  └── MinIO (port 9000)
```

### Staging Environment
```
AWS / DigitalOcean
  ↓
Kubernetes Cluster (1 node)
  ├── Namespace: staging
  ├── Ingress: Nginx
  ├── Services: 1 replica each
  ├── PostgreSQL: RDS/Managed DB
  └── Redis: ElastiCache/Managed Redis
```

### Production Environment
```
AWS / DigitalOcean
  ↓
Kubernetes Cluster (3+ nodes, multi-AZ)
  ├── Namespace: production
  ├── Ingress: Nginx + CloudFront CDN
  ├── Services: 2-10 replicas (auto-scale)
  ├── PostgreSQL: RDS Multi-AZ (1 primary, 2 replicas)
  ├── Redis: ElastiCache Cluster (3 shards)
  └── S3: CloudFront CDN + Cross-region replication
```

---

## Appendix C: Architecture Decision Records (ADR)

### ADR-001: Monorepo vs Multi-Repo
**Decision:** Monorepo (single repository)
**Rationale:** Simplifies versioning, atomic commits, easier refactoring
**Alternatives:** Multi-repo (more complex, harder to coordinate)

### ADR-002: Microservices vs Monolith
**Decision:** Modular Monolith (NestJS modules)
**Rationale:** Simpler for MVP, easier deployment, lower operational overhead
**Future:** Migrate to microservices when scaling bottlenecks emerge

### ADR-003: REST vs GraphQL
**Decision:** REST API
**Rationale:** Simpler caching, established tooling, easier to rate-limit
**Alternatives:** GraphQL (over-fetching/under-fetching issues, complexity)

### ADR-004: Session-based vs Token-based Auth
**Decision:** JWT (Token-based)
**Rationale:** Stateless, scalable, works with CDN caching
**Alternatives:** Session-based (requires sticky sessions, Redis dependency)

### ADR-005: SQL vs NoSQL
**Decision:** PostgreSQL (SQL)
**Rationale:** ACID compliance, relational data model fits domain
**Alternatives:** MongoDB (eventual consistency risks, no joins)

---

## Document Control

**Prepared By:** System Architecture Specification Agent
**Reviewed By:** Pending (Tech Lead, Security Team, DevOps Team)
**Approved By:** Pending
**Version:** 1.0.0
**Date:** 2025-12-04
**Next Review:** Upon implementation start (Milestone 1)

**Related Documents:**
- [Feed Performance Optimization](/workspaces/community-social-network/docs/architecture/feed-performance-optimization.md)
- [XSS Prevention Specification](/workspaces/community-social-network/docs/specifications/security/XSS_PREVENTION_SPECIFICATION.md)
- [File Upload Security Specifications](/workspaces/community-social-network/docs/security/FILE_UPLOAD_SECURITY_SPECIFICATIONS.md)
- [Groups RBAC Permission Matrix](/workspaces/community-social-network/docs/specifications/groups-rbac-permission-matrix.md)
- [Executive Summary](/workspaces/community-social-network/docs/EXECUTIVE_SUMMARY.md)

---

**END OF SYSTEM ARCHITECTURE SPECIFICATION**

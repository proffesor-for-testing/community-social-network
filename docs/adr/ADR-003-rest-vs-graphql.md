# ADR-003: REST vs GraphQL

**Status**: Accepted
**Date**: 2025-12-04
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-002 (Modular Monolith)

## Context

The Community Social Network platform requires an API design decision that impacts:

1. **Client Development**: How web and mobile clients consume the API
2. **Caching**: CDN and browser caching strategies
3. **Rate Limiting**: Protecting the API from abuse
4. **Documentation**: API discoverability and developer experience
5. **Performance**: Network efficiency and payload sizes

Key API characteristics for this platform:
- **Read-Heavy**: Feed, profiles, and comments are read frequently
- **Cacheable Resources**: User profiles, post content rarely change
- **Mobile Support**: Future mobile apps need efficient data transfer
- **Rate Limiting**: Different limits for different operations
- **Versioning**: API must evolve without breaking clients

## Decision

We adopt **REST API** design with OpenAPI (Swagger) documentation.

### API Design Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REST API Architecture                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  React Web  │  │  Mobile App │  │  Admin SPA  │  │  3rd Party  │        │
│  │   Client    │  │   (Future)  │  │             │  │   Clients   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                          │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │ HTTPS
┌───────────────────────────────────▼──────────────────────────────────────────┐
│                              CDN (CloudFront)                                │
│                        (Cache GET requests, static assets)                   │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────────┐
│                              API Gateway                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Rate Limiting │ Authentication │ Request Validation │ Logging      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────────┐
│                            REST Endpoints                                    │
│                                                                              │
│  /api/v1/auth/*           - Authentication                                  │
│  /api/v1/users/*          - User profiles                                   │
│  /api/v1/posts/*          - Publications                                    │
│  /api/v1/posts/:id/comments/* - Comments (nested)                           │
│  /api/v1/users/:id/followers/* - Social graph                               │
│  /api/v1/groups/*         - Communities                                     │
│  /api/v1/notifications/*  - Alerts                                          │
│  /api/v1/admin/*          - Administration                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Endpoint Design

```yaml
# OpenAPI 3.0 Specification (excerpt)
openapi: 3.0.0
info:
  title: Community Social Network API
  version: 1.0.0

paths:
  # Authentication
  /api/v1/auth/register:
    post:
      tags: [Authentication]
      summary: Register new user

  /api/v1/auth/login:
    post:
      tags: [Authentication]
      summary: Login with credentials

  # Users & Profiles
  /api/v1/users/{id}:
    get:
      tags: [Users]
      summary: Get user profile
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid

  /api/v1/users/{id}/posts:
    get:
      tags: [Users]
      summary: Get user's posts
      parameters:
        - name: id
          in: path
          required: true
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

  # Feed
  /api/v1/feed:
    get:
      tags: [Feed]
      summary: Get personalized feed
      parameters:
        - name: cursor
          in: query
          description: Pagination cursor
          schema:
            type: string

  # Posts
  /api/v1/posts:
    post:
      tags: [Posts]
      summary: Create new post

  /api/v1/posts/{id}:
    get:
      tags: [Posts]
      summary: Get post by ID
    put:
      tags: [Posts]
      summary: Update post
    delete:
      tags: [Posts]
      summary: Delete post

  # Comments (nested resource)
  /api/v1/posts/{postId}/comments:
    get:
      tags: [Comments]
      summary: Get comments for post
    post:
      tags: [Comments]
      summary: Add comment to post

  # Social Graph
  /api/v1/users/{id}/follow:
    post:
      tags: [Social]
      summary: Follow user
    delete:
      tags: [Social]
      summary: Unfollow user

  /api/v1/users/{id}/followers:
    get:
      tags: [Social]
      summary: Get user's followers

  # Groups
  /api/v1/groups:
    get:
      tags: [Groups]
      summary: List groups
    post:
      tags: [Groups]
      summary: Create group

  /api/v1/groups/{id}/members:
    get:
      tags: [Groups]
      summary: Get group members
    post:
      tags: [Groups]
      summary: Join group
```

### Response Format

```typescript
// Standard success response
interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    cursor?: string;
    hasMore?: boolean;
  };
}

// Standard error response
interface ApiError {
  success: false;
  error: {
    code: string;           // Machine-readable code
    message: string;        // Human-readable message
    details?: unknown;      // Additional context
    timestamp: string;      // ISO timestamp
    requestId: string;      // For debugging
  };
}

// Example responses
// GET /api/v1/users/123
{
  "success": true,
  "data": {
    "id": "123",
    "email": "user@example.com",
    "profile": {
      "displayName": "John Doe",
      "bio": "Software developer",
      "avatarUrl": "https://cdn.example.com/avatars/123.jpg"
    },
    "stats": {
      "followers": 150,
      "following": 75,
      "posts": 42
    }
  }
}

// GET /api/v1/feed?limit=20
{
  "success": true,
  "data": [
    { "id": "post-1", "content": "...", "author": {...} },
    { "id": "post-2", "content": "...", "author": {...} }
  ],
  "meta": {
    "cursor": "eyJpZCI6InBvc3QtMjAifQ==",
    "hasMore": true,
    "limit": 20
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "email": "Must be a valid email address"
    },
    "timestamp": "2025-12-04T10:30:00Z",
    "requestId": "req-abc123"
  }
}
```

### Error Code Catalog

All API errors use machine-readable codes following the pattern `[CONTEXT]_[ERROR_TYPE]`:

| Code | HTTP Status | Description | Context |
|------|-------------|-------------|---------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Email or password incorrect | Identity |
| `AUTH_ACCOUNT_LOCKED` | 423 | Account locked due to failed attempts | Identity |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token has expired | Identity |
| `AUTH_TOKEN_REVOKED` | 401 | Token has been revoked/blacklisted | Identity |
| `AUTH_REFRESH_INVALID` | 401 | Refresh token invalid or expired | Identity |
| `AUTH_2FA_REQUIRED` | 403 | Two-factor authentication required | Admin |
| `AUTH_2FA_INVALID` | 401 | Invalid 2FA code | Admin |
| `VALIDATION_ERROR` | 400 | Request body failed validation | All |
| `VALIDATION_FIELD_REQUIRED` | 400 | Required field missing | All |
| `VALIDATION_FIELD_INVALID` | 400 | Field value does not meet constraints | All |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource does not exist | All |
| `RESOURCE_ALREADY_EXISTS` | 409 | Resource with unique key already exists | All |
| `CONTENT_TOO_LONG` | 400 | Post/comment exceeds maximum length | Content |
| `CONTENT_EMPTY` | 400 | Post/comment content is empty | Content |
| `CONTENT_MAX_DEPTH` | 400 | Comment exceeds max nesting depth (3 levels) | Content |
| `SOCIAL_SELF_ACTION` | 400 | Cannot follow/block yourself | Social Graph |
| `SOCIAL_ALREADY_FOLLOWING` | 409 | Already following this user | Social Graph |
| `SOCIAL_BLOCKED` | 403 | Interaction blocked between users | Social Graph |
| `SOCIAL_FOLLOW_PENDING` | 202 | Follow request pending approval | Social Graph |
| `GROUP_NOT_MEMBER` | 403 | Not a member of this group | Community |
| `GROUP_INSUFFICIENT_ROLE` | 403 | Insufficient role for this action | Community |
| `GROUP_MAX_RULES` | 400 | Group has reached maximum rules (10) | Community |
| `MEDIA_INVALID_TYPE` | 400 | File type not allowed | Profile |
| `MEDIA_TOO_LARGE` | 400 | File exceeds maximum size (10 MB) | Profile |
| `MEDIA_QUOTA_EXCEEDED` | 400 | Storage quota exceeded | Profile |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded for this endpoint | All |
| `PERMISSION_DENIED` | 403 | Insufficient permissions | All |
| `INTERNAL_ERROR` | 500 | Unexpected server error | All |

### Cursor-Based Pagination

The `cursor` value is an opaque, base64-encoded string containing the last item's sort key. Clients MUST NOT parse or construct cursors -- they should only use values returned by the API.

```typescript
// Cursor encoding (internal implementation)
// Cursors are base64-encoded JSON: { id: string, createdAt: string }
const encodeCursor = (id: string, createdAt: Date): string => {
  return Buffer.from(JSON.stringify({ id, createdAt: createdAt.toISOString() })).toString('base64url');
};

const decodeCursor = (cursor: string): { id: string; createdAt: Date } => {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    return { id: decoded.id, createdAt: new Date(decoded.createdAt) };
  } catch {
    throw new ValidationError('Invalid pagination cursor');
  }
};
```

Cursor pagination is used for: `/api/v1/feed`, `/api/v1/users/:id/posts`, `/api/v1/notifications`.
Offset pagination is used for: all other list endpoints.

## Alternatives Considered

### Option A: GraphQL (Rejected)

**Implementation**: Apollo Server with NestJS integration.

```graphql
type Query {
  user(id: ID!): User
  feed(cursor: String, limit: Int): FeedConnection
  post(id: ID!): Post
}

type User {
  id: ID!
  email: String!
  profile: Profile!
  posts(first: Int, after: String): PostConnection!
  followers(first: Int, after: String): UserConnection!
  following(first: Int, after: String): UserConnection!
}

type Post {
  id: ID!
  content: String!
  author: User!
  comments(first: Int, after: String): CommentConnection!
  reactions: ReactionSummary!
}
```

**Pros**:
- Clients request exactly what they need (no over-fetching)
- Single endpoint for all queries
- Strong typing with schema
- Introspection for tooling
- Good for complex, nested data

**Cons**:
- **Caching complexity**: POST requests can't use HTTP caching
- **Rate limiting**: Hard to rate-limit by operation cost
- **N+1 queries**: DataLoader pattern required to avoid performance issues
- **Complexity**: Resolver chains, schema stitching, persisted queries
- **Learning curve**: Team less familiar with GraphQL
- **Security**: Query depth attacks, introspection exposure

**Why Rejected**:
- **Caching**: Feed and profiles benefit greatly from CDN caching (GET requests)
- **Rate limiting**: Different endpoints need different limits (login vs feed)
- **Team expertise**: REST is well-understood by the team
- **Simplicity**: MVP doesn't need GraphQL flexibility
- **N+1 risk**: Feed queries could easily trigger N+1 without careful optimization

### Option B: gRPC (Rejected)

**Pros**:
- High performance binary protocol
- Strong typing with Protocol Buffers
- Bidirectional streaming

**Cons**:
- Browser support requires gRPC-Web proxy
- Less human-readable for debugging
- Overkill for web-focused application

**Why Rejected**: Not suitable for browser-based web applications without additional infrastructure.

## Consequences

### Positive

- **HTTP Caching**: GET requests cacheable at CDN and browser level
- **Simple Rate Limiting**: Per-endpoint rate limits easy to implement
- **Established Tooling**: Swagger UI, Postman, curl work out of the box
- **Team Familiarity**: REST is well-understood pattern
- **Debugging**: Human-readable payloads easy to inspect
- **Versioning**: URL-based versioning (/api/v1/, /api/v2/)
- **Documentation**: OpenAPI generates interactive documentation

### Negative

- **Over-fetching**: Clients may receive more data than needed
- **Multiple Requests**: Complex views require multiple API calls
- **Endpoint Proliferation**: May need many endpoints for different use cases

### Mitigation Strategies

| Risk | Mitigation |
|------|------------|
| Over-fetching | Use `fields` query param for sparse fieldsets |
| Multiple requests | Batch endpoints for common patterns (e.g., /feed includes author) |
| Endpoint proliferation | Follow REST conventions strictly; use query params for variations |

### Sparse Fieldsets (Optional Enhancement)

```
GET /api/v1/users/123?fields=id,profile.displayName,stats.followers

Response:
{
  "success": true,
  "data": {
    "id": "123",
    "profile": {
      "displayName": "John Doe"
    },
    "stats": {
      "followers": 150
    }
  }
}
```

## HTTP Caching Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Caching Headers by Endpoint                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Endpoint                    │ Cache-Control                 │ Rationale    │
│  ────────────────────────────┼───────────────────────────────┼────────────  │
│  GET /api/v1/users/:id       │ private, max-age=60           │ User-specific│
│  GET /api/v1/posts/:id       │ public, max-age=300           │ Shareable    │
│  GET /api/v1/feed            │ private, no-store             │ Personalized │
│  GET /api/v1/groups          │ public, max-age=3600          │ Rarely change│
│  POST/PUT/DELETE             │ no-store                      │ Mutations    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Rate Limiting Configuration

```typescript
// Rate limits per endpoint category
const rateLimits = {
  // Authentication - strict limits
  '/api/v1/auth/login': { windowMs: 15 * 60 * 1000, max: 5 },
  '/api/v1/auth/register': { windowMs: 60 * 60 * 1000, max: 3 },

  // Read operations - generous limits
  '/api/v1/users/*': { windowMs: 60 * 1000, max: 100 },
  '/api/v1/posts/*': { windowMs: 60 * 1000, max: 100 },
  '/api/v1/feed': { windowMs: 60 * 1000, max: 60 },

  // Write operations - moderate limits
  '/api/v1/posts': { windowMs: 60 * 1000, max: 10 },
  '/api/v1/comments': { windowMs: 60 * 1000, max: 30 },

  // Social actions - prevent spam
  '/api/v1/*/follow': { windowMs: 60 * 1000, max: 30 },
  '/api/v1/*/react': { windowMs: 60 * 1000, max: 60 },
};

// Per-user rate limiting (authenticated requests)
// Applied in addition to per-IP limits
const perUserRateLimits = {
  // Write operations per authenticated user
  'POST /api/v1/posts': { windowMs: 60 * 1000, max: 5 },        // 5 posts per minute
  'POST /api/v1/*/comments': { windowMs: 60 * 1000, max: 15 },  // 15 comments per minute
  'POST /api/v1/*/follow': { windowMs: 60 * 1000, max: 20 },    // 20 follows per minute
  'POST /api/v1/*/react': { windowMs: 60 * 1000, max: 30 },     // 30 reactions per minute
  'POST /api/v1/groups': { windowMs: 3600 * 1000, max: 5 },     // 5 groups per hour
};

// Rate limit response headers
// X-RateLimit-Limit: Maximum requests allowed
// X-RateLimit-Remaining: Requests remaining in window
// X-RateLimit-Reset: UTC epoch time when window resets
// Retry-After: Seconds until rate limit resets (only on 429)
```

## References

- REST API Design Guidelines: https://restfulapi.net/
- OpenAPI Specification: https://swagger.io/specification/
- HTTP Caching: https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching
- NestJS OpenAPI: https://docs.nestjs.com/openapi/introduction
- System Architecture Specification: `docs/architecture/SYSTEM_ARCHITECTURE_SPECIFICATION.md`

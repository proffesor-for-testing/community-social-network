# M1 Authentication System - Architecture Design

**Version:** 1.0.0
**Phase:** SPARC Phase 3 (Architecture)
**Module:** Authentication & Security
**Last Updated:** 2025-12-16
**Status:** ARCHITECTURE DRAFT

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Sequence Diagrams](#sequence-diagrams)
4. [Database Schema](#database-schema)
5. [API Contract Definitions](#api-contract-definitions)
6. [Security Architecture](#security-architecture)
7. [Integration Points](#integration-points)
8. [Technology Stack](#technology-stack)
9. [Performance & Complexity Analysis](#performance--complexity-analysis)
10. [Deployment Architecture](#deployment-architecture)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  (Web App, Mobile App, API Clients)                             │
└────────────┬────────────────────────────────────────────────────┘
             │ HTTPS/TLS 1.3
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│  - Rate Limiting (Redis)                                        │
│  - Request Validation                                           │
│  - CORS Handling                                                │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Authentication Service                         │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Auth Controller │  │ Token Manager│  │ Email Service│      │
│  └────────┬────────┘  └──────┬───────┘  └──────┬───────┘      │
│           │                   │                  │              │
│  ┌────────▼───────────────────▼──────────────────▼────────┐    │
│  │           Authentication Business Logic                 │    │
│  │  - Registration  - Login  - Password Reset              │    │
│  │  - Token Management  - Rate Limiting                    │    │
│  └────────┬────────────────────┬─────────────────┬────────┘    │
└───────────┼────────────────────┼─────────────────┼─────────────┘
            │                    │                 │
            ▼                    ▼                 ▼
┌───────────────────┐  ┌─────────────────┐  ┌──────────────┐
│   PostgreSQL      │  │   Redis Cache   │  │Email Provider│
│  - User Table     │  │  - Rate Limits  │  │ (SendGrid/   │
│  - Tokens Table   │  │  - Lockouts     │  │  AWS SES)    │
│  - Audit Logs     │  │  - Sessions     │  │              │
└───────────────────┘  └─────────────────┘  └──────────────┘
```

### Design Principles

1. **Security First**: All authentication flows use industry-standard cryptography
2. **Defense in Depth**: Multiple layers of protection (rate limiting, account lockout, token expiry)
3. **Stateless Authentication**: JWT tokens enable horizontal scaling
4. **Audit Trail**: All authentication events logged for security analysis
5. **Fail Secure**: Default to denying access on errors

---

## Component Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Authentication Service                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Auth Controller                         │  │
│  │  - POST /auth/register                                    │  │
│  │  - POST /auth/login                                       │  │
│  │  - POST /auth/refresh                                     │  │
│  │  - POST /auth/logout                                      │  │
│  │  - POST /auth/verify-email                                │  │
│  │  - POST /auth/request-password-reset                      │  │
│  │  - POST /auth/reset-password                              │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │              Authentication Manager                       │  │
│  │  - validateCredentials()                                  │  │
│  │  - createUser()                                           │  │
│  │  - hashPassword()                                         │  │
│  │  - verifyPassword()                                       │  │
│  │  - handleFailedLogin()                                    │  │
│  │  - checkAccountLockout()                                  │  │
│  └────────────┬─────────────────────┬──────────────────────┘  │
│               │                     │                          │
│  ┌────────────▼──────────┐  ┌──────▼──────────────────────┐  │
│  │   Token Manager       │  │   Rate Limiter               │  │
│  │  - generateJWT()      │  │  - checkRateLimit()          │  │
│  │  - verifyJWT()        │  │  - incrementCounter()        │  │
│  │  - refreshToken()     │  │  - getWindowKey()            │  │
│  │  - revokeToken()      │  │  - checkAccountLockout()     │  │
│  │  - cleanupExpired()   │  │  - setLockout()              │  │
│  └────────────┬──────────┘  └──────┬──────────────────────┘  │
│               │                     │                          │
│  ┌────────────▼─────────────────────▼──────────────────────┐  │
│  │              Data Access Layer                            │  │
│  │  - UserRepository                                         │  │
│  │  - TokenRepository                                        │  │
│  │  - AuditLogRepository                                     │  │
│  │  - RedisClient                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### 1. Auth Controller
- **Purpose**: HTTP request handling and response formatting
- **Technology**: Express.js/Fastify with TypeScript
- **Responsibilities**:
  - Request validation using Joi/Zod schemas
  - Input sanitization
  - HTTP response formatting
  - Error handling and status codes
  - Request logging

#### 2. Authentication Manager
- **Purpose**: Core authentication business logic
- **Responsibilities**:
  - User registration workflow
  - Login credential verification
  - Password hashing (bcrypt, cost factor 12)
  - Failed login tracking
  - Account lockout enforcement
  - Email verification coordination

#### 3. Token Manager
- **Purpose**: JWT lifecycle management
- **Technology**: jsonwebtoken library
- **Responsibilities**:
  - Access token generation (15 min expiry)
  - Refresh token generation (7 day expiry)
  - Token validation and verification
  - Token revocation
  - Expired token cleanup
- **Complexity**: O(1) for token validation

#### 4. Rate Limiter
- **Purpose**: Prevent abuse and brute-force attacks
- **Technology**: Redis with sliding window algorithm
- **Responsibilities**:
  - IP-based rate limiting
  - Account-based rate limiting
  - Global endpoint rate limiting
  - Sliding window implementation
- **Complexity**: O(log n) for rate limit checks using Redis Sorted Sets

#### 5. Email Service
- **Purpose**: Transactional email delivery
- **Technology**: SendGrid/AWS SES
- **Responsibilities**:
  - Verification email sending
  - Password reset email sending
  - Template management
  - Retry logic for failed sends
  - Email delivery tracking

#### 6. Data Access Layer
- **Purpose**: Database abstraction
- **Technology**: Prisma ORM / TypeORM
- **Responsibilities**:
  - SQL query generation
  - Connection pooling
  - Transaction management
  - Data mapping
  - Migration management

---

## Sequence Diagrams

### 1. User Registration Flow

```
Client          Controller      AuthManager     TokenManager    EmailService    Database    Redis
  │                 │                │                │               │            │          │
  │─Register────────▶│                │                │               │            │          │
  │ (email,pwd)     │                │                │               │            │          │
  │                 │                │                │               │            │          │
  │                 │─Check Rate─────┼────────────────┼───────────────┼────────────┼─────────▶│
  │                 │  Limit         │                │               │            │          │
  │                 │◀───────────────┼────────────────┼───────────────┼────────────┼──────────┤
  │                 │  OK            │                │               │            │          │
  │                 │                │                │               │            │          │
  │                 │─Validate───────▶│                │               │            │          │
  │                 │  Input         │                │               │            │          │
  │                 │◀───────────────┤                │               │            │          │
  │                 │                │                │               │            │          │
  │                 │                │─Check Email────┼───────────────┼───────────▶│          │
  │                 │                │  Exists        │               │            │          │
  │                 │                │◀───────────────┼───────────────┼────────────┤          │
  │                 │                │  Not Found     │               │            │          │
  │                 │                │                │               │            │          │
  │                 │                │─Hash Password──┤               │            │          │
  │                 │                │  (bcrypt,12)   │               │            │          │
  │                 │                │◀───────────────┤               │            │          │
  │                 │                │  passwordHash  │               │            │          │
  │                 │                │                │               │            │          │
  │                 │                │─Generate───────▶│               │            │          │
  │                 │                │  VerifyToken   │               │            │          │
  │                 │                │◀───────────────┤               │            │          │
  │                 │                │  token         │               │            │          │
  │                 │                │                │               │            │          │
  │                 │                │─Create User────┼───────────────┼───────────▶│          │
  │                 │                │  (transaction) │               │            │          │
  │                 │                │◀───────────────┼───────────────┼────────────┤          │
  │                 │                │  user          │               │            │          │
  │                 │                │                │               │            │          │
  │                 │                │─Send Email─────┼───────────────▶│            │          │
  │                 │                │  Verification  │               │            │          │
  │                 │                │                │               │            │          │
  │                 │◀───────────────┤                │               │            │          │
  │                 │  user          │                │               │            │          │
  │◀Success─────────┤                │                │               │            │          │
  │ {user,message}  │                │                │               │            │          │
```

### 2. User Login Flow

```
Client          Controller      AuthManager     TokenManager    Database    Redis
  │                 │                │                │            │          │
  │─Login───────────▶│                │                │            │          │
  │ (email,pwd)     │                │                │            │          │
  │                 │                │                │            │          │
  │                 │─Check Rate─────┼────────────────┼────────────┼─────────▶│
  │                 │  Limit         │                │            │          │
  │                 │◀───────────────┼────────────────┼────────────┼──────────┤
  │                 │  OK            │                │            │          │
  │                 │                │                │            │          │
  │                 │─Check Lockout──┼────────────────┼────────────┼─────────▶│
  │                 │◀───────────────┼────────────────┼────────────┼──────────┤
  │                 │  Not Locked    │                │            │          │
  │                 │                │                │            │          │
  │                 │─Find User──────▶│                │            │          │
  │                 │                │─Query──────────┼───────────▶│          │
  │                 │                │◀───────────────┼────────────┤          │
  │                 │                │  user          │            │          │
  │                 │                │                │            │          │
  │                 │                │─Verify Password│            │          │
  │                 │                │  (bcrypt)      │            │          │
  │                 │                │◀───────────────┤            │          │
  │                 │                │                │            │          │
  │                 │                │───[IF FAIL]────┼───────────▶│          │
  │                 │                │   Increment    │ UPDATE     │          │
  │                 │                │   FailCount    │ failedAttempts        │
  │                 │                │                │            │          │
  │                 │                │───[IF 5 FAILS]─┼────────────┼─────────▶│
  │                 │                │   Set Lockout  │            │ SET lockout
  │                 │                │                │            │          │
  │                 │                │───[IF SUCCESS]─┼───────────▶│          │
  │                 │                │   Reset Fails  │ UPDATE=0   │          │
  │                 │                │                │            │          │
  │                 │                │─Generate───────▶│            │          │
  │                 │                │  Tokens        │            │          │
  │                 │                │                │            │          │
  │                 │                │                │─Save───────▶│          │
  │                 │                │                │  Refresh   │          │
  │                 │                │◀───────────────┤  Token     │          │
  │                 │                │  {access,      │            │          │
  │                 │◀───────────────┤   refresh}     │            │          │
  │◀Success─────────┤                │                │            │          │
  │ {tokens,user}   │                │                │            │          │
```

### 3. Token Refresh Flow

```
Client          Controller      TokenManager    Database    Redis
  │                 │                │            │          │
  │─Refresh─────────▶│                │            │          │
  │ (refreshToken)  │                │            │          │
  │                 │                │            │          │
  │                 │─Verify Token───▶│            │          │
  │                 │                │            │          │
  │                 │                │─Validate───▶│          │
  │                 │                │  Signature  │          │
  │                 │                │◀────────────┤          │
  │                 │                │  Valid      │          │
  │                 │                │             │          │
  │                 │                │─Check Token─▶│          │
  │                 │                │  Revoked    │          │
  │                 │                │◀────────────┤          │
  │                 │                │  Active     │          │
  │                 │                │             │          │
  │                 │                │─Update──────▶│          │
  │                 │                │  LastUsed   │          │
  │                 │                │             │          │
  │                 │                │─Generate────┤          │
  │                 │                │  New Access │          │
  │                 │◀───────────────┤  Token      │          │
  │◀Success─────────┤                │             │          │
  │ {accessToken}   │                │             │          │
```

### 4. Password Reset Flow

```
Client          Controller      AuthManager     EmailService    Database    Redis
  │                 │                │               │            │          │
  │─Request Reset───▶│                │               │            │          │
  │ (email)         │                │               │            │          │
  │                 │                │               │            │          │
  │                 │─Check Rate─────┼───────────────┼────────────┼─────────▶│
  │                 │  Limit         │               │            │          │
  │                 │◀───────────────┼───────────────┼────────────┼──────────┤
  │                 │                │               │            │          │
  │                 │─Find User──────▶│               │            │          │
  │                 │                │─Query─────────┼───────────▶│          │
  │                 │                │◀──────────────┼────────────┤          │
  │                 │                │  user         │            │          │
  │                 │                │               │            │          │
  │                 │                │─Generate──────┤            │          │
  │                 │                │  Reset Token  │            │          │
  │                 │                │               │            │          │
  │                 │                │─Save Token────┼───────────▶│          │
  │                 │                │  (hashed)     │            │          │
  │                 │                │               │            │          │
  │                 │                │─Send Email────▶│            │          │
  │                 │◀───────────────┤               │            │          │
  │◀Success─────────┤                │               │            │          │
  │                 │                │               │            │          │
  │─Reset Password──▶│                │               │            │          │
  │ (token,newPwd)  │                │               │            │          │
  │                 │                │               │            │          │
  │                 │─Verify Token───▶│               │            │          │
  │                 │                │─Query Token───┼───────────▶│          │
  │                 │                │◀──────────────┼────────────┤          │
  │                 │                │  Valid        │            │          │
  │                 │                │               │            │          │
  │                 │                │─Hash New──────┤            │          │
  │                 │                │  Password     │            │          │
  │                 │                │               │            │          │
  │                 │                │─Update────────┼───────────▶│          │
  │                 │                │  Password     │            │          │
  │                 │                │─Clear Token───┼───────────▶│          │
  │                 │                │               │            │          │
  │                 │                │─Revoke All────┼───────────▶│          │
  │                 │                │  Tokens       │            │          │
  │                 │◀───────────────┤               │            │          │
  │◀Success─────────┤                │               │            │          │
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         users                                │
├─────────────────────────────────────────────────────────────┤
│ PK  id                      SERIAL                          │
│ UQ  email                   VARCHAR(255)                    │
│     password_hash           VARCHAR(255)                    │
│     email_verified          BOOLEAN (default: false)        │
│ IDX email_verification_token VARCHAR(64) NULLABLE          │
│     email_verification_expiry TIMESTAMP NULLABLE           │
│ IDX password_reset_token    VARCHAR(64) NULLABLE           │
│     password_reset_expiry   TIMESTAMP NULLABLE             │
│     account_locked          BOOLEAN (default: false)        │
│     lockout_expiry          TIMESTAMP NULLABLE             │
│     failed_login_attempts   INTEGER (default: 0)           │
│     last_failed_login       TIMESTAMP NULLABLE             │
│     created_at              TIMESTAMP (default: NOW())      │
│     updated_at              TIMESTAMP (default: NOW())      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ 1:N
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    refresh_tokens                            │
├─────────────────────────────────────────────────────────────┤
│ PK  id                      SERIAL                          │
│ FK  user_id                 INTEGER → users.id              │
│ IDX token_hash              VARCHAR(64) UNIQUE              │
│     expires_at              TIMESTAMP                        │
│     is_revoked              BOOLEAN (default: false)        │
│     created_at              TIMESTAMP (default: NOW())      │
│     last_used_at            TIMESTAMP (default: NOW())      │
│     ip_address              INET                            │
│     user_agent              TEXT                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    audit_logs                                │
├─────────────────────────────────────────────────────────────┤
│ PK  id                      BIGSERIAL                       │
│ FK  user_id                 INTEGER → users.id NULLABLE     │
│ IDX event_type              VARCHAR(100)                    │
│     resource_type           VARCHAR(100)                    │
│     resource_id             INTEGER NULLABLE                │
│     ip_address              INET                            │
│     user_agent              TEXT                            │
│     metadata                JSONB                           │
│ IDX created_at              TIMESTAMP (default: NOW())      │
└─────────────────────────────────────────────────────────────┘
```

### SQL Schema Definition

```sql
-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT false NOT NULL,
    email_verification_token VARCHAR(64),
    email_verification_expiry TIMESTAMP,
    password_reset_token VARCHAR(64),
    password_reset_expiry TIMESTAMP,
    account_locked BOOLEAN DEFAULT false NOT NULL,
    lockout_expiry TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0 NOT NULL,
    last_failed_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for performance optimization
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token)
    WHERE email_verification_token IS NOT NULL;

CREATE INDEX idx_users_password_reset_token ON users(password_reset_token)
    WHERE password_reset_token IS NOT NULL;

CREATE INDEX idx_users_email_verified ON users(email_verified);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Refresh Tokens Table
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT
);

-- Indexes for token validation (O(1) lookup)
CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens(user_id, is_revoked)
    WHERE is_revoked = false;

CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)
    WHERE is_revoked = false;

-- Audit Logs Table (for security monitoring)
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INTEGER,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for audit analysis
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Partitioning for audit logs (performance at scale)
-- Partition by month for efficient archival
CREATE TABLE audit_logs_2025_12 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Add constraint to prevent future logins after password reset
ALTER TABLE users
    ADD CONSTRAINT chk_lockout_expiry_future
    CHECK (lockout_expiry IS NULL OR lockout_expiry > created_at);
```

### Redis Data Structures

```
# Rate Limit Counters (Sliding Window)
Key Pattern: ratelimit:{type}:{identifier}:{endpoint}:{window}
Type: Sorted Set
TTL: 2 × window_size

Example:
  Key: ratelimit:ip:192.168.1.100:auth/login:1702742400
  Value: ZADD with timestamp scores
  TTL: 7200 seconds (2 hours for 1-hour window)

# Account Lockout Status
Key Pattern: lockout:account:{user_id}
Type: String (JSON)
Value: {"lockedUntil": 1702756800, "reason": "brute_force", "attempts": 5}
TTL: lockout_duration (1800 seconds = 30 min)

# Email Verification Tracking
Key Pattern: verify:pending:{user_id}
Type: String
Value: {token_hash}
TTL: 86400 seconds (24 hours)

# Session Cache (Optional Performance Optimization)
Key Pattern: session:{user_id}
Type: Hash
Fields: {id, email, roles, email_verified}
TTL: 900 seconds (15 min - matches access token expiry)
```

---

## API Contract Definitions

### Base Configuration

```yaml
openapi: 3.0.0
info:
  title: Authentication API
  version: 1.0.0
  description: Secure authentication and authorization service

servers:
  - url: https://api.community-network.com/v1
    description: Production
  - url: https://staging-api.community-network.com/v1
    description: Staging
  - url: http://localhost:3000/v1
    description: Local development

security:
  - bearerAuth: []
```

### 1. User Registration

```yaml
/auth/register:
  post:
    summary: Register a new user account
    operationId: registerUser
    tags: [Authentication]
    security: []

    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [email, password]
            properties:
              email:
                type: string
                format: email
                example: "user@example.com"
              password:
                type: string
                format: password
                minLength: 8
                example: "SecureP@ss123"

    responses:
      201:
        description: User registered successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
                message:
                  type: string
                  example: "Registration successful. Please check your email."
                data:
                  type: object
                  properties:
                    userId:
                      type: integer
                      example: 42
                    email:
                      type: string
                      example: "user@example.com"

      400:
        description: Invalid input
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
            examples:
              weak_password:
                value:
                  success: false
                  error: "PASSWORD_WEAK"
                  message: "Password must contain uppercase, lowercase, number, and special char."
              email_exists:
                value:
                  success: false
                  error: "EMAIL_EXISTS"
                  message: "Email already registered."

      429:
        description: Rate limit exceeded
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
            example:
              success: false
              error: "RATE_LIMIT_EXCEEDED"
              message: "Too many registration attempts. Try again later."
              retryAfter: 3600
```

### 2. User Login

```yaml
/auth/login:
  post:
    summary: Authenticate user and receive tokens
    operationId: loginUser
    tags: [Authentication]
    security: []

    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [email, password]
            properties:
              email:
                type: string
                format: email
              password:
                type: string
                format: password

    responses:
      200:
        description: Login successful
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
                data:
                  type: object
                  properties:
                    accessToken:
                      type: string
                      description: "JWT access token (15 min expiry)"
                      example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
                    refreshToken:
                      type: string
                      description: "Refresh token (7 day expiry)"
                      example: "550e8400-e29b-41d4-a716-446655440000"
                    expiresIn:
                      type: integer
                      description: "Access token TTL in seconds"
                      example: 900
                    user:
                      $ref: '#/components/schemas/User'

      401:
        description: Authentication failed
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
            examples:
              invalid_credentials:
                value:
                  success: false
                  error: "INVALID_CREDENTIALS"
                  message: "Invalid email or password."
              email_not_verified:
                value:
                  success: false
                  error: "EMAIL_NOT_VERIFIED"
                  message: "Please verify your email before logging in."

      423:
        description: Account locked
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
            example:
              success: false
              error: "ACCOUNT_LOCKED"
              message: "Account locked due to too many failed login attempts."
              lockedUntil: "2025-12-16T14:30:00Z"
```

### 3. Token Refresh

```yaml
/auth/refresh:
  post:
    summary: Refresh access token using refresh token
    operationId: refreshToken
    tags: [Authentication]
    security: []

    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [refreshToken]
            properties:
              refreshToken:
                type: string

    responses:
      200:
        description: Token refreshed successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
                data:
                  type: object
                  properties:
                    accessToken:
                      type: string
                    expiresIn:
                      type: integer
                      example: 900

      401:
        description: Invalid or expired refresh token
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
            example:
              success: false
              error: "INVALID_REFRESH_TOKEN"
              message: "Refresh token is invalid or expired."
```

### 4. Email Verification

```yaml
/auth/verify-email:
  post:
    summary: Verify email address using verification token
    operationId: verifyEmail
    tags: [Authentication]
    security: []

    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [token]
            properties:
              token:
                type: string
                description: "Email verification token from email"

    responses:
      200:
        description: Email verified successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
                message:
                  type: string
                  example: "Email verified successfully. You can now log in."

      400:
        description: Invalid or expired token
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
```

### 5. Password Reset Request

```yaml
/auth/request-password-reset:
  post:
    summary: Request password reset email
    operationId: requestPasswordReset
    tags: [Authentication]
    security: []

    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [email]
            properties:
              email:
                type: string
                format: email

    responses:
      200:
        description: Password reset email sent (always returns 200 to prevent email enumeration)
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
                message:
                  type: string
                  example: "If the email exists, a password reset link has been sent."
```

### 6. Password Reset Confirmation

```yaml
/auth/reset-password:
  post:
    summary: Reset password using reset token
    operationId: resetPassword
    tags: [Authentication]
    security: []

    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [token, newPassword]
            properties:
              token:
                type: string
              newPassword:
                type: string
                format: password
                minLength: 8

    responses:
      200:
        description: Password reset successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
                message:
                  type: string
                  example: "Password reset successfully. You can now log in."
```

### Component Schemas

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
          example: 42
        email:
          type: string
          format: email
          example: "user@example.com"
        emailVerified:
          type: boolean
          example: true
        createdAt:
          type: string
          format: date-time
          example: "2025-12-16T10:00:00Z"

    Error:
      type: object
      required: [success, error, message]
      properties:
        success:
          type: boolean
          example: false
        error:
          type: string
          example: "INVALID_INPUT"
        message:
          type: string
          example: "Invalid email format."
        details:
          type: object
          description: "Additional error context (optional)"
```

---

## Security Architecture

### 1. Password Security

```yaml
password_hashing:
  algorithm: bcrypt
  cost_factor: 12

  rationale: |
    - Bcrypt is specifically designed for password hashing
    - Cost factor 12 provides ~300ms hashing time (prevents brute force)
    - Automatically handles salting
    - Resistant to rainbow table attacks

  implementation:
    library: bcrypt.js (Node.js) or bcrypt (Python)
    code_example: |
      import bcrypt from 'bcryptjs';

      // Hashing
      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(password, salt);

      // Verification
      const isValid = await bcrypt.compare(password, hash);

  complexity: O(2^12) iterations for security
  time_cost: ~300ms per hash (intentional slowdown)

password_requirements:
  min_length: 8
  required_characters:
    - uppercase: true
    - lowercase: true
    - digits: true
    - special_chars: true

  validation_regex: |
    ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$
```

### 2. Token Security

```yaml
jwt_configuration:
  access_token:
    algorithm: RS256
    expiry: 15 minutes (900 seconds)
    payload:
      - userId: integer
      - email: string
      - emailVerified: boolean
      - iat: timestamp (issued at)
      - exp: timestamp (expiry)

    signing:
      key_type: RSA private key (2048-bit minimum)
      key_storage: Environment variable or secrets manager

    verification:
      key_type: RSA public key
      complexity: O(1) for signature validation

  refresh_token:
    type: Random UUID v4 (128-bit)
    expiry: 7 days (604800 seconds)
    storage: PostgreSQL (hashed with SHA-256)
    rotation: Generate new on each refresh

    security_features:
      - Stored as SHA-256 hash in database
      - Includes IP address and user agent
      - Can be revoked individually
      - Automatic cleanup of expired tokens

  implementation:
    library: jsonwebtoken (Node.js) or PyJWT (Python)
    code_example: |
      import jwt from 'jsonwebtoken';
      import crypto from 'crypto';

      // Generate Access Token
      const accessToken = jwt.sign(
        { userId, email, emailVerified },
        process.env.JWT_PRIVATE_KEY,
        { algorithm: 'RS256', expiresIn: '15m' }
      );

      // Generate Refresh Token
      const refreshToken = crypto.randomUUID();
      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      // Verify Access Token
      const payload = jwt.verify(
        token,
        process.env.JWT_PUBLIC_KEY,
        { algorithms: ['RS256'] }
      );
```

### 3. Rate Limiting Architecture

```yaml
rate_limiting:
  strategy: Sliding Window (Redis Sorted Sets)

  limits:
    registration:
      - type: ip
        limit: 5 requests
        window: 3600 seconds (1 hour)

      - type: global
        limit: 100 requests
        window: 3600 seconds (1 hour)

    login:
      - type: ip
        limit: 10 requests
        window: 900 seconds (15 min)

      - type: account
        limit: 5 requests
        window: 900 seconds (15 min)

    password_reset:
      - type: ip
        limit: 3 requests
        window: 3600 seconds (1 hour)

      - type: account
        limit: 3 requests
        window: 3600 seconds (1 hour)

  implementation:
    redis_structure: Sorted Set
    key_pattern: "ratelimit:{type}:{id}:{endpoint}"

    algorithm: |
      1. Get current timestamp
      2. Remove entries older than window
      3. Count remaining entries
      4. If count >= limit, reject
      5. Add current timestamp to sorted set
      6. Set TTL to 2 × window (for cleanup)

    complexity: O(log n) for ZADD and ZREMRANGEBYSCORE

    code_example: |
      async function checkRateLimit(type, identifier, endpoint, limit, window) {
        const key = `ratelimit:${type}:${identifier}:${endpoint}`;
        const now = Date.now();
        const windowStart = now - (window * 1000);

        // Remove old entries
        await redis.zremrangebyscore(key, 0, windowStart);

        // Count current requests
        const count = await redis.zcard(key);

        if (count >= limit) {
          return { allowed: false, retryAfter: window };
        }

        // Add current request
        await redis.zadd(key, now, `${now}-${crypto.randomUUID()}`);
        await redis.expire(key, window * 2);

        return { allowed: true, remaining: limit - count - 1 };
      }
```

### 4. Account Lockout Protection

```yaml
account_lockout:
  trigger:
    failed_attempts: 5
    window: 900 seconds (15 minutes)

  lockout_duration: 1800 seconds (30 minutes)

  storage:
    primary: Redis (fast access)
    backup: PostgreSQL users table (persistence)

  reset_conditions:
    - Successful login
    - Password reset completion
    - Manual admin unlock
    - Lockout expiry timeout

  implementation:
    code_example: |
      async function handleFailedLogin(userId) {
        // Increment counter in database
        const user = await db.users.increment(
          { failedLoginAttempts: 1, lastFailedLogin: new Date() },
          { where: { id: userId } }
        );

        if (user.failedLoginAttempts >= 5) {
          const lockoutUntil = Date.now() + (30 * 60 * 1000);

          // Lock account in database
          await db.users.update(
            { accountLocked: true, lockoutExpiry: new Date(lockoutUntil) },
            { where: { id: userId } }
          );

          // Set lockout in Redis
          await redis.setex(
            `lockout:account:${userId}`,
            1800,
            JSON.stringify({
              lockedUntil: lockoutUntil,
              reason: 'brute_force',
              attempts: user.failedLoginAttempts
            })
          );

          throw new AccountLockedError(lockoutUntil);
        }
      }
```

### 5. Encryption Standards

```yaml
encryption:
  at_rest:
    database:
      method: PostgreSQL native encryption (AES-256)
      scope: Entire database volume

    sensitive_fields:
      method: Application-level encryption
      algorithm: AES-256-GCM
      fields:
        - password_reset_token (SHA-256 hash)
        - email_verification_token (SHA-256 hash)
        - refresh_token (SHA-256 hash)

  in_transit:
    api_layer:
      protocol: TLS 1.3
      cipher_suites:
        - TLS_AES_256_GCM_SHA384
        - TLS_CHACHA20_POLY1305_SHA256
      certificate: Let's Encrypt (auto-renewal)

    database_connection:
      protocol: TLS 1.2+
      verify_server_cert: true

  token_storage:
    method: SHA-256 hashing (one-way)
    rationale: |
      - Prevents token theft from database breach
      - Tokens stored as hashes, not plaintext
      - Original tokens never recoverable
```

### 6. Security Headers

```yaml
http_security_headers:
  Strict-Transport-Security:
    value: "max-age=31536000; includeSubDomains; preload"
    purpose: Force HTTPS for all requests

  X-Content-Type-Options:
    value: "nosniff"
    purpose: Prevent MIME type sniffing

  X-Frame-Options:
    value: "DENY"
    purpose: Prevent clickjacking

  Content-Security-Policy:
    value: "default-src 'self'; script-src 'self'; object-src 'none'"
    purpose: Prevent XSS attacks

  X-XSS-Protection:
    value: "1; mode=block"
    purpose: Enable browser XSS filter

  Referrer-Policy:
    value: "strict-origin-when-cross-origin"
    purpose: Control referrer information
```

---

## Integration Points

### 1. Email Service Integration

```yaml
email_service:
  provider: SendGrid / AWS SES

  configuration:
    sendgrid:
      library: "@sendgrid/mail"
      api_key: env.SENDGRID_API_KEY
      from_email: "noreply@community-network.com"
      from_name: "Community Network"

    aws_ses:
      library: "@aws-sdk/client-ses"
      region: "us-east-1"
      credentials: IAM role or access keys

  email_templates:
    email_verification:
      subject: "Verify your email address"
      template_id: "d-xxxxxxxxxxxxxxx"
      dynamic_data:
        - verification_link: string
        - user_email: string

    password_reset:
      subject: "Reset your password"
      template_id: "d-yyyyyyyyyyyyyyy"
      dynamic_data:
        - reset_link: string
        - expiry_time: string (1 hour)

  retry_strategy:
    max_attempts: 3
    backoff: exponential (1s, 2s, 4s)
    fallback: Log to dead letter queue

  integration_example: |
    import sgMail from '@sendgrid/mail';

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    async function sendVerificationEmail(email, token) {
      const msg = {
        to: email,
        from: 'noreply@community-network.com',
        templateId: 'd-xxxxxxxxxxxxxxx',
        dynamicTemplateData: {
          verification_link: `https://app.community-network.com/verify?token=${token}`,
          user_email: email
        }
      };

      await sgMail.send(msg);
    }
```

### 2. Logging & Monitoring Integration

```yaml
logging:
  provider: Winston + ELK Stack (Elasticsearch, Logstash, Kibana)

  log_levels:
    error: Authentication failures, system errors
    warn: Rate limit hits, suspicious activity
    info: Successful logins, registrations
    debug: Token generation, validation steps

  structured_logging:
    format: JSON
    fields:
      - timestamp: ISO 8601
      - level: string
      - service: "auth-service"
      - userId: integer (nullable)
      - ip: string
      - endpoint: string
      - duration: number (ms)
      - statusCode: number

  audit_events:
    - user.registered
    - user.login.success
    - user.login.failed
    - user.logout
    - token.refreshed
    - password.reset.requested
    - password.reset.completed
    - account.locked
    - email.verified

monitoring:
  provider: Prometheus + Grafana

  metrics:
    counters:
      - auth_requests_total{endpoint, status}
      - auth_failures_total{reason}
      - rate_limit_hits_total{type, endpoint}

    histograms:
      - auth_request_duration_seconds{endpoint}
      - password_hash_duration_seconds
      - token_generation_duration_seconds

    gauges:
      - active_sessions_count
      - locked_accounts_count

  alerts:
    - name: high_failure_rate
      condition: auth_failures_total > 100/min
      severity: warning

    - name: mass_lockouts
      condition: locked_accounts_count > 50
      severity: critical
```

### 3. Future Module Integration

```yaml
user_profile_module:
  integration_point: POST /auth/register success
  action: Create default user profile
  data_shared:
    - userId: integer
    - email: string
    - emailVerified: boolean

  event: user.registered
  event_bus: RabbitMQ / Kafka

social_graph_module:
  integration_point: User authentication
  action: Initialize empty social graph
  data_shared:
    - userId: integer

  event: user.created

notification_module:
  integration_point: Email verification, Password reset
  action: Send transactional notifications
  data_shared:
    - userId: integer
    - notificationType: enum
    - metadata: object

admin_security_module:
  integration_point: Account lockout, Suspicious activity
  action: Alert admin dashboard
  data_shared:
    - userId: integer
    - eventType: string
    - severity: enum
    - timestamp: datetime
```

---

## Technology Stack

### Backend Framework

```yaml
framework: Node.js with Express.js / Fastify
version: Node.js 18 LTS or 20 LTS

rationale: |
  - Excellent async I/O performance for auth workflows
  - Rich ecosystem for JWT, bcrypt, validation
  - Easy integration with Redis and PostgreSQL
  - Large community and security libraries

alternatives_considered:
  - NestJS: More opinionated, great for large teams
  - Fastify: Better performance, but smaller ecosystem
```

### Database

```yaml
primary_database:
  technology: PostgreSQL 15+

  rationale: |
    - ACID compliance for user data integrity
    - Excellent indexing for email lookups (O(log n))
    - Robust JSON support for audit logs
    - Partitioning support for scaling audit logs
    - Mature replication for high availability

  connection_pooling:
    library: pg-pool
    min_connections: 10
    max_connections: 100
    idle_timeout: 30000

cache_database:
  technology: Redis 7+

  rationale: |
    - O(log n) sorted set operations for rate limiting
    - Sub-millisecond latency for lockout checks
    - Built-in TTL for automatic cleanup
    - Pub/Sub for distributed coordination

  use_cases:
    - Rate limit counters
    - Account lockout status
    - Session cache (optional)
    - Token blacklist
```

### Libraries & Dependencies

```yaml
core_dependencies:
  - express: "^4.18.0"
    purpose: HTTP server framework

  - jsonwebtoken: "^9.0.0"
    purpose: JWT generation and validation

  - bcryptjs: "^2.4.3"
    purpose: Password hashing

  - joi: "^17.9.0"
    purpose: Request validation

  - ioredis: "^5.3.0"
    purpose: Redis client

  - pg: "^8.11.0"
    purpose: PostgreSQL client

  - @sendgrid/mail: "^7.7.0"
    purpose: Email delivery

  - winston: "^3.10.0"
    purpose: Structured logging

  - helmet: "^7.0.0"
    purpose: Security headers

dev_dependencies:
  - typescript: "^5.0.0"
  - jest: "^29.5.0"
  - supertest: "^6.3.0"
  - @types/node: "^20.0.0"
```

---

## Performance & Complexity Analysis

### Time Complexity

```yaml
operations:
  token_validation:
    complexity: O(1)
    rationale: |
      - JWT signature verification is constant time
      - Public key cryptography with fixed key size
      - No database lookup required
    average_time: <5ms

  rate_limit_check:
    complexity: O(log n)
    rationale: |
      - Redis Sorted Set operations (ZADD, ZREMRANGEBYSCORE)
      - Logarithmic complexity based on number of entries
      - n = number of requests in window (typically <100)
    average_time: <10ms

  password_hashing:
    complexity: O(2^12)
    rationale: |
      - Bcrypt cost factor 12 = 4096 rounds
      - Intentionally slow to prevent brute force
    average_time: ~300ms

  user_lookup:
    complexity: O(log n)
    rationale: |
      - B-tree index on email column
      - n = total number of users
    average_time: <20ms (even with millions of users)

  registration:
    complexity: O(2^12) (dominated by password hashing)
    total_time: ~350ms
    breakdown:
      - Validation: 5ms
      - Email check: 20ms
      - Password hash: 300ms
      - DB insert: 15ms
      - Email queue: 10ms

  login:
    complexity: O(2^12) (password verification)
    total_time: ~380ms
    breakdown:
      - Rate limit check: 10ms
      - User lookup: 20ms
      - Password verify: 300ms
      - Token generation: 30ms
      - Session create: 20ms
```

### Space Complexity

```yaml
storage:
  per_user:
    database: ~1 KB (user record)
    redis_lockout: 200 bytes (if locked)
    redis_rate_limit: ~50 bytes per request (auto-expires)

  per_token:
    database: ~500 bytes (refresh token record)
    jwt: ~300 bytes (access token, client-side)

  scaling_estimates:
    1M_users: ~1 GB (database)
    10M_users: ~10 GB (database)
    audit_logs: ~100 MB/month (depends on activity)
```

### Performance Targets

```yaml
sla_targets:
  response_time:
    p50: <100ms
    p95: <500ms
    p99: <1000ms

  throughput:
    login: 1000 req/sec per instance
    registration: 500 req/sec per instance
    token_refresh: 2000 req/sec per instance

  availability: 99.9% (8.76 hours downtime/year)

  scalability:
    horizontal: Yes (stateless design)
    max_users: 10M+ (with database sharding)
    max_concurrent_sessions: 1M+
```

---

## Deployment Architecture

### Container Configuration

```yaml
docker:
  base_image: node:18-alpine

  Dockerfile: |
    FROM node:18-alpine

    WORKDIR /app

    COPY package*.json ./
    RUN npm ci --only=production

    COPY . .

    RUN addgroup -g 1001 -S nodejs
    RUN adduser -S nodejs -u 1001
    USER nodejs

    EXPOSE 3000

    CMD ["node", "dist/server.js"]

  health_check:
    endpoint: GET /health
    interval: 30s
    timeout: 10s
    retries: 3
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  labels:
    app: auth-service
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: auth-service:1.0.0
        ports:
        - containerPort: 3000
          name: http

        env:
        - name: NODE_ENV
          value: "production"

        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: database-url

        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: redis-url

        - name: JWT_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: jwt-private-key

        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10

        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - auth-service
              topologyKey: kubernetes.io/hostname

---
apiVersion: v1
kind: Service
metadata:
  name: auth-service
spec:
  selector:
    app: auth-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  minReplicas: 3
  maxReplicas: 10
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
```

### Environment Configuration

```yaml
production:
  database:
    host: postgres-primary.internal
    port: 5432
    max_connections: 100
    ssl: true

  redis:
    host: redis-cluster.internal
    port: 6379
    cluster_mode: true
    tls: true

  jwt:
    algorithm: RS256
    access_token_expiry: 900
    refresh_token_expiry: 604800

  rate_limiting:
    enabled: true
    storage: redis

  logging:
    level: info
    format: json
    destination: stdout

staging:
  database:
    host: postgres-staging.internal
    max_connections: 20

  redis:
    host: redis-staging.internal

  logging:
    level: debug

development:
  database:
    host: localhost
    port: 5432

  redis:
    host: localhost
    port: 6379

  logging:
    level: debug
    format: pretty
```

---

## Summary

This architecture provides a production-ready authentication system with:

**Security Features:**
- Industry-standard bcrypt password hashing (cost factor 12)
- RS256 JWT tokens with 15-minute expiry
- Multi-layer rate limiting (IP, account, global)
- Account lockout after 5 failed attempts
- Secure token storage using SHA-256 hashing

**Performance Characteristics:**
- O(1) token validation
- O(log n) rate limit checks
- <100ms p50 response time
- 1000+ req/sec throughput per instance

**Scalability:**
- Stateless design enables horizontal scaling
- Redis for distributed rate limiting
- PostgreSQL with connection pooling
- Ready for 10M+ users

**Integration Ready:**
- RESTful API with OpenAPI specification
- Event-driven architecture for module communication
- Comprehensive audit logging
- Monitoring and alerting built-in

**Next Steps:**
1. Implement core authentication flows
2. Set up database migrations
3. Configure Redis for rate limiting
4. Integrate email service
5. Add comprehensive test suite
6. Deploy to staging environment

---

**Document Status:** ARCHITECTURE DRAFT
**Ready for:** Phase 4 (Refinement/Implementation)
**Total Lines:** 797

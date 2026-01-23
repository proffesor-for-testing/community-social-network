# ADR-004: Session-based vs Token-based Authentication

**Status**: Accepted
**Date**: 2025-12-04
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-002 (Modular Monolith), ADR-003 (REST API)

## Context

The Community Social Network platform requires an authentication strategy that addresses:

1. **Stateless Scalability**: Horizontal scaling without sticky sessions
2. **Mobile Support**: Future mobile apps need token-based auth
3. **CDN Compatibility**: Static assets served from CDN
4. **Security**: Protection against CSRF, XSS, token theft
5. **User Experience**: Seamless session management, "remember me" functionality

Authentication requirements from M1 specification:
- User registration with email verification
- Login with email/password
- Session persistence across browser restarts
- Secure logout with token invalidation
- Rate limiting on authentication endpoints
- Account lockout after failed attempts

## Decision

We adopt **JWT (JSON Web Token)** based authentication with a **dual-token strategy** (access + refresh tokens).

### Token Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        JWT Authentication Architecture                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              Token Types                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐        │
│  │       Access Token          │    │       Refresh Token          │        │
│  ├─────────────────────────────┤    ├─────────────────────────────┤        │
│  │ Algorithm: RS256            │    │ Algorithm: RS256             │        │
│  │ Lifetime: 15 minutes        │    │ Lifetime: 7 days             │        │
│  │ Storage: Memory (JS)        │    │ Storage: HttpOnly Cookie     │        │
│  │ Purpose: API authorization  │    │ Purpose: Token refresh       │        │
│  │ Contains: userId, role      │    │ Contains: userId, tokenId    │        │
│  └─────────────────────────────┘    └─────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Login Flow                                         │
└─────────────────────────────────────────────────────────────────────────────┘

Client                    API Server                    Database
   │                           │                            │
   │  POST /auth/login         │                            │
   │  {email, password}        │                            │
   ├──────────────────────────►│                            │
   │                           │  Verify credentials        │
   │                           ├───────────────────────────►│
   │                           │                            │
   │                           │  User record               │
   │                           │◄───────────────────────────┤
   │                           │                            │
   │                           │  Generate tokens           │
   │                           ├────────┐                   │
   │                           │        │                   │
   │                           │◄───────┘                   │
   │                           │                            │
   │                           │  Store refresh token       │
   │                           ├───────────────────────────►│
   │                           │                            │
   │  200 OK                   │                            │
   │  {accessToken}            │                            │
   │  Set-Cookie: refreshToken │                            │
   │◄──────────────────────────┤                            │
   │                           │                            │

┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Request Flow                                   │
└─────────────────────────────────────────────────────────────────────────────┘

Client                    API Server                    Database
   │                           │                            │
   │  GET /api/v1/feed         │                            │
   │  Authorization: Bearer {accessToken}                   │
   ├──────────────────────────►│                            │
   │                           │  Verify JWT signature      │
   │                           ├────────┐                   │
   │                           │        │                   │
   │                           │◄───────┘                   │
   │                           │                            │
   │                           │  (No DB lookup needed)     │
   │                           │                            │
   │  200 OK                   │                            │
   │  {feed data}              │                            │
   │◄──────────────────────────┤                            │
   │                           │                            │

┌─────────────────────────────────────────────────────────────────────────────┐
│                           Token Refresh Flow                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Client                    API Server                    Database
   │                           │                            │
   │  (Access token expired)   │                            │
   │                           │                            │
   │  POST /auth/refresh       │                            │
   │  Cookie: refreshToken     │                            │
   ├──────────────────────────►│                            │
   │                           │  Verify refresh token      │
   │                           ├───────────────────────────►│
   │                           │                            │
   │                           │  Token valid               │
   │                           │◄───────────────────────────┤
   │                           │                            │
   │                           │  Rotate refresh token      │
   │                           ├───────────────────────────►│
   │                           │                            │
   │  200 OK                   │                            │
   │  {newAccessToken}         │                            │
   │  Set-Cookie: newRefreshToken                           │
   │◄──────────────────────────┤                            │
   │                           │                            │
```

### Token Configuration

```typescript
// JWT Configuration
const jwtConfig = {
  accessToken: {
    algorithm: 'RS256',
    expiresIn: '15m',
    issuer: 'community-social-network',
    audience: 'csn-api',
  },
  refreshToken: {
    algorithm: 'RS256',
    expiresIn: '7d',
    issuer: 'community-social-network',
    audience: 'csn-refresh',
  },
};

// Access Token Payload
interface AccessTokenPayload {
  sub: string;          // User ID
  email: string;        // User email
  role: string;         // User role (user, admin)
  iat: number;          // Issued at
  exp: number;          // Expiration
  iss: string;          // Issuer
  aud: string;          // Audience
}

// Refresh Token Payload
interface RefreshTokenPayload {
  sub: string;          // User ID
  jti: string;          // Token ID (for revocation)
  iat: number;          // Issued at
  exp: number;          // Expiration
  iss: string;          // Issuer
  aud: string;          // Audience
}
```

### Cookie Configuration

```typescript
// Refresh Token Cookie Settings
const refreshTokenCookie = {
  name: 'refresh_token',
  httpOnly: true,           // Prevent XSS access
  secure: true,             // HTTPS only
  sameSite: 'strict',       // CSRF protection
  path: '/api/v1/auth',     // Only sent to auth endpoints
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  domain: '.example.com',   // Shared across subdomains
};
```

### Database Schema for Token Management

```sql
-- Refresh tokens table (for revocation)
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,  -- SHA-256 hash of token
    device_info VARCHAR(255),          -- User agent for display
    ip_address INET,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_id (user_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires_at (expires_at)
);

-- Blacklisted access tokens (for logout before expiry)
CREATE TABLE token_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_jti VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_token_jti (token_jti),
    INDEX idx_expires_at (expires_at)
);
```

## Alternatives Considered

### Option A: Session-based Authentication (Rejected)

**Implementation**: Server-side sessions stored in Redis.

```
Client                    API Server                    Redis
   │                           │                           │
   │  POST /auth/login         │                           │
   ├──────────────────────────►│                           │
   │                           │  Create session           │
   │                           ├──────────────────────────►│
   │                           │                           │
   │  Set-Cookie: sessionId    │                           │
   │◄──────────────────────────┤                           │
   │                           │                           │
   │  GET /api/resource        │                           │
   │  Cookie: sessionId        │                           │
   ├──────────────────────────►│                           │
   │                           │  Lookup session           │
   │                           ├──────────────────────────►│
   │                           │                           │
   │                           │  Session data             │
   │                           │◄──────────────────────────┤
   │                           │                           │
```

**Pros**:
- Easy revocation (delete session)
- Can store arbitrary session data
- No token size concerns
- Simpler token format

**Cons**:
- **Redis dependency**: Every request hits Redis
- **Scaling complexity**: Sticky sessions or shared session store
- **Single point of failure**: Redis outage breaks auth
- **Mobile unfriendly**: Cookies less suitable for mobile apps

**Why Rejected**:
- Every API request would require Redis lookup
- Horizontal scaling requires Redis cluster
- Future mobile app support is harder with sessions

### Option B: Stateless JWT Only (Rejected)

**Implementation**: Single long-lived JWT without refresh mechanism.

**Pros**:
- Simplest implementation
- No token refresh logic

**Cons**:
- **Security risk**: Long-lived tokens if compromised
- **No revocation**: Can't invalidate tokens before expiry
- **Stale data**: User role changes not reflected

**Why Rejected**: Security concerns with long-lived tokens that can't be revoked.

### Option C: OAuth 2.0 / OIDC (Deferred)

**Implementation**: Full OAuth 2.0 authorization server.

**Pros**:
- Industry standard
- Supports third-party auth
- Fine-grained scopes

**Cons**:
- Over-engineered for MVP
- Complexity for simple use case
- Additional infrastructure

**Why Deferred**: May implement for future API access by third parties, but overkill for MVP with first-party clients only.

## Consequences

### Positive

- **Stateless Verification**: Access tokens verified without database lookup
- **Horizontal Scaling**: Any server can validate tokens
- **Mobile Ready**: Works well with mobile apps (no cookies required)
- **CDN Compatible**: Tokens work with CDN caching
- **Revocation Possible**: Refresh tokens stored in DB for revocation
- **Security Layered**: Short-lived access + long-lived refresh tokens

### Negative

- **Token Size**: JWTs are larger than session IDs
- **Revocation Delay**: Access tokens valid until expiry (15 min max)
- **Key Management**: RSA key pairs must be managed securely
- **Complexity**: Dual-token system more complex than sessions

### Mitigation Strategies

| Risk | Mitigation |
|------|------------|
| Token theft | Short access token lifetime (15 min) |
| Refresh token theft | HttpOnly cookie, rotation on use |
| Key compromise | Key rotation procedure, short token lifetime |
| Revocation delay | Token blacklist for critical revocations |

## Security Measures

### 1. Token Signing (RS256)

```typescript
// Key generation (offline, secure environment)
// openssl genrsa -out private.pem 2048
// openssl rsa -in private.pem -pubout -out public.pem

const signToken = (payload: object, privateKey: string): string => {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
  });
};

const verifyToken = (token: string, publicKey: string): object => {
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
  });
};
```

### 2. Refresh Token Rotation

```typescript
// On each refresh, issue new refresh token and invalidate old
const refreshTokens = async (oldRefreshToken: string) => {
  // Verify old token
  const payload = verifyRefreshToken(oldRefreshToken);

  // Check if already used (detect replay attack)
  const tokenRecord = await db.refreshTokens.findByHash(hash(oldRefreshToken));
  if (tokenRecord.revoked_at) {
    // Token reuse detected - revoke all user tokens
    await db.refreshTokens.revokeAllForUser(payload.sub);
    throw new SecurityException('Token reuse detected');
  }

  // Revoke old token
  await db.refreshTokens.revoke(tokenRecord.id);

  // Issue new tokens
  const newRefreshToken = generateRefreshToken(payload.sub);
  const newAccessToken = generateAccessToken(payload.sub);

  // Store new refresh token
  await db.refreshTokens.create({
    userId: payload.sub,
    tokenHash: hash(newRefreshToken),
    expiresAt: addDays(new Date(), 7),
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};
```

### 3. Token Blacklist for Critical Revocation

```typescript
// For immediate revocation (password change, security incident)
const revokeAccessToken = async (tokenJti: string, expiresAt: Date) => {
  await db.tokenBlacklist.create({
    tokenJti,
    expiresAt,
  });

  // Also cache in Redis for fast lookup
  await redis.set(`blacklist:${tokenJti}`, '1', 'EX', secondsUntilExpiry);
};

// Middleware checks blacklist
const authMiddleware = async (req, res, next) => {
  const token = extractToken(req);
  const payload = verifyToken(token);

  // Check blacklist (Redis first, then DB)
  const isBlacklisted = await redis.get(`blacklist:${payload.jti}`)
    || await db.tokenBlacklist.exists(payload.jti);

  if (isBlacklisted) {
    throw new UnauthorizedException('Token revoked');
  }

  req.user = payload;
  next();
};
```

### 4. Rate Limiting

```typescript
// Authentication endpoint rate limits
const authRateLimits = {
  '/auth/login': {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,                     // 5 attempts
    message: 'Too many login attempts, try again in 15 minutes',
  },
  '/auth/register': {
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 3,                     // 3 registrations
    message: 'Too many registrations, try again in 1 hour',
  },
  '/auth/refresh': {
    windowMs: 60 * 1000,        // 1 minute
    max: 10,                    // 10 refreshes
    message: 'Too many refresh attempts',
  },
};
```

## References

- JWT RFC 7519: https://tools.ietf.org/html/rfc7519
- OWASP JWT Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html
- M1 Authentication Architecture: `docs/architecture/m1-auth-architecture.md`
- System Architecture Specification: `docs/architecture/SYSTEM_ARCHITECTURE_SPECIFICATION.md`

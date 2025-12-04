# Distributed Rate Limiting Strategy
**Community Social Network - Milestone 1: Authentication**

**Version:** 1.0.0
**Status:** Architecture Specification
**Last Updated:** 2025-12-04
**Owner:** Security & Infrastructure Team

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Rate Limiting Algorithms](#rate-limiting-algorithms)
4. [Rate Limit Tiers](#rate-limit-tiers)
5. [IP Spoofing Prevention](#ip-spoofing-prevention)
6. [CAPTCHA Integration](#captcha-integration)
7. [Account Lockout Policy](#account-lockout-policy)
8. [Response Headers & Error Handling](#response-headers--error-handling)
9. [Monitoring & Alerting](#monitoring--alerting)
10. [Implementation Details](#implementation-details)
11. [Test Scenarios](#test-scenarios)

---

## Executive Summary

### Objectives
- Prevent brute force attacks on authentication endpoints
- Mitigate DDoS attacks through intelligent rate limiting
- Provide distributed rate limiting across multiple servers
- Maintain system availability even under attack
- Ensure graceful degradation when Redis is unavailable

### Key Features
- **Redis-based distributed state**: Centralized rate limit tracking
- **Sliding Window Counter**: Accurate rate limiting with memory efficiency
- **Multi-tier limits**: IP, account, and endpoint-specific limits
- **Progressive penalties**: Escalating timeouts for repeat offenders
- **CAPTCHA integration**: Human verification for suspicious activity
- **Real-time monitoring**: Attack detection and alerting

### Architecture Principles
1. **Defense in Depth**: Multiple layers of protection
2. **Fail Open**: System remains available if rate limiter fails
3. **Observable**: Comprehensive metrics and logging
4. **Scalable**: Handles millions of requests across multiple servers
5. **Fair**: Legitimate users not penalized for attacker behavior

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer (Cloudflare WAF)          │
│                    • DDoS Protection                            │
│                    • SSL Termination                            │
│                    • IP Reputation Filtering                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway (Kong/Nginx)                    │
│                    • Request Routing                            │
│                    • X-Forwarded-For Validation                 │
│                    • Initial Rate Limiting (Layer 1)            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Server 1   │  │   Server 2   │  │   Server N   │         │
│  │              │  │              │  │              │         │
│  │ Rate Limiter │  │ Rate Limiter │  │ Rate Limiter │         │
│  │  Middleware  │  │  Middleware  │  │  Middleware  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Redis Cluster (Distributed State)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Master Node  │  │ Replica 1    │  │ Replica 2    │         │
│  │              │  │              │  │              │         │
│  │ Rate Limit   │  │ Rate Limit   │  │ Rate Limit   │         │
│  │ Counters     │  │ Counters     │  │ Counters     │         │
│  │              │  │ (Read-only)  │  │ (Read-only)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  Data Structure: Sliding Window Counters                        │
│  TTL: Auto-expire old windows                                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Monitoring & Alerting                       │
│  • Prometheus Metrics                                           │
│  • Grafana Dashboards                                           │
│  • PagerDuty Alerts                                             │
│  • ELK Stack (Logs)                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### 1. Cloudflare WAF (Layer 1 Defense)
- **Purpose**: Block known malicious IPs and patterns
- **Actions**:
  - Challenge suspicious IPs with CAPTCHA
  - Block IPs with poor reputation scores
  - Rate limit at edge before reaching origin
- **Limits**: 10,000 requests/minute per IP (DDoS protection)

#### 2. API Gateway (Layer 2 Defense)
- **Purpose**: Initial request filtering and routing
- **Actions**:
  - Validate X-Forwarded-For headers
  - Apply coarse-grained rate limits
  - Route to appropriate backend services
- **Limits**: 1,000 requests/minute per IP (general)

#### 3. Application Rate Limiter (Layer 3 Defense)
- **Purpose**: Fine-grained, endpoint-specific rate limiting
- **Actions**:
  - Check Redis for current rate limit state
  - Increment counters using Lua scripts (atomic)
  - Apply endpoint-specific limits
  - Trigger CAPTCHA when thresholds exceeded
  - Enforce account lockout policies
- **Limits**: Varies by endpoint (see Rate Limit Tiers)

#### 4. Redis Cluster (Distributed State)
- **Purpose**: Centralized rate limit counter storage
- **Configuration**:
  - Redis Cluster mode (sharded, replicated)
  - 3 master nodes, 3 replica nodes
  - Automatic failover with Sentinel
  - TTL-based key expiration
- **Data Structure**: Sliding window counters

---

## Rate Limiting Algorithms

### Algorithm Selection: Sliding Window Counter

**Why Sliding Window Counter?**

| Algorithm | Accuracy | Memory | Distributed | Complexity |
|-----------|----------|---------|-------------|------------|
| Fixed Window | Low | O(1) | Easy | O(1) |
| Sliding Log | High | O(n) | Hard | O(n) |
| Token Bucket | Medium | O(1) | Medium | O(1) |
| **Sliding Window Counter** | **High** | **O(1)** | **Easy** | **O(1)** |

**Advantages:**
- ✅ Prevents burst attacks at window boundaries (unlike Fixed Window)
- ✅ Memory efficient (unlike Sliding Log)
- ✅ Easy to distribute across servers via Redis
- ✅ Accurate rate limiting within 1% error margin
- ✅ Simple to implement and maintain

### Sliding Window Counter Implementation

**Concept:**
Combines two fixed windows (current + previous) with weighted calculation:

```
Time:     |----Previous Window----|----Current Window----|
Requests: |        15 reqs        |      7 reqs         |
                                  ↑ Current Time (70% into window)

Weighted Count = (Previous × (1 - progress)) + Current
               = (15 × 0.3) + 7
               = 4.5 + 7 = 11.5 requests

If limit = 10, request is DENIED
```

**Redis Key Structure:**
```
ratelimit:{identifier}:{window_start_timestamp}
```

**Example:**
```
ratelimit:ip:192.168.1.1:1701705600  → Count: 15 (previous window)
ratelimit:ip:192.168.1.1:1701709200  → Count: 7  (current window)
```

### Lua Script for Atomic Operations

**Why Lua?**
- Executes atomically on Redis (no race conditions)
- Reduces network round trips (1 command instead of 5)
- Prevents inconsistent state across distributed servers

**Lua Script:**
```lua
-- rate_limit.lua
-- Sliding Window Counter with Redis

local key_prefix = KEYS[1]          -- e.g., "ratelimit:ip:192.168.1.1"
local window_size = tonumber(ARGV[1])  -- e.g., 3600 (1 hour)
local limit = tonumber(ARGV[2])        -- e.g., 100 requests
local current_time = tonumber(ARGV[3]) -- Unix timestamp

-- Calculate current and previous window keys
local current_window = math.floor(current_time / window_size) * window_size
local previous_window = current_window - window_size

local current_key = key_prefix .. ":" .. current_window
local previous_key = key_prefix .. ":" .. previous_window

-- Get counts
local current_count = tonumber(redis.call("GET", current_key) or "0")
local previous_count = tonumber(redis.call("GET", previous_key) or "0")

-- Calculate progress through current window (0.0 to 1.0)
local progress = (current_time - current_window) / window_size

-- Weighted count using sliding window algorithm
local weighted_count = math.floor((previous_count * (1 - progress)) + current_count)

-- Check if request should be allowed
if weighted_count < limit then
    -- Increment current window counter
    redis.call("INCR", current_key)
    redis.call("EXPIRE", current_key, window_size * 2)  -- Keep for 2 windows

    return {
        1,                      -- allowed (1 = true, 0 = false)
        limit,                  -- total limit
        limit - weighted_count - 1,  -- remaining
        current_window + window_size  -- reset time
    }
else
    return {
        0,                      -- denied
        limit,
        0,                      -- no remaining
        current_window + window_size  -- reset time
    }
end
```

### Fallback Strategy (Redis Unavailable)

**In-Memory Rate Limiter (Application-Level):**

```typescript
// Fallback to local in-memory cache when Redis is down
class InMemoryRateLimiter {
  private cache = new Map<string, WindowData>();

  async checkRateLimit(key: string, limit: number, window: number): Promise<RateLimitResult> {
    // Use LRU cache with TTL
    // WARNING: Not distributed - each server has separate limits
    // Limits effectively multiplied by number of servers

    const now = Date.now();
    const windowKey = `${key}:${Math.floor(now / window)}`;

    const data = this.cache.get(windowKey) || { count: 0 };

    if (data.count < limit) {
      data.count++;
      this.cache.set(windowKey, data);
      return { allowed: true, remaining: limit - data.count };
    }

    return { allowed: false, remaining: 0 };
  }
}

// Graceful degradation: Multiply limits by server count
const effectiveLimit = redisAvailable
  ? config.limit
  : config.limit * config.serverCount;
```

**Monitoring:** Alert when Redis connection fails and fallback is active.

---

## Rate Limit Tiers

### Tier Configuration Table

| Endpoint | Method | Window | Limit | Key Type | Penalty | Notes |
|----------|--------|--------|-------|----------|---------|-------|
| **Authentication Endpoints** |
| `/auth/register` | POST | 1 hour | 5 | IP | 24h block after 10 attempts | Prevent account spam |
| `/auth/login` | POST | 15 min | 5 | IP | Progressive (see lockout) | Brute force prevention |
| `/auth/login` | POST | 1 hour | 10 | Account | Account lockout | Credential stuffing |
| `/auth/forgot-password` | POST | 1 hour | 3 | IP | 1h cooldown | Prevent email bombing |
| `/auth/reset-password` | POST | 15 min | 3 | Token | Token invalidation | Token guessing |
| `/auth/refresh` | POST | 1 min | 10 | User | JWT refresh limit | Token refresh abuse |
| `/auth/verify-email` | POST | 1 hour | 5 | IP | - | Email verification |
| `/auth/logout` | POST | 1 min | 20 | User | - | Normal logout |
| **API Endpoints** |
| `/api/*` (General) | * | 1 min | 100 | User | Temporary throttle | General API |
| `/api/search` | GET | 1 min | 30 | User | - | Expensive queries |
| `/api/posts` | POST | 1 hour | 50 | User | - | Content creation |
| `/api/uploads` | POST | 1 hour | 10 | User | - | File upload limits |
| `/api/admin/*` | * | 1 min | 20 | User + Role | - | Admin operations |
| **Public Endpoints** |
| `/health` | GET | - | ∞ | - | - | Health check |
| `/metrics` | GET | 1 min | 10 | IP | - | Prometheus scraping |

### Rate Limit Key Patterns

**1. IP-Based Rate Limiting**
```
Key: ratelimit:ip:{ip_address}:{endpoint}:{window}
Example: ratelimit:ip:192.168.1.1:auth/login:1701709200
Use Case: Prevent brute force from single IP
```

**2. Account-Based Rate Limiting**
```
Key: ratelimit:account:{user_id}:{endpoint}:{window}
Example: ratelimit:account:user_123:auth/login:1701709200
Use Case: Credential stuffing across multiple IPs
```

**3. Token-Based Rate Limiting**
```
Key: ratelimit:token:{token_hash}:{endpoint}:{window}
Example: ratelimit:token:abc123:auth/reset-password:1701709200
Use Case: Prevent token guessing attacks
```

**4. Global Rate Limiting**
```
Key: ratelimit:global:{endpoint}:{window}
Example: ratelimit:global:auth/register:1701709200
Use Case: Prevent application-wide abuse
```

### Multi-Tier Rate Limiting Logic

**Request Flow:**
```typescript
async function checkRateLimits(req: Request): Promise<RateLimitResult> {
  const checks = [];

  // Tier 1: IP-based limit
  checks.push(
    checkRateLimit(`ip:${req.ip}:${req.endpoint}`, ipLimit, ipWindow)
  );

  // Tier 2: Account-based limit (if authenticated)
  if (req.user) {
    checks.push(
      checkRateLimit(`account:${req.user.id}:${req.endpoint}`, accountLimit, accountWindow)
    );
  }

  // Tier 3: Token-based limit (for reset password, etc.)
  if (req.token) {
    checks.push(
      checkRateLimit(`token:${req.token}:${req.endpoint}`, tokenLimit, tokenWindow)
    );
  }

  // Tier 4: Global limit
  checks.push(
    checkRateLimit(`global:${req.endpoint}`, globalLimit, globalWindow)
  );

  // ALL tiers must pass
  const results = await Promise.all(checks);
  const denied = results.find(r => !r.allowed);

  if (denied) {
    return denied;  // Return first denial
  }

  // Return most restrictive remaining count
  return results.reduce((min, curr) =>
    curr.remaining < min.remaining ? curr : min
  );
}
```

---

## IP Spoofing Prevention

### X-Forwarded-For Validation

**Problem:** Attackers can spoof `X-Forwarded-For` header to bypass IP rate limits.

**Solution:** Trusted proxy chain validation.

#### Configuration

```typescript
const trustedProxies = [
  '10.0.0.0/8',        // Internal network
  '172.16.0.0/12',     // Internal network
  '192.168.0.0/16',    // Internal network
  '173.245.48.0/20',   // Cloudflare IP ranges
  '103.21.244.0/22',
  '103.22.200.0/22',
  // ... full Cloudflare IP list
];

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];

  if (!forwarded) {
    return req.connection.remoteAddress;
  }

  // X-Forwarded-For: client, proxy1, proxy2, ...
  const ips = forwarded.split(',').map(ip => ip.trim());

  // Validate from right to left (trust chain)
  for (let i = ips.length - 1; i >= 0; i--) {
    const ip = ips[i];

    // If IP is not in trusted proxy list, it's the client
    if (!isTrustedProxy(ip)) {
      return ip;
    }
  }

  // All IPs are trusted proxies, use leftmost (original client)
  return ips[0];
}

function isTrustedProxy(ip: string): boolean {
  return trustedProxies.some(range => ipInRange(ip, range));
}
```

#### Cloudflare Integration

**Use CF-Connecting-IP Header:**
```typescript
function getClientIP(req: Request): string {
  // Cloudflare sets CF-Connecting-IP to actual client IP
  // Only trust this header if request came from Cloudflare
  const cfIP = req.headers['cf-connecting-ip'];
  const remoteIP = req.connection.remoteAddress;

  if (cfIP && isCloudflareIP(remoteIP)) {
    return cfIP;  // Trust Cloudflare
  }

  // Fallback to X-Forwarded-For validation
  return getClientIPFromXFF(req);
}

function isCloudflareIP(ip: string): boolean {
  // Check against Cloudflare IP ranges (update regularly)
  return cloudflareRanges.some(range => ipInRange(ip, range));
}
```

**Cloudflare IP Ranges Update:**
- **IPv4:** https://www.cloudflare.com/ips-v4
- **IPv6:** https://www.cloudflare.com/ips-v6
- **Update Frequency:** Daily via cron job

```bash
# Cron job to update Cloudflare IPs
0 2 * * * curl https://www.cloudflare.com/ips-v4 > /etc/cloudflare-ips-v4.txt
```

### Client Fingerprinting (Advanced)

**Purpose:** Identify clients even if they change IPs (VPN hopping).

**Fingerprint Components:**
```typescript
interface ClientFingerprint {
  userAgent: string;          // Browser/client signature
  acceptLanguage: string;     // Language preferences
  acceptEncoding: string;     // Supported encodings
  screenResolution?: string;  // From JavaScript (optional)
  timezone?: string;          // Client timezone
  plugins?: string[];         // Browser plugins (optional)
  canvas?: string;            // Canvas fingerprinting hash
}

function generateFingerprint(req: Request): string {
  const fp: ClientFingerprint = {
    userAgent: req.headers['user-agent'] || '',
    acceptLanguage: req.headers['accept-language'] || '',
    acceptEncoding: req.headers['accept-encoding'] || '',
  };

  // Hash fingerprint components
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(fp))
    .digest('hex')
    .substring(0, 16);  // Use first 16 chars
}

// Composite rate limit key: IP + Fingerprint
const rateLimitKey = `ip:${clientIP}:fp:${fingerprint}:${endpoint}`;
```

**Trade-offs:**
- ✅ Harder to bypass via IP rotation
- ✅ Detects distributed attacks from same client
- ❌ Privacy concerns (fingerprinting can be invasive)
- ❌ False positives (shared fingerprints in corporate networks)

**Recommendation:** Use fingerprinting only for high-risk endpoints (login, registration).

---

## CAPTCHA Integration

### When to Trigger CAPTCHA

**Trigger Conditions:**

| Condition | Threshold | Action | Notes |
|-----------|-----------|--------|-------|
| **Failed Login Attempts** | 3 in 15 min | Show CAPTCHA | Same IP or account |
| **Registration Attempts** | 3 in 1 hour | Show CAPTCHA | Same IP |
| **Password Reset** | 2 in 1 hour | Show CAPTCHA | Same IP |
| **Rate Limit Exceeded** | 80% of limit | Show CAPTCHA | Proactive |
| **Suspicious Patterns** | ML detection | Show CAPTCHA | Bot behavior |
| **IP Reputation** | Bad score | Always show | Known bad actors |

### CAPTCHA Provider: reCAPTCHA v3

**Why reCAPTCHA v3?**
- ✅ Invisible to most users (no challenge)
- ✅ Risk-based scoring (0.0 to 1.0)
- ✅ Machine learning bot detection
- ✅ Free tier: 1M assessments/month
- ✅ Fallback to v2 checkbox if score low

**Configuration:**
```typescript
interface CaptchaConfig {
  provider: 'recaptcha-v3';
  siteKey: process.env.RECAPTCHA_SITE_KEY;
  secretKey: process.env.RECAPTCHA_SECRET_KEY;

  // Score thresholds (0.0 = bot, 1.0 = human)
  thresholds: {
    allow: 0.7,      // Score >= 0.7: Allow without challenge
    challenge: 0.3,  // 0.3 <= Score < 0.7: Show v2 checkbox
    deny: 0.3,       // Score < 0.3: Block request
  };

  // Actions to protect
  actions: {
    login: { enabled: true, threshold: 0.5 },
    register: { enabled: true, threshold: 0.7 },
    passwordReset: { enabled: true, threshold: 0.5 },
  };
}
```

**Integration Flow:**

```typescript
// 1. Frontend: Include reCAPTCHA v3 script
<script src="https://www.google.com/recaptcha/api.js?render=SITE_KEY"></script>

// 2. Frontend: Get token on form submit
async function onSubmit(e) {
  e.preventDefault();

  const token = await grecaptcha.execute(SITE_KEY, { action: 'login' });

  const response = await fetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, captchaToken: token }),
  });

  if (response.status === 428) {  // Precondition Required
    // Score too low, show v2 checkbox
    showCaptchaV2();
  }
}

// 3. Backend: Verify token
async function verifyCaptcha(token: string, action: string): Promise<CaptchaResult> {
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${secretKey}&response=${token}`,
  });

  const data = await response.json();

  if (!data.success) {
    return { passed: false, score: 0, error: data['error-codes'] };
  }

  if (data.action !== action) {
    return { passed: false, score: 0, error: 'action_mismatch' };
  }

  const score = data.score;  // 0.0 to 1.0

  if (score >= config.thresholds.allow) {
    return { passed: true, score, challenge: false };
  } else if (score >= config.thresholds.challenge) {
    return { passed: false, score, challenge: true };  // Show v2
  } else {
    return { passed: false, score, challenge: false, blocked: true };
  }
}

// 4. Middleware: Enforce CAPTCHA
async function captchaMiddleware(req, res, next) {
  const endpoint = req.path;
  const action = getActionName(endpoint);  // e.g., 'login'

  if (!config.actions[action]?.enabled) {
    return next();  // CAPTCHA not required
  }

  const token = req.body.captchaToken;

  if (!token) {
    return res.status(428).json({
      error: 'captcha_required',
      message: 'CAPTCHA verification required',
    });
  }

  const result = await verifyCaptcha(token, action);

  if (result.blocked) {
    return res.status(403).json({
      error: 'captcha_failed',
      message: 'CAPTCHA verification failed. Request blocked.',
    });
  }

  if (result.challenge) {
    return res.status(428).json({
      error: 'captcha_challenge_required',
      message: 'Please complete the CAPTCHA challenge',
      showV2: true,
    });
  }

  if (!result.passed) {
    return res.status(403).json({
      error: 'captcha_failed',
      message: 'CAPTCHA verification failed',
    });
  }

  // Store score in request for logging
  req.captchaScore = result.score;

  next();
}
```

### Fallback for CAPTCHA Failures

**Scenarios:**
1. **reCAPTCHA service down**: Allow request but log warning
2. **Network timeout**: Retry once, then allow
3. **Invalid site key**: Allow request but alert dev team
4. **User can't solve CAPTCHA**: Provide alternative verification (email code)

**Implementation:**
```typescript
async function verifyCaptchaWithFallback(token: string): Promise<boolean> {
  try {
    const result = await verifyCaptcha(token, action);
    return result.passed;
  } catch (error) {
    logger.error('CAPTCHA verification failed', { error });

    // Alert monitoring system
    metrics.increment('captcha.fallback.triggered');

    // Fail open: Allow request but apply stricter rate limits
    await applyStrictRateLimit(req);

    return true;  // Allow request
  }
}
```

### Accessibility Considerations

**WCAG 2.1 Compliance:**
- reCAPTCHA v3 is invisible (no accessibility barriers)
- reCAPTCHA v2 audio challenge for visually impaired users
- Keyboard navigation support
- Screen reader compatible

**Alternative Verification:**
```typescript
// Offer email verification as alternative to CAPTCHA
app.post('/auth/login/email-challenge', async (req, res) => {
  const { email } = req.body;

  // Send verification code via email
  const code = generateSecureCode(6);
  await sendEmail(email, 'Login Verification Code', `Your code: ${code}`);

  // Store code in Redis with 5-minute expiry
  await redis.setex(`email_challenge:${email}`, 300, code);

  res.json({ message: 'Verification code sent to email' });
});

app.post('/auth/login/verify-code', async (req, res) => {
  const { email, code } = req.body;

  const storedCode = await redis.get(`email_challenge:${email}`);

  if (code === storedCode) {
    // Code verified, allow login without CAPTCHA
    req.captchaVerified = true;
    return loginHandler(req, res);
  }

  res.status(403).json({ error: 'invalid_code' });
});
```

---

## Account Lockout Policy

### Failed Attempt Thresholds

**Progressive Lockout Strategy:**

| Attempt Count | Window | Lockout Duration | Unlock Method | Alert |
|---------------|--------|------------------|---------------|-------|
| **1-2 failures** | 15 min | None | - | None |
| **3-4 failures** | 15 min | 5 minutes | Time-based | None |
| **5-6 failures** | 15 min | 15 minutes | Time-based or email | Email to user |
| **7-9 failures** | 1 hour | 1 hour | Email verification | Email + SMS |
| **10+ failures** | 24 hours | 24 hours | Admin unlock | Security team alert |

### Lockout Implementation

**Redis Data Structure:**
```typescript
interface LockoutState {
  userId: string;
  failedAttempts: number;
  firstFailureAt: number;      // Unix timestamp
  lockedUntil: number | null;  // Unix timestamp
  lockoutReason: string;
  unlockToken?: string;        // For email unlock
}

// Redis keys
ratelimit:lockout:account:{userId}         → LockoutState (JSON)
ratelimit:lockout:ip:{ip}                  → LockoutState (JSON)
ratelimit:unlock_token:{token}             → userId (for email unlock)
```

**Lockout Logic:**
```typescript
async function checkAccountLockout(userId: string, ip: string): Promise<LockoutResult> {
  // Check both account-level and IP-level lockouts
  const accountLockout = await getLockoutState(`account:${userId}`);
  const ipLockout = await getLockoutState(`ip:${ip}`);

  // If either is locked, deny request
  if (accountLockout.isLocked) {
    return {
      locked: true,
      reason: 'account_locked',
      unlockAt: accountLockout.lockedUntil,
      unlockMethods: accountLockout.unlockMethods,
    };
  }

  if (ipLockout.isLocked) {
    return {
      locked: true,
      reason: 'ip_locked',
      unlockAt: ipLockout.lockedUntil,
    };
  }

  return { locked: false };
}

async function recordFailedAttempt(userId: string, ip: string): Promise<void> {
  const now = Date.now();

  // Account-level tracking
  const accountKey = `ratelimit:lockout:account:${userId}`;
  let accountState = await redis.get(accountKey);
  accountState = accountState ? JSON.parse(accountState) : {
    userId,
    failedAttempts: 0,
    firstFailureAt: now,
    lockedUntil: null,
  };

  // Increment failure count
  accountState.failedAttempts++;

  // Calculate lockout duration based on attempt count
  const lockoutDuration = calculateLockoutDuration(accountState.failedAttempts);

  if (lockoutDuration > 0) {
    accountState.lockedUntil = now + lockoutDuration;
    accountState.lockoutReason = `${accountState.failedAttempts} failed login attempts`;

    // Generate unlock token for email verification
    if (accountState.failedAttempts >= 5) {
      accountState.unlockToken = generateSecureToken(32);
      await redis.setex(
        `ratelimit:unlock_token:${accountState.unlockToken}`,
        lockoutDuration / 1000,
        userId
      );
    }

    // Send notification
    await sendLockoutNotification(userId, accountState);
  }

  // Save state with TTL
  await redis.setex(accountKey, 86400, JSON.stringify(accountState));  // 24h TTL

  // IP-level tracking (similar logic)
  await recordIPFailure(ip);
}

function calculateLockoutDuration(attempts: number): number {
  // Progressive lockout durations (in milliseconds)
  if (attempts < 3) return 0;
  if (attempts < 5) return 5 * 60 * 1000;      // 5 minutes
  if (attempts < 7) return 15 * 60 * 1000;     // 15 minutes
  if (attempts < 10) return 60 * 60 * 1000;    // 1 hour
  return 24 * 60 * 60 * 1000;                  // 24 hours
}
```

### Unlock Mechanisms

**1. Time-Based Unlock (Automatic)**
```typescript
async function getLockoutState(key: string): Promise<LockoutState> {
  const state = await redis.get(`ratelimit:lockout:${key}`);

  if (!state) {
    return { isLocked: false };
  }

  const lockout: LockoutState = JSON.parse(state);

  // Check if lockout expired
  if (lockout.lockedUntil && Date.now() > lockout.lockedUntil) {
    // Auto-unlock: clear lockout state
    await redis.del(`ratelimit:lockout:${key}`);
    return { isLocked: false };
  }

  return { isLocked: true, ...lockout };
}
```

**2. Email Verification Unlock**
```typescript
app.post('/auth/unlock', async (req, res) => {
  const { unlockToken } = req.body;

  // Verify unlock token
  const userId = await redis.get(`ratelimit:unlock_token:${unlockToken}`);

  if (!userId) {
    return res.status(404).json({ error: 'invalid_or_expired_token' });
  }

  // Clear lockout state
  await redis.del(`ratelimit:lockout:account:${userId}`);
  await redis.del(`ratelimit:unlock_token:${unlockToken}`);

  // Log unlock event
  logger.info('Account unlocked via email', { userId });

  res.json({ message: 'Account unlocked successfully' });
});
```

**3. Admin Unlock (Manual)**
```typescript
app.post('/admin/unlock-account', requireAdminAuth, async (req, res) => {
  const { userId, reason } = req.body;

  // Clear lockout state
  await redis.del(`ratelimit:lockout:account:${userId}`);

  // Log admin action
  await auditLog.create({
    action: 'account_unlocked',
    adminId: req.admin.id,
    targetUserId: userId,
    reason,
  });

  // Notify user
  await sendEmail(userId, 'Account Unlocked', `Your account has been unlocked by an administrator.`);

  res.json({ message: 'Account unlocked' });
});
```

### Security Alert Notifications

**Email Notification (5+ failures):**
```html
Subject: Security Alert: Multiple Failed Login Attempts

Hi [User Name],

We detected multiple failed login attempts on your account from the following location:

- IP Address: [IP]
- Location: [City, Country]
- Time: [Timestamp]
- Attempts: [Count]

Your account has been temporarily locked for your security.

What to do:
1. If this was you, wait [duration] or click here to unlock: [Unlock Link]
2. If this wasn't you, change your password immediately: [Reset Link]
3. Enable Two-Factor Authentication for extra security: [2FA Setup Link]

If you have concerns, contact our security team at security@example.com.

Best regards,
Security Team
```

**SMS Notification (7+ failures):**
```
Security Alert: Your account was locked due to multiple failed login attempts. If this wasn't you, reset your password immediately at https://example.com/reset. Reply STOP to unsubscribe.
```

**Admin Alert (10+ failures):**
```typescript
async function sendSecurityTeamAlert(userId: string, state: LockoutState) {
  const user = await User.findById(userId);

  await sendSlackAlert({
    channel: '#security-alerts',
    message: `🚨 Security Alert: Account Lockout`,
    fields: {
      'User': `${user.email} (${userId})`,
      'Failed Attempts': state.failedAttempts,
      'IP Address': state.lastAttemptIP,
      'Location': await geolocate(state.lastAttemptIP),
      'Time': new Date(state.firstFailureAt).toISOString(),
    },
    actions: [
      { text: 'Unlock Account', url: `${adminUrl}/unlock/${userId}` },
      { text: 'View Logs', url: `${adminUrl}/audit/${userId}` },
    ],
  });
}
```

---

## Response Headers & Error Handling

### Rate Limit Response Headers

**Standard Headers (RFC 6585):**
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100            # Total requests allowed in window
X-RateLimit-Remaining: 42         # Requests remaining in current window
X-RateLimit-Reset: 1701709200     # Unix timestamp when limit resets
X-RateLimit-Window: 3600          # Window size in seconds
Retry-After: 900                  # Seconds until retry allowed (if limited)
```

**Extended Headers (Granular Info):**
```http
X-RateLimit-Policy: 100 per hour  # Human-readable policy
X-RateLimit-Scope: ip             # Scope: ip, account, token, global
X-RateLimit-Tier: authenticated   # User tier (if applicable)
```

### Middleware Implementation

```typescript
function rateLimitHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Attach rate limit info to response
  const rateLimitInfo = req.rateLimitInfo;  // Set by rate limiter

  if (!rateLimitInfo) {
    return next();
  }

  res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitInfo.remaining));
  res.setHeader('X-RateLimit-Reset', rateLimitInfo.resetAt);
  res.setHeader('X-RateLimit-Window', rateLimitInfo.window);
  res.setHeader('X-RateLimit-Policy', rateLimitInfo.policy);
  res.setHeader('X-RateLimit-Scope', rateLimitInfo.scope);

  next();
}

app.use(rateLimitHeadersMiddleware);
```

### Error Response Format (429 Too Many Requests)

**Standardized Error Response:**
```typescript
interface RateLimitError {
  error: {
    code: 'RATE_LIMIT_EXCEEDED';
    message: string;
    details: {
      limit: number;
      window: number;
      resetAt: number;
      retryAfter: number;
      scope: 'ip' | 'account' | 'token' | 'global';
      policy: string;
    };
  };
}

// Example response
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1701709200
Retry-After: 600

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many login attempts. Please try again in 10 minutes.",
    "details": {
      "limit": 5,
      "window": 900,
      "resetAt": 1701709200,
      "retryAfter": 600,
      "scope": "ip",
      "policy": "5 per 15 minutes"
    }
  }
}
```

**Account Lockout Response (423 Locked):**
```typescript
HTTP/1.1 423 Locked
Content-Type: application/json

{
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Your account has been temporarily locked due to multiple failed login attempts.",
    "details": {
      "lockedUntil": 1701712800,
      "lockoutReason": "10 failed login attempts in 1 hour",
      "unlockMethods": ["time", "email"],
      "unlockUrl": "/auth/unlock"
    }
  }
}
```

**CAPTCHA Required Response (428 Precondition Required):**
```typescript
HTTP/1.1 428 Precondition Required
Content-Type: application/json

{
  "error": {
    "code": "CAPTCHA_REQUIRED",
    "message": "Please complete the CAPTCHA verification to continue.",
    "details": {
      "captchaType": "recaptcha-v3",
      "siteKey": "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
      "action": "login"
    }
  }
}
```

### Frontend Error Handling

```typescript
async function handleRateLimitError(response: Response) {
  if (response.status === 429) {
    const error = await response.json();
    const retryAfter = error.details.retryAfter;

    // Show user-friendly message
    showNotification({
      type: 'warning',
      message: error.message,
      duration: null,  // Persist until dismissed
    });

    // Disable submit button with countdown
    disableFormWithCountdown(retryAfter);

    // Log to analytics
    analytics.track('rate_limit_hit', {
      endpoint: window.location.pathname,
      retryAfter,
    });
  } else if (response.status === 423) {
    const error = await response.json();

    // Show account locked modal
    showAccountLockedModal({
      lockedUntil: error.details.lockedUntil,
      unlockMethods: error.details.unlockMethods,
      unlockUrl: error.details.unlockUrl,
    });
  } else if (response.status === 428) {
    const error = await response.json();

    // Show CAPTCHA challenge
    await showCaptchaChallenge(error.details);
  }
}

function disableFormWithCountdown(seconds: number) {
  const button = document.querySelector('button[type="submit"]');
  button.disabled = true;

  const interval = setInterval(() => {
    seconds--;
    button.textContent = `Try again in ${seconds}s`;

    if (seconds <= 0) {
      clearInterval(interval);
      button.disabled = false;
      button.textContent = 'Login';
    }
  }, 1000);
}
```

---

## Monitoring & Alerting

### Key Metrics to Track

**1. Rate Limit Metrics**
```typescript
// Prometheus metrics
const rateLimitMetrics = {
  // Counter: Total requests checked
  requests_total: new Counter({
    name: 'rate_limit_requests_total',
    help: 'Total requests checked against rate limits',
    labelNames: ['endpoint', 'scope', 'result'],  // result: allowed, denied
  }),

  // Counter: Rate limit hits (requests blocked)
  hits_total: new Counter({
    name: 'rate_limit_hits_total',
    help: 'Total rate limit hits (blocked requests)',
    labelNames: ['endpoint', 'scope', 'reason'],
  }),

  // Gauge: Current rate limit usage per key
  usage: new Gauge({
    name: 'rate_limit_usage',
    help: 'Current rate limit usage (0-1)',
    labelNames: ['key', 'endpoint'],
  }),

  // Histogram: Rate limit check latency
  check_duration: new Histogram({
    name: 'rate_limit_check_duration_seconds',
    help: 'Rate limit check latency',
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  }),
};

// Usage
rateLimitMetrics.requests_total.inc({ endpoint: '/auth/login', scope: 'ip', result: 'denied' });
rateLimitMetrics.hits_total.inc({ endpoint: '/auth/login', scope: 'ip', reason: 'quota_exceeded' });
rateLimitMetrics.usage.set({ key: 'ip:192.168.1.1', endpoint: '/auth/login' }, 0.85);
```

**2. Attack Detection Metrics**
```typescript
const attackMetrics = {
  // Counter: Potential attack patterns detected
  attacks_detected: new Counter({
    name: 'security_attacks_detected_total',
    help: 'Total security attacks detected',
    labelNames: ['type', 'severity'],  // type: brute_force, ddos, credential_stuffing
  }),

  // Counter: Blocked IPs
  blocked_ips: new Counter({
    name: 'security_blocked_ips_total',
    help: 'Total IPs blocked by rate limiter',
    labelNames: ['reason'],
  }),

  // Counter: Account lockouts
  lockouts: new Counter({
    name: 'security_account_lockouts_total',
    help: 'Total account lockouts',
    labelNames: ['reason', 'duration'],
  }),

  // Gauge: Currently blocked IPs
  active_blocks: new Gauge({
    name: 'security_active_blocks',
    help: 'Number of currently blocked IPs',
  }),
};
```

**3. CAPTCHA Metrics**
```typescript
const captchaMetrics = {
  // Counter: CAPTCHA challenges issued
  challenges_issued: new Counter({
    name: 'captcha_challenges_issued_total',
    help: 'Total CAPTCHA challenges issued',
    labelNames: ['endpoint', 'version'],  // version: v2, v3
  }),

  // Counter: CAPTCHA verifications
  verifications: new Counter({
    name: 'captcha_verifications_total',
    help: 'Total CAPTCHA verifications',
    labelNames: ['result'],  // result: passed, failed, fallback
  }),

  // Histogram: CAPTCHA scores (v3)
  scores: new Histogram({
    name: 'captcha_scores',
    help: 'reCAPTCHA v3 scores',
    buckets: [0.1, 0.3, 0.5, 0.7, 0.9],
  }),
};
```

### Grafana Dashboard Configuration

**Dashboard Panels:**

```yaml
# Grafana Dashboard: Rate Limiting & Security
dashboard:
  title: "Rate Limiting & Security Monitoring"
  panels:

    # Panel 1: Rate Limit Hit Rate
    - title: "Rate Limit Hit Rate (per minute)"
      type: "graph"
      query: |
        rate(rate_limit_hits_total[1m])
      legend: "{{endpoint}} - {{scope}}"
      alert:
        condition: rate > 100/min
        severity: warning

    # Panel 2: Top Rate Limited Endpoints
    - title: "Top Rate Limited Endpoints"
      type: "table"
      query: |
        topk(10, sum by (endpoint, scope) (rate_limit_hits_total))

    # Panel 3: Rate Limit Usage Heatmap
    - title: "Rate Limit Usage Distribution"
      type: "heatmap"
      query: |
        histogram_quantile(0.95, rate_limit_usage)

    # Panel 4: Blocked IPs Over Time
    - title: "Blocked IPs (24h)"
      type: "graph"
      query: |
        increase(security_blocked_ips_total[24h])
      alert:
        condition: increase > 1000
        severity: critical

    # Panel 5: Account Lockouts
    - title: "Account Lockouts (1h)"
      type: "stat"
      query: |
        increase(security_account_lockouts_total[1h])
      thresholds:
        - value: 10
          color: yellow
        - value: 50
          color: red

    # Panel 6: CAPTCHA Challenge Success Rate
    - title: "CAPTCHA Success Rate"
      type: "gauge"
      query: |
        sum(rate(captcha_verifications_total{result="passed"}[5m])) /
        sum(rate(captcha_verifications_total[5m]))
      min: 0
      max: 1
      thresholds:
        - value: 0.7
          color: red
        - value: 0.9
          color: green

    # Panel 7: Attack Detection
    - title: "Security Attacks Detected"
      type: "graph"
      query: |
        increase(security_attacks_detected_total[1h])
      legend: "{{type}} - {{severity}}"

    # Panel 8: Rate Limiter Latency
    - title: "Rate Limit Check Latency (p95)"
      type: "graph"
      query: |
        histogram_quantile(0.95, rate_limit_check_duration_seconds)
      alert:
        condition: p95 > 0.1s
        severity: warning
```

### Alert Rules

**PagerDuty / Slack Alerts:**

```yaml
# alerts.yaml
groups:
  - name: rate_limiting
    interval: 1m
    rules:

      # Alert 1: High Rate Limit Hit Rate
      - alert: HighRateLimitHitRate
        expr: rate(rate_limit_hits_total[5m]) > 100
        for: 5m
        labels:
          severity: warning
          team: security
        annotations:
          summary: "High rate limit hit rate on {{ $labels.endpoint }}"
          description: "{{ $value }} requests/sec blocked on {{ $labels.endpoint }}"
          dashboard: "https://grafana.example.com/d/rate-limiting"

      # Alert 2: DDoS Attack Suspected
      - alert: DDoSAttackSuspected
        expr: sum(rate(rate_limit_hits_total[1m])) > 1000
        for: 2m
        labels:
          severity: critical
          team: security
          oncall: true
        annotations:
          summary: "Possible DDoS attack in progress"
          description: "{{ $value }} requests/sec blocked across all endpoints"
          runbook: "https://wiki.example.com/runbooks/ddos-response"

      # Alert 3: Brute Force Attack
      - alert: BruteForceAttackDetected
        expr: rate(security_account_lockouts_total[5m]) > 10
        for: 3m
        labels:
          severity: high
          team: security
        annotations:
          summary: "Brute force attack detected"
          description: "{{ $value }} account lockouts/min (threshold: 10)"

      # Alert 4: Rate Limiter Failure
      - alert: RateLimiterFailure
        expr: rate(rate_limit_errors_total[1m]) > 10
        for: 2m
        labels:
          severity: critical
          team: infrastructure
        annotations:
          summary: "Rate limiter experiencing errors"
          description: "{{ $value }} rate limiter errors/min. Redis may be down."

      # Alert 5: Redis Connection Lost
      - alert: RedisConnectionLost
        expr: redis_up == 0
        for: 1m
        labels:
          severity: critical
          team: infrastructure
          oncall: true
        annotations:
          summary: "Redis connection lost - rate limiter degraded"
          description: "Falling back to in-memory rate limiting"

      # Alert 6: CAPTCHA Failure Rate High
      - alert: CaptchaFailureRateHigh
        expr: |
          sum(rate(captcha_verifications_total{result="failed"}[5m])) /
          sum(rate(captcha_verifications_total[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
          team: security
        annotations:
          summary: "CAPTCHA failure rate > 50%"
          description: "Possible CAPTCHA service issue or attack"

      # Alert 7: Blocked IPs Surge
      - alert: BlockedIPsSurge
        expr: increase(security_blocked_ips_total[10m]) > 100
        labels:
          severity: warning
          team: security
        annotations:
          summary: "Surge in blocked IPs"
          description: "{{ $value }} IPs blocked in last 10 minutes"
```

### Log Aggregation (ELK Stack)

**Structured Logging:**
```typescript
// Log rate limit events
logger.info('rate_limit_hit', {
  event: 'rate_limit_hit',
  ip: req.ip,
  userId: req.user?.id,
  endpoint: req.path,
  method: req.method,
  scope: 'ip',
  limit: 5,
  current: 6,
  resetAt: 1701709200,
  userAgent: req.headers['user-agent'],
  timestamp: Date.now(),
});

// Log account lockout
logger.warn('account_lockout', {
  event: 'account_lockout',
  userId: user.id,
  email: user.email,
  ip: req.ip,
  failedAttempts: 10,
  lockedUntil: 1701712800,
  reason: 'brute_force_attempt',
  timestamp: Date.now(),
});

// Log blocked IP
logger.warn('ip_blocked', {
  event: 'ip_blocked',
  ip: req.ip,
  reason: 'rate_limit_exceeded',
  endpoint: req.path,
  blockDuration: 3600,
  timestamp: Date.now(),
});
```

**Elasticsearch Query Examples:**
```json
// Query 1: Find IPs with most rate limit hits
{
  "query": {
    "bool": {
      "must": [
        { "match": { "event": "rate_limit_hit" }},
        { "range": { "timestamp": { "gte": "now-1h" }}}
      ]
    }
  },
  "aggs": {
    "top_ips": {
      "terms": { "field": "ip", "size": 20 },
      "aggs": {
        "endpoints": { "terms": { "field": "endpoint" }}
      }
    }
  }
}

// Query 2: Find users with frequent lockouts
{
  "query": {
    "bool": {
      "must": [
        { "match": { "event": "account_lockout" }},
        { "range": { "timestamp": { "gte": "now-24h" }}}
      ]
    }
  },
  "aggs": {
    "top_users": {
      "terms": { "field": "userId", "size": 20 }
    }
  }
}
```

### Attack Pattern Detection

**Anomaly Detection (ML-based):**
```python
# Pseudocode: Detect coordinated attacks
def detect_coordinated_attack(logs, window_minutes=10):
    """
    Detect if multiple IPs are attacking same accounts
    (credential stuffing via botnet)
    """

    # Group failed logins by account
    failed_logins = logs.filter(event='login_failed')

    grouped = failed_logins.groupby('userId').agg({
        'ip': 'nunique',         # Unique IPs per account
        'attempts': 'count',     # Total attempts
    })

    # Alert if single account targeted from many IPs
    suspicious = grouped[
        (grouped['ip'] > 5) &          # >5 different IPs
        (grouped['attempts'] > 20)     # >20 attempts
    ]

    if len(suspicious) > 0:
        alert('credential_stuffing_detected', {
            'accounts': suspicious.index.tolist(),
            'severity': 'high',
        })

# Run every 5 minutes
schedule.every(5).minutes.do(detect_coordinated_attack)
```

---

## Implementation Details

### Redis Configuration

**Production Setup:**
```yaml
# redis.conf
# Redis configuration for rate limiting

# Persistence: RDB snapshots (rate limit data is ephemeral, but keep for recovery)
save 900 1        # Save if 1 key changed in 15 minutes
save 300 10       # Save if 10 keys changed in 5 minutes
save 60 10000     # Save if 10000 keys changed in 1 minute

# Memory management
maxmemory 2gb
maxmemory-policy allkeys-lru  # Evict least recently used keys

# Networking
bind 0.0.0.0
protected-mode yes
port 6379
tcp-backlog 511

# Security
requirepass ${REDIS_PASSWORD}
rename-command FLUSHDB ""     # Disable dangerous commands
rename-command FLUSHALL ""
rename-command CONFIG ""

# Cluster mode (for high availability)
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000

# Replication
replica-read-only yes
repl-diskless-sync yes

# Lua scripting
lua-time-limit 5000  # 5 second timeout for Lua scripts
```

**Kubernetes Deployment:**
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
spec:
  serviceName: redis-cluster
  replicas: 6  # 3 masters + 3 replicas
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
          name: client
        - containerPort: 16379
          name: gossip
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: password
        volumeMounts:
        - name: redis-data
          mountPath: /data
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi
```

### NestJS Middleware Implementation

```typescript
// rate-limiter.middleware.ts
import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const endpoint = this.getEndpointKey(req);
    const rateLimitConfig = this.getRateLimitConfig(endpoint);

    if (!rateLimitConfig) {
      return next();  // No rate limit for this endpoint
    }

    try {
      // Multi-tier rate limit checks
      const checks = [
        this.checkIPRateLimit(req, rateLimitConfig),
        this.checkAccountRateLimit(req, rateLimitConfig),
        this.checkGlobalRateLimit(req, rateLimitConfig),
      ];

      const results = await Promise.all(checks);
      const denied = results.find(r => !r.allowed);

      if (denied) {
        // Set rate limit headers
        this.setRateLimitHeaders(res, denied);

        throw new HttpException({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: denied.message,
            details: {
              limit: denied.limit,
              window: denied.window,
              resetAt: denied.resetAt,
              retryAfter: denied.retryAfter,
              scope: denied.scope,
              policy: denied.policy,
            },
          },
        }, HttpStatus.TOO_MANY_REQUESTS);
      }

      // Set rate limit headers for successful request
      const mostRestrictive = results.reduce((min, curr) =>
        curr.remaining < min.remaining ? curr : min
      );
      this.setRateLimitHeaders(res, mostRestrictive);

      // Store rate limit info in request for logging
      req['rateLimitInfo'] = mostRestrictive;

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      // Redis error - log and allow request (fail open)
      console.error('Rate limiter error:', error);
      next();
    }
  }

  private async checkIPRateLimit(req: Request, config: RateLimitConfig): Promise<RateLimitResult> {
    const ip = this.getClientIP(req);
    const key = `ratelimit:ip:${ip}:${config.endpoint}`;

    return this.checkRateLimit(key, config.ipLimit, config.window, 'ip');
  }

  private async checkAccountRateLimit(req: Request, config: RateLimitConfig): Promise<RateLimitResult> {
    if (!req['user']) {
      return { allowed: true, remaining: Infinity };
    }

    const userId = req['user'].id;
    const key = `ratelimit:account:${userId}:${config.endpoint}`;

    return this.checkRateLimit(key, config.accountLimit, config.window, 'account');
  }

  private async checkGlobalRateLimit(req: Request, config: RateLimitConfig): Promise<RateLimitResult> {
    const key = `ratelimit:global:${config.endpoint}`;

    return this.checkRateLimit(key, config.globalLimit, config.window, 'global');
  }

  private async checkRateLimit(
    key: string,
    limit: number,
    window: number,
    scope: string,
  ): Promise<RateLimitResult> {
    const now = Date.now();

    // Execute Lua script for atomic rate limit check
    const result = await this.redis.evalsha(
      this.rateLimitScriptSha,  // Pre-loaded Lua script SHA
      [key],
      [window, limit, now],
    );

    const [allowed, totalLimit, remaining, resetAt] = result;

    return {
      allowed: allowed === 1,
      limit: totalLimit,
      remaining,
      resetAt,
      retryAfter: resetAt - Math.floor(now / 1000),
      scope,
      policy: `${limit} per ${window / 60} minutes`,
      message: allowed === 1
        ? null
        : `Rate limit exceeded. Try again in ${Math.ceil((resetAt - now / 1000) / 60)} minutes.`,
    };
  }

  private getClientIP(req: Request): string {
    // Priority: CF-Connecting-IP > X-Forwarded-For > req.ip
    const cfIP = req.headers['cf-connecting-ip'] as string;
    if (cfIP && this.isCloudflareRequest(req)) {
      return cfIP;
    }

    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      return this.parseXForwardedFor(forwarded);
    }

    return req.ip;
  }

  private setRateLimitHeaders(res: Response, result: RateLimitResult) {
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', result.resetAt);
    res.setHeader('X-RateLimit-Policy', result.policy);
    res.setHeader('X-RateLimit-Scope', result.scope);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
    }
  }

  private getEndpointKey(req: Request): string {
    // Normalize endpoint for rate limit lookup
    return req.route?.path || req.path;
  }

  private getRateLimitConfig(endpoint: string): RateLimitConfig | null {
    // Lookup rate limit configuration from config service
    return this.config.get(`rateLimits.${endpoint}`);
  }
}

// rate-limit.config.ts
export const rateLimitConfig = {
  '/auth/register': {
    endpoint: '/auth/register',
    ipLimit: 5,
    accountLimit: Infinity,
    globalLimit: 1000,
    window: 3600,  // 1 hour
  },
  '/auth/login': {
    endpoint: '/auth/login',
    ipLimit: 5,
    accountLimit: 10,
    globalLimit: 10000,
    window: 900,  // 15 minutes
  },
  '/auth/forgot-password': {
    endpoint: '/auth/forgot-password',
    ipLimit: 3,
    accountLimit: Infinity,
    globalLimit: 500,
    window: 3600,
  },
  // ... more endpoints
};
```

### Lua Script Management

```typescript
// redis.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RedisService implements OnModuleInit {
  private client: Redis;
  private scriptShas = new Map<string, string>();

  async onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    // Pre-load Lua scripts
    await this.loadLuaScripts();
  }

  private async loadLuaScripts() {
    const scriptsDir = path.join(__dirname, 'lua');
    const scriptFiles = fs.readdirSync(scriptsDir);

    for (const file of scriptFiles) {
      if (!file.endsWith('.lua')) continue;

      const scriptName = file.replace('.lua', '');
      const scriptContent = fs.readFileSync(path.join(scriptsDir, file), 'utf8');

      // Load script into Redis
      const sha = await this.client.script('LOAD', scriptContent);
      this.scriptShas.set(scriptName, sha);

      console.log(`Loaded Lua script: ${scriptName} (SHA: ${sha})`);
    }
  }

  async evalsha(scriptName: string, keys: string[], args: any[]): Promise<any> {
    const sha = this.scriptShas.get(scriptName);

    if (!sha) {
      throw new Error(`Lua script not found: ${scriptName}`);
    }

    return this.client.evalsha(sha, keys.length, ...keys, ...args);
  }

  // Wrapper methods for common operations
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }
}
```

---

## Test Scenarios

### BDD Test Scenarios (Cucumber/Gherkin)

```gherkin
# features/rate-limiting/ip-rate-limiting.feature

Feature: IP-Based Rate Limiting
  As a security engineer
  I want to rate limit requests by IP address
  So that I can prevent brute force attacks from single sources

  Background:
    Given the rate limiter is configured with:
      | endpoint          | limit | window     |
      | /auth/login       | 5     | 15 minutes |
      | /auth/register    | 5     | 1 hour     |
      | /auth/forgot-password | 3 | 1 hour     |

  Scenario: Allow requests within rate limit
    Given I am a client with IP "192.168.1.1"
    When I send 3 POST requests to "/auth/login"
    Then all 3 requests should succeed with status 200
    And the response headers should contain:
      | header                  | value |
      | X-RateLimit-Limit       | 5     |
      | X-RateLimit-Remaining   | 2     |
      | X-RateLimit-Scope       | ip    |

  Scenario: Block requests exceeding rate limit
    Given I am a client with IP "192.168.1.1"
    When I send 6 POST requests to "/auth/login"
    Then the first 5 requests should succeed with status 200
    And the 6th request should fail with status 429
    And the error response should contain:
      | field                   | value                          |
      | error.code              | RATE_LIMIT_EXCEEDED            |
      | error.details.limit     | 5                              |
      | error.details.scope     | ip                             |
    And the response should have header "Retry-After" with value > 0

  Scenario: Reset rate limit after window expires
    Given I am a client with IP "192.168.1.1"
    And I have sent 5 POST requests to "/auth/login"
    And the rate limit window has expired
    When I send 1 POST request to "/auth/login"
    Then the request should succeed with status 200
    And the response header "X-RateLimit-Remaining" should be "4"

  Scenario: Different IPs have independent rate limits
    Given client A has IP "192.168.1.1"
    And client B has IP "192.168.1.2"
    When client A sends 5 POST requests to "/auth/login"
    And client B sends 5 POST requests to "/auth/login"
    Then all 10 requests should succeed with status 200

  Scenario: Rate limits apply per endpoint
    Given I am a client with IP "192.168.1.1"
    When I send 5 POST requests to "/auth/login"
    And I send 5 POST requests to "/auth/register"
    Then all 10 requests should succeed with status 200

  Scenario: Sliding window prevents burst at boundary
    Given I am a client with IP "192.168.1.1"
    And the current time is "00:00:00"
    When I send 5 POST requests to "/auth/login"
    And the current time advances to "00:14:59" (14:59 into 15-min window)
    And I send 5 more POST requests to "/auth/login"
    Then the last 5 requests should fail with status 429
    # Because sliding window counts previous window's requests

  Scenario: X-Forwarded-For header is validated
    Given I am a client with IP "10.0.0.1" (internal network)
    And I send a POST request to "/auth/login" with headers:
      | header            | value                  |
      | X-Forwarded-For   | 1.2.3.4, 10.0.0.1      |
    Then the rate limiter should use IP "1.2.3.4" for rate limiting
    And not IP "10.0.0.1"

  Scenario: Spoofed X-Forwarded-For is rejected
    Given I am a client with IP "1.2.3.4" (external)
    And I send a POST request to "/auth/login" with headers:
      | header            | value                  |
      | X-Forwarded-For   | 8.8.8.8                |
    Then the rate limiter should use IP "1.2.3.4" for rate limiting
    And not IP "8.8.8.8"
    # Because 1.2.3.4 is not a trusted proxy

  Scenario: Cloudflare CF-Connecting-IP is trusted
    Given Cloudflare proxy has IP "173.245.48.10"
    And I am a client behind Cloudflare
    When I send a POST request to "/auth/login" with headers:
      | header              | value          |
      | CF-Connecting-IP    | 1.2.3.4        |
    And the request comes from IP "173.245.48.10"
    Then the rate limiter should use IP "1.2.3.4" for rate limiting
```

```gherkin
# features/rate-limiting/account-rate-limiting.feature

Feature: Account-Based Rate Limiting
  As a security engineer
  I want to rate limit requests by account
  So that I can prevent credential stuffing across multiple IPs

  Background:
    Given the rate limiter is configured with:
      | endpoint      | account_limit | window  |
      | /auth/login   | 10            | 1 hour  |

  Scenario: Prevent credential stuffing from multiple IPs
    Given a user account "user@example.com" exists
    And I have 3 clients with different IPs:
      | client | ip          |
      | A      | 1.2.3.4     |
      | B      | 5.6.7.8     |
      | C      | 9.10.11.12  |
    When client A sends 4 failed login requests for "user@example.com"
    And client B sends 4 failed login requests for "user@example.com"
    And client C sends 4 failed login requests for "user@example.com"
    Then the first 10 requests should succeed with status 401 (wrong password)
    And the 11th and 12th requests should fail with status 429
    And the error should indicate "account" rate limit exceeded

  Scenario: Account rate limit persists across sessions
    Given a user account "user@example.com" exists
    When I send 10 failed login requests for "user@example.com"
    And I wait 30 minutes
    And I send 1 more failed login request for "user@example.com"
    Then the request should fail with status 429
    # Because we're still within the 1-hour window

  Scenario: Successful login resets attempt counter
    Given a user account "user@example.com" exists
    When I send 5 failed login requests for "user@example.com"
    And I send 1 successful login request for "user@example.com"
    And I send 5 more failed login requests for "user@example.com"
    Then the last 5 requests should succeed with status 401
    # Because successful login reset the counter
```

```gherkin
# features/rate-limiting/account-lockout.feature

Feature: Account Lockout
  As a security engineer
  I want to lock accounts after repeated failed login attempts
  So that I can prevent brute force attacks

  Background:
    Given the lockout policy is configured with:
      | attempts | lockout_duration |
      | 3        | 5 minutes        |
      | 5        | 15 minutes       |
      | 7        | 1 hour           |
      | 10       | 24 hours         |

  Scenario: Lock account after 5 failed attempts
    Given a user account "user@example.com" exists
    When I send 5 failed login requests for "user@example.com"
    Then the account should be locked
    And subsequent login requests should fail with status 423 (Locked)
    And the error response should contain:
      | field                     | value                              |
      | error.code                | ACCOUNT_LOCKED                     |
      | error.details.lockoutReason | 5 failed login attempts in 15 min |
      | error.details.unlockMethods | ["time", "email"]                  |

  Scenario: Send email notification on lockout
    Given a user account "user@example.com" exists
    When I send 5 failed login requests for "user@example.com"
    Then the account should be locked
    And an email should be sent to "user@example.com" with:
      | subject | Security Alert: Account Locked |
      | body    | contains "5 failed login attempts" |
      | link    | unlock URL with token |

  Scenario: Unlock account via email link
    Given a user account "user@example.com" is locked
    And an unlock email was sent with token "abc123xyz"
    When I visit the unlock URL "/auth/unlock?token=abc123xyz"
    Then the account should be unlocked
    And I should be able to login successfully

  Scenario: Unlock account automatically after timeout
    Given a user account "user@example.com" is locked
    And the lockout duration is 5 minutes
    When 5 minutes have passed
    And I send a login request for "user@example.com"
    Then the account should be unlocked
    And the login should proceed normally (succeed or fail based on credentials)

  Scenario: Progressive lockout durations
    Given a user account "user@example.com" exists

    # First lockout: 5 minutes (after 3 attempts)
    When I send 3 failed login requests
    Then the account should be locked for 5 minutes

    # Wait for unlock and trigger second lockout
    When the lockout expires
    And I send 5 failed login requests
    Then the account should be locked for 15 minutes

    # Wait for unlock and trigger third lockout
    When the lockout expires
    And I send 7 failed login requests
    Then the account should be locked for 1 hour

  Scenario: Admin can manually unlock account
    Given a user account "user@example.com" is locked
    And I am an authenticated admin
    When I POST to "/admin/unlock-account" with:
      | userId | user-id-123           |
      | reason | User verified via phone |
    Then the account should be unlocked
    And an audit log entry should be created
    And the user should receive an email notification

  Scenario: IP lockout separate from account lockout
    Given a user account "user@example.com" exists
    When I send 5 failed login requests for "user@example.com" from IP "1.2.3.4"
    Then the account "user@example.com" should be locked
    And the IP "1.2.3.4" should be locked

    When another user tries to login from IP "1.2.3.4"
    Then the request should fail with status 429
    And the error should indicate IP is locked
```

```gherkin
# features/rate-limiting/captcha-integration.feature

Feature: CAPTCHA Integration
  As a security engineer
  I want to challenge suspicious requests with CAPTCHA
  So that I can distinguish humans from bots

  Background:
    Given reCAPTCHA v3 is configured
    And the score thresholds are:
      | threshold | action    |
      | >= 0.7    | Allow     |
      | 0.3-0.7   | Challenge |
      | < 0.3     | Block     |

  Scenario: Allow high-score requests without challenge
    Given I am a legitimate user
    When I submit a login form
    And reCAPTCHA returns a score of 0.9
    Then the login request should succeed without challenge
    And no visible CAPTCHA should be shown

  Scenario: Show challenge for medium-score requests
    Given I am a user with suspicious behavior
    When I submit a login form
    And reCAPTCHA returns a score of 0.5
    Then the server should respond with status 428 (Precondition Required)
    And the response should contain:
      | field           | value                          |
      | error.code      | CAPTCHA_CHALLENGE_REQUIRED     |
      | error.showV2    | true                           |
    And a reCAPTCHA v2 checkbox should be displayed

  Scenario: Block low-score requests
    Given I am a bot
    When I submit a login form
    And reCAPTCHA returns a score of 0.1
    Then the request should be blocked with status 403
    And the error should indicate "CAPTCHA verification failed"

  Scenario: Trigger CAPTCHA after failed attempts
    Given I am a user with IP "1.2.3.4"
    When I send 3 failed login requests
    Then the next login request should require CAPTCHA
    And the response should have status 428

  Scenario: CAPTCHA required for password reset after suspicious activity
    Given I have sent 2 password reset requests in 1 hour
    When I send a 3rd password reset request
    Then CAPTCHA should be required
    And the response should have status 428

  Scenario: Fallback when reCAPTCHA service is down
    Given reCAPTCHA service is unavailable
    When I submit a login form
    Then the request should be allowed (fail open)
    But stricter rate limits should be applied
    And an alert should be sent to the security team

  Scenario: Alternative verification via email
    Given I cannot solve the CAPTCHA (accessibility issue)
    When I click "Try email verification instead"
    Then a verification code should be sent to my email
    And I can enter the code to bypass CAPTCHA

  Scenario: CAPTCHA score logged for analysis
    Given I submit a login form with CAPTCHA
    When the request is processed
    Then the CAPTCHA score should be logged
    And included in the audit trail
    And sent to analytics for bot detection tuning
```

```gherkin
# features/rate-limiting/distributed-rate-limiting.feature

Feature: Distributed Rate Limiting
  As a platform engineer
  I want rate limits to work correctly across multiple servers
  So that limits are enforced consistently

  Background:
    Given the application is deployed with:
      | servers | 3 |
      | redis   | Redis Cluster (3 masters, 3 replicas) |

  Scenario: Rate limit shared across servers
    Given I am a client with IP "1.2.3.4"
    And the rate limit is 5 requests per 15 minutes
    When I send 2 requests to server-1
    And I send 2 requests to server-2
    And I send 2 requests to server-3
    Then the first 5 requests should succeed
    And the 6th request should fail with status 429
    # Proves rate limit is shared via Redis

  Scenario: Atomic counter increments prevent race conditions
    Given 10 clients send requests simultaneously
    And each client sends 1 request
    And the global rate limit is 5 requests
    When all 10 requests are processed concurrently
    Then exactly 5 requests should succeed
    And exactly 5 requests should fail with status 429
    # Lua script ensures atomicity

  Scenario: Redis failover preserves rate limiting
    Given Redis master node fails
    When Redis Sentinel promotes a replica to master
    Then rate limiting should continue working
    And requests should use the new master node

  Scenario: Graceful degradation when Redis is unavailable
    Given Redis cluster is completely down
    When I send requests to the API
    Then requests should be allowed (fail open)
    But in-memory rate limiting should be active
    And limits should be multiplied by server count
    And an alert should be sent to the infrastructure team

  Scenario: Redis connection restored
    Given Redis was down and in-memory fallback was active
    When Redis cluster comes back online
    Then the application should reconnect automatically
    And distributed rate limiting should resume
    And in-memory counters should be discarded

  Scenario: Lua script performance under load
    Given the system is under high load (10,000 req/sec)
    When rate limit checks are performed
    Then the p95 latency should be < 10ms
    And the p99 latency should be < 50ms
    And no rate limit checks should timeout
```

```gherkin
# features/rate-limiting/monitoring-alerts.feature

Feature: Rate Limiting Monitoring & Alerts
  As a security engineer
  I want to monitor rate limiting metrics and receive alerts
  So that I can detect and respond to attacks

  Scenario: Metrics exported to Prometheus
    When I query Prometheus for rate limit metrics
    Then the following metrics should be available:
      | metric                            | labels                         |
      | rate_limit_requests_total         | endpoint, scope, result        |
      | rate_limit_hits_total             | endpoint, scope, reason        |
      | rate_limit_usage                  | key, endpoint                  |
      | rate_limit_check_duration_seconds | -                              |
      | security_attacks_detected_total   | type, severity                 |
      | security_blocked_ips_total        | reason                         |
      | security_account_lockouts_total   | reason, duration               |

  Scenario: Alert on high rate limit hit rate
    Given the alert threshold is 100 hits per minute
    When rate limit hits exceed 100/min for 5 minutes
    Then a PagerDuty alert should be sent
    And the alert should contain:
      | field       | value                               |
      | severity    | warning                             |
      | summary     | High rate limit hit rate on /auth/login |
      | dashboard   | link to Grafana dashboard           |

  Scenario: Alert on DDoS attack
    Given the alert threshold is 1000 hits per minute
    When rate limit hits exceed 1000/min for 2 minutes
    Then a critical PagerDuty alert should be sent
    And the on-call engineer should be paged
    And the alert should link to the DDoS runbook

  Scenario: Alert on brute force attack
    Given the alert threshold is 10 lockouts per 5 minutes
    When account lockouts exceed 10 in 5 minutes
    Then a high-severity alert should be sent
    And the security team should be notified via Slack

  Scenario: Alert on rate limiter failure
    Given the rate limiter is experiencing errors
    When error rate exceeds 10 per minute
    Then a critical alert should be sent
    And the alert should indicate "Redis may be down"

  Scenario: Grafana dashboard displays metrics
    When I open the Rate Limiting Grafana dashboard
    Then I should see panels for:
      | panel                          | description                              |
      | Rate Limit Hit Rate            | Requests blocked per minute              |
      | Top Rate Limited Endpoints     | Endpoints with most hits                 |
      | Blocked IPs Over Time          | Number of IPs blocked                    |
      | Account Lockouts               | Account lockouts in last hour            |
      | CAPTCHA Success Rate           | % of CAPTCHA challenges passed           |
      | Attack Detection               | Security attacks detected                |
      | Rate Limiter Latency           | p95 latency of rate limit checks         |

  Scenario: Logs aggregated in Elasticsearch
    Given rate limit events are logged
    When I query Elasticsearch for event="rate_limit_hit"
    Then I should be able to filter by:
      | field       | values                           |
      | ip          | Any IP address                   |
      | userId      | Any user ID                      |
      | endpoint    | /auth/login, /auth/register, etc |
      | timestamp   | Any time range                   |
    And I should see aggregated statistics:
      | stat                    | description              |
      | Top IPs by hit count    | IPs with most hits       |
      | Top endpoints by hits   | Most blocked endpoints   |
      | Lockouts over time      | Lockouts per hour        |
```

---

## Summary & Recommendations

### Implementation Priorities

**Phase 1: Core Rate Limiting (Week 1-2)**
1. ✅ Redis cluster setup (3 masters, 3 replicas)
2. ✅ Lua script implementation (sliding window counter)
3. ✅ NestJS middleware integration
4. ✅ IP-based rate limiting for /auth/* endpoints
5. ✅ X-Forwarded-For validation

**Phase 2: Advanced Features (Week 3-4)**
1. ✅ Account-based rate limiting
2. ✅ Progressive lockout policy
3. ✅ Email notifications (lockout alerts)
4. ✅ Admin unlock endpoints
5. ✅ Cloudflare integration

**Phase 3: CAPTCHA & Monitoring (Week 5-6)**
1. ✅ reCAPTCHA v3 integration
2. ✅ CAPTCHA fallback to v2
3. ✅ Prometheus metrics
4. ✅ Grafana dashboards
5. ✅ PagerDuty alerts
6. ✅ ELK log aggregation

**Phase 4: Testing & Optimization (Week 7-8)**
1. ✅ BDD test suite (30+ scenarios)
2. ✅ Load testing (10k req/sec)
3. ✅ Redis failover testing
4. ✅ Attack simulation (DDoS, brute force)
5. ✅ Performance optimization

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Rate Limit Check Latency (p95) | < 10ms | Lua script execution |
| Rate Limit Check Latency (p99) | < 50ms | Including network |
| Redis Memory Usage | < 2GB | For 1M rate limit keys |
| Redis Availability | 99.99% | With cluster + Sentinel |
| False Positive Rate | < 0.1% | Legitimate users blocked |
| Attack Detection Time | < 5min | From first request to alert |

### Security Hardening

**Pre-Deployment Checklist:**
- [ ] Redis password authentication enabled
- [ ] Redis dangerous commands disabled (FLUSHALL, CONFIG)
- [ ] Cloudflare IP ranges updated (automated)
- [ ] reCAPTCHA keys stored in secrets manager
- [ ] Rate limit configs reviewed by security team
- [ ] Penetration testing completed
- [ ] DDoS runbook created and tested
- [ ] Incident response plan documented

### Operational Runbooks

**DDoS Attack Response:**
1. Confirm attack via Grafana (hit rate > 1000/min)
2. Identify attack vectors (endpoints, IPs)
3. Tighten rate limits temporarily (5x stricter)
4. Enable Cloudflare "I'm Under Attack" mode
5. Block top offending IPs at firewall level
6. Scale Redis cluster if memory pressure
7. Post-incident: Analyze logs, adjust policies

**Redis Cluster Failure:**
1. Check Redis Sentinel status (`redis-cli sentinel masters`)
2. If master down, wait for automatic failover (30s)
3. If failover fails, manually promote replica (`redis-cli SLAVEOF NO ONE`)
4. Update application config to point to new master
5. Restart application pods to reconnect
6. Monitor fallback to in-memory rate limiting
7. Post-incident: Review Redis cluster config

---

## Appendix

### A. Rate Limit Configuration File

```yaml
# config/rate-limits.yaml
rate_limits:
  defaults:
    enabled: true
    fallback_behavior: allow  # fail open
    redis_timeout: 100  # ms

  endpoints:
    # Authentication
    "/auth/register":
      ip_limit: 5
      ip_window: 3600  # 1 hour
      global_limit: 1000
      global_window: 3600
      captcha:
        enabled: true
        threshold: 3  # Show after 3 attempts

    "/auth/login":
      ip_limit: 5
      ip_window: 900  # 15 minutes
      account_limit: 10
      account_window: 3600
      global_limit: 10000
      global_window: 900
      lockout:
        enabled: true
        thresholds:
          - attempts: 3, duration: 300
          - attempts: 5, duration: 900
          - attempts: 7, duration: 3600
          - attempts: 10, duration: 86400
      captcha:
        enabled: true
        threshold: 3

    "/auth/forgot-password":
      ip_limit: 3
      ip_window: 3600
      global_limit: 500
      global_window: 3600
      captcha:
        enabled: true
        threshold: 2

    "/auth/refresh":
      user_limit: 10
      user_window: 60

    # API
    "/api/*":
      user_limit: 100
      user_window: 60
      global_limit: 100000
      global_window: 60

    "/api/search":
      user_limit: 30
      user_window: 60

    "/api/uploads":
      user_limit: 10
      user_window: 3600

    "/api/admin/*":
      user_limit: 20
      user_window: 60
      require_role: admin
```

### B. Cloudflare IP Ranges Update Script

```bash
#!/bin/bash
# scripts/update-cloudflare-ips.sh

set -euo pipefail

echo "Updating Cloudflare IP ranges..."

# Download latest IP ranges
curl -s https://www.cloudflare.com/ips-v4 > /tmp/cloudflare-ips-v4.txt
curl -s https://www.cloudflare.com/ips-v6 > /tmp/cloudflare-ips-v6.txt

# Validate downloads
if [ ! -s /tmp/cloudflare-ips-v4.txt ]; then
  echo "Error: Failed to download IPv4 ranges"
  exit 1
fi

# Generate TypeScript config
cat > src/config/cloudflare-ips.ts <<EOF
// Auto-generated on $(date)
// DO NOT EDIT MANUALLY

export const cloudflareIPv4Ranges = [
$(while read -r ip; do echo "  '$ip',"; done < /tmp/cloudflare-ips-v4.txt)
];

export const cloudflareIPv6Ranges = [
$(while read -r ip; do echo "  '$ip',"; done < /tmp/cloudflare-ips-v6.txt)
];
EOF

echo "Cloudflare IP ranges updated successfully"

# Restart application to pick up new config
kubectl rollout restart deployment/api-server
```

### C. Load Testing Script

```bash
#!/bin/bash
# scripts/load-test-rate-limiting.sh

set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
ENDPOINT="/auth/login"
RATE_LIMIT=5
DURATION=60  # seconds

echo "Load testing rate limiting on ${API_URL}${ENDPOINT}"
echo "Expected limit: ${RATE_LIMIT} requests per 15 minutes"

# Test 1: Verify rate limit enforced
echo "Test 1: Sending ${RATE_LIMIT} + 1 requests..."
for i in $(seq 1 $(($RATE_LIMIT + 1))); do
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    "${API_URL}${ENDPOINT}")

  if [ $i -le $RATE_LIMIT ]; then
    if [ "$response" != "401" ]; then
      echo "❌ Request $i failed: Expected 401, got $response"
      exit 1
    fi
  else
    if [ "$response" != "429" ]; then
      echo "❌ Request $i failed: Expected 429, got $response"
      exit 1
    fi
  fi
done
echo "✅ Test 1 passed: Rate limit enforced correctly"

# Test 2: Concurrent requests from multiple IPs
echo "Test 2: Concurrent requests from 10 different IPs..."
for i in $(seq 1 10); do
  IP="192.168.1.$i"
  curl -s -o /dev/null \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: $IP" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    "${API_URL}${ENDPOINT}" &
done
wait
echo "✅ Test 2 passed: Multiple IPs handled correctly"

# Test 3: Performance test
echo "Test 3: Performance test (${DURATION}s at 100 req/sec)..."
ab -n $(($DURATION * 100)) -c 10 -t $DURATION \
  -p test-data/login.json \
  -T "application/json" \
  "${API_URL}${ENDPOINT}" > /tmp/ab-results.txt

# Extract metrics
requests_per_sec=$(grep "Requests per second" /tmp/ab-results.txt | awk '{print $4}')
p95_latency=$(grep "95%" /tmp/ab-results.txt | awk '{print $2}')

echo "Requests/sec: $requests_per_sec"
echo "P95 latency: ${p95_latency}ms"

if (( $(echo "$p95_latency > 100" | bc -l) )); then
  echo "⚠️  Warning: P95 latency > 100ms"
fi

echo "✅ All tests passed"
```

### D. Metrics Query Examples

```promql
# Prometheus queries for Grafana

# 1. Rate limit hit rate (per minute)
rate(rate_limit_hits_total[1m])

# 2. Top 10 rate limited endpoints
topk(10, sum by (endpoint, scope) (rate_limit_hits_total))

# 3. Rate limit usage distribution (p95)
histogram_quantile(0.95, rate_limit_usage)

# 4. Blocked IPs in last 24 hours
increase(security_blocked_ips_total[24h])

# 5. Account lockouts (1h)
increase(security_account_lockouts_total[1h])

# 6. CAPTCHA success rate
sum(rate(captcha_verifications_total{result="passed"}[5m])) /
sum(rate(captcha_verifications_total[5m]))

# 7. Security attacks detected
increase(security_attacks_detected_total[1h])

# 8. Rate limiter p95 latency
histogram_quantile(0.95, rate(rate_limit_check_duration_seconds_bucket[5m]))

# 9. Rate limit requests by result
sum by (result) (rate(rate_limit_requests_total[1m]))

# 10. Redis availability
redis_up

# 11. Rate limit fallback triggered
rate(rate_limit_fallback_triggered_total[5m])

# 12. Top IPs by request count
topk(20, sum by (ip) (rate_limit_requests_total))
```

---

**Document Control:**
- **Version:** 1.0.0
- **Status:** Architecture Specification (APPROVED for Implementation)
- **Next Review:** After Phase 1 implementation
- **Approvals Required:** Security Team, Infrastructure Team, Product Owner
- **Related Documents:**
  - Authentication Architecture Specification
  - Security Threat Model
  - Incident Response Plan
  - Performance Requirements

**Change Log:**
- 2025-12-04: Initial version (comprehensive distributed rate limiting strategy)

---

*This document is maintained by the Security & Infrastructure team. For questions or suggestions, contact security@example.com.*

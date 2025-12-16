# Admin Panel Security Specification

**Project**: Community Social Network MVP
**Milestone**: M8 - Admin & Moderation
**Version**: 1.0.0
**Date**: 2025-12-16
**Status**: SPECIFICATION COMPLETE

---

## Executive Summary

This document specifies the security hardening, access controls, and audit logging requirements for the admin panel. It addresses the gaps identified in the requirements validation report.

### Key Specifications
- **Authentication**: 2FA mandatory for all admin accounts
- **Authorization**: Role-based access with IP whitelisting
- **Audit Logging**: Complete trail of all admin actions
- **Session Security**: 4-hour timeout, single-session enforcement
- **Rate Limiting**: Strict limits on admin endpoints

---

## 1. Admin Role Hierarchy

### 1.1 Role Definitions

| Role | Level | Capabilities | Requirements |
|------|-------|--------------|--------------|
| **Super Admin** | 3 | Full system access, can create admins | 2FA + IP whitelist + approval |
| **Admin** | 2 | User management, content moderation, reports | 2FA + IP whitelist |
| **Moderator** | 1 | Content moderation, user warnings | 2FA required |

### 1.2 Permission Matrix

| Action | Super Admin | Admin | Moderator |
|--------|-------------|-------|-----------|
| View admin dashboard | ✅ | ✅ | ✅ |
| View user details | ✅ | ✅ | ✅ |
| Warn user | ✅ | ✅ | ✅ |
| Suspend user (7 days) | ✅ | ✅ | ✅ |
| Ban user (permanent) | ✅ | ✅ | ❌ |
| Delete content | ✅ | ✅ | ✅ |
| Delete user | ✅ | ✅ | ❌ |
| View audit logs | ✅ | ✅ | ❌ |
| Create moderator | ✅ | ✅ | ❌ |
| Create admin | ✅ | ❌ | ❌ |
| Manage system settings | ✅ | ❌ | ❌ |
| View security reports | ✅ | ✅ | ❌ |
| Export user data (GDPR) | ✅ | ✅ | ❌ |
| IP whitelist management | ✅ | ❌ | ❌ |

---

## 2. Two-Factor Authentication (2FA)

### 2.1 2FA Requirements

| Requirement | Specification |
|-------------|---------------|
| Mandatory | Yes, for all admin roles |
| Methods | TOTP (Google Authenticator, Authy) |
| Backup codes | 10 one-time use codes |
| Recovery | Super Admin can reset 2FA with identity verification |
| Grace period | None - 2FA required on first admin login |

### 2.2 TOTP Implementation

```typescript
// server/src/auth/totp.ts
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

interface TOTPSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

async function setupTOTP(userId: string): Promise<TOTPSetup> {
  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `CommunityNetwork:${userId}`,
    length: 32,
  });

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  // Generate backup codes
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  // Store encrypted secret and hashed backup codes
  const hashedBackupCodes = await Promise.all(
    backupCodes.map(code => bcrypt.hash(code, 10))
  );

  await db.adminTwoFactor.create({
    data: {
      user_id: userId,
      secret: encrypt(secret.base32),
      backup_codes: hashedBackupCodes,
      enabled: false, // Enabled after first verification
    },
  });

  return { secret: secret.base32, qrCodeUrl, backupCodes };
}

async function verifyTOTP(userId: string, token: string): Promise<boolean> {
  const twoFactor = await db.adminTwoFactor.findUnique({
    where: { user_id: userId },
  });

  if (!twoFactor) return false;

  const secret = decrypt(twoFactor.secret);

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 30 second window
  });

  if (verified && !twoFactor.enabled) {
    await db.adminTwoFactor.update({
      where: { user_id: userId },
      data: { enabled: true },
    });
  }

  return verified;
}

async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const twoFactor = await db.adminTwoFactor.findUnique({
    where: { user_id: userId },
  });

  if (!twoFactor) return false;

  // Check against hashed backup codes
  for (let i = 0; i < twoFactor.backup_codes.length; i++) {
    const matches = await bcrypt.compare(code.toUpperCase(), twoFactor.backup_codes[i]);
    if (matches) {
      // Remove used backup code
      const updatedCodes = [...twoFactor.backup_codes];
      updatedCodes.splice(i, 1);
      await db.adminTwoFactor.update({
        where: { user_id: userId },
        data: { backup_codes: updatedCodes },
      });
      return true;
    }
  }

  return false;
}
```

---

## 3. IP Whitelisting

### 3.1 Whitelist Configuration

```typescript
// server/src/admin/ipWhitelist.ts

interface IPWhitelistEntry {
  id: string;
  ip_address: string;
  cidr_range?: string;
  description: string;
  added_by: string;
  added_at: Date;
  expires_at?: Date;
}

// Database schema
/*
CREATE TABLE admin_ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET,
  cidr_range CIDR,
  description VARCHAR(255) NOT NULL,
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT ip_or_cidr CHECK (ip_address IS NOT NULL OR cidr_range IS NOT NULL)
);

CREATE INDEX idx_whitelist_ip ON admin_ip_whitelist(ip_address);
*/

async function isIPWhitelisted(ip: string): Promise<boolean> {
  const result = await db.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*) as count FROM admin_ip_whitelist
    WHERE (
      ip_address = ${ip}::inet
      OR ${ip}::inet <<= cidr_range
    )
    AND (expires_at IS NULL OR expires_at > NOW())
  `;

  return result[0].count > 0;
}

async function addToWhitelist(
  ip: string,
  description: string,
  addedBy: string,
  expiresAt?: Date
): Promise<IPWhitelistEntry> {
  const entry = await db.adminIpWhitelist.create({
    data: {
      ip_address: ip,
      description,
      added_by: addedBy,
      expires_at: expiresAt,
    },
  });

  await auditLog.record({
    action: 'IP_WHITELIST_ADD',
    actor_id: addedBy,
    details: { ip, description },
  });

  return entry;
}
```

### 3.2 IP Whitelist Middleware

```typescript
// server/src/middleware/adminIpWhitelist.ts

export const adminIPWhitelistMiddleware: RequestHandler = async (req, res, next) => {
  const clientIP = getClientIP(req);
  const user = req.user;

  // Skip for non-admin routes
  if (!req.path.startsWith('/api/admin')) {
    return next();
  }

  // Super Admin and Admin require IP whitelist
  if (user.role === 'super_admin' || user.role === 'admin') {
    const isWhitelisted = await isIPWhitelisted(clientIP);

    if (!isWhitelisted) {
      await auditLog.record({
        action: 'ADMIN_ACCESS_DENIED',
        actor_id: user.id,
        details: { reason: 'IP not whitelisted', ip: clientIP },
      });

      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not authorized for admin access',
      });
    }
  }

  next();
};

function getClientIP(req: Request): string {
  // Trust Cloudflare's CF-Connecting-IP header
  const cfIP = req.headers['cf-connecting-ip'];
  if (cfIP) return Array.isArray(cfIP) ? cfIP[0] : cfIP;

  // Fallback to X-Forwarded-For
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const ips = (Array.isArray(xff) ? xff[0] : xff).split(',');
    return ips[0].trim();
  }

  return req.socket.remoteAddress || '0.0.0.0';
}
```

---

## 4. Session Security

### 4.1 Admin Session Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| Session timeout | 4 hours | Balance security and usability |
| Idle timeout | 30 minutes | Force re-auth on inactivity |
| Single session | Enforced | Prevent session sharing |
| Session binding | IP + User-Agent | Detect session hijacking |
| Re-auth for sensitive | Required | Extra protection for critical actions |

### 4.2 Session Management

```typescript
// server/src/admin/session.ts

interface AdminSession {
  id: string;
  user_id: string;
  token: string;
  ip_address: string;
  user_agent: string;
  created_at: Date;
  last_activity: Date;
  expires_at: Date;
}

const SESSION_CONFIG = {
  maxAge: 4 * 60 * 60 * 1000,     // 4 hours
  idleTimeout: 30 * 60 * 1000,    // 30 minutes
  singleSession: true,
};

async function createAdminSession(
  userId: string,
  ip: string,
  userAgent: string
): Promise<AdminSession> {
  // Invalidate existing sessions (single session enforcement)
  if (SESSION_CONFIG.singleSession) {
    await db.adminSessions.deleteMany({
      where: { user_id: userId },
    });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();

  const session = await db.adminSessions.create({
    data: {
      user_id: userId,
      token: hashToken(token),
      ip_address: ip,
      user_agent: userAgent,
      created_at: now,
      last_activity: now,
      expires_at: new Date(now.getTime() + SESSION_CONFIG.maxAge),
    },
  });

  return { ...session, token };
}

async function validateAdminSession(
  token: string,
  ip: string,
  userAgent: string
): Promise<AdminSession | null> {
  const session = await db.adminSessions.findFirst({
    where: {
      token: hashToken(token),
      expires_at: { gt: new Date() },
    },
  });

  if (!session) return null;

  // Check idle timeout
  const idleTime = Date.now() - session.last_activity.getTime();
  if (idleTime > SESSION_CONFIG.idleTimeout) {
    await db.adminSessions.delete({ where: { id: session.id } });
    return null;
  }

  // Verify IP and User-Agent binding
  if (session.ip_address !== ip || session.user_agent !== userAgent) {
    await auditLog.record({
      action: 'SESSION_HIJACK_ATTEMPT',
      actor_id: session.user_id,
      details: {
        original_ip: session.ip_address,
        current_ip: ip,
        original_ua: session.user_agent,
        current_ua: userAgent,
      },
    });
    await db.adminSessions.delete({ where: { id: session.id } });
    return null;
  }

  // Update last activity
  await db.adminSessions.update({
    where: { id: session.id },
    data: { last_activity: new Date() },
  });

  return session;
}
```

### 4.3 Sensitive Action Re-authentication

```typescript
// Actions requiring re-authentication
const SENSITIVE_ACTIONS = [
  'DELETE_USER',
  'BAN_USER',
  'CREATE_ADMIN',
  'MODIFY_SYSTEM_SETTINGS',
  'EXPORT_USER_DATA',
  'MODIFY_IP_WHITELIST',
];

async function requireReauth(
  userId: string,
  action: string,
  password: string
): Promise<boolean> {
  if (!SENSITIVE_ACTIONS.includes(action)) {
    return true; // No reauth needed
  }

  const user = await db.users.findUnique({
    where: { id: userId },
    select: { password_hash: true },
  });

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    await auditLog.record({
      action: 'REAUTH_FAILED',
      actor_id: userId,
      details: { attempted_action: action },
    });
  }

  return valid;
}
```

---

## 5. Audit Logging

### 5.1 Audit Log Schema

```sql
CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    actor_id UUID REFERENCES users(id),
    target_type VARCHAR(50),
    target_id UUID,
    ip_address INET,
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_actor ON admin_audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_action ON admin_audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_target ON admin_audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX idx_audit_time ON admin_audit_logs(created_at DESC);

-- Partition by month for performance
CREATE TABLE admin_audit_logs_y2025m12 PARTITION OF admin_audit_logs
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
```

### 5.2 Audit Actions

| Action | Description | Details Captured |
|--------|-------------|------------------|
| `ADMIN_LOGIN` | Admin logged in | IP, 2FA method |
| `ADMIN_LOGIN_FAILED` | Failed login attempt | IP, reason |
| `ADMIN_LOGOUT` | Admin logged out | Session duration |
| `USER_WARNED` | User received warning | User ID, reason |
| `USER_SUSPENDED` | User account suspended | User ID, duration, reason |
| `USER_BANNED` | User account banned | User ID, reason |
| `USER_UNBANNED` | User ban lifted | User ID |
| `USER_DELETED` | User account deleted | User ID, data retention |
| `CONTENT_DELETED` | Content removed | Content ID, type, reason |
| `CONTENT_RESTORED` | Content restored | Content ID, type |
| `ADMIN_CREATED` | New admin created | New admin ID, role |
| `ADMIN_ROLE_CHANGED` | Admin role modified | Admin ID, old role, new role |
| `ADMIN_REMOVED` | Admin access revoked | Admin ID |
| `IP_WHITELIST_ADD` | IP added to whitelist | IP, CIDR, expiry |
| `IP_WHITELIST_REMOVE` | IP removed from whitelist | IP |
| `SETTING_CHANGED` | System setting modified | Setting name, old value, new value |
| `DATA_EXPORTED` | User data exported (GDPR) | User ID, format |
| `SESSION_HIJACK_ATTEMPT` | Potential session hijack | Original IP, new IP |
| `REAUTH_FAILED` | Re-authentication failed | Attempted action |

### 5.3 Audit Log Service

```typescript
// server/src/admin/auditLog.ts

interface AuditLogEntry {
  action: string;
  actor_id: string;
  target_type?: string;
  target_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, unknown>;
}

class AuditLogService {
  async record(entry: AuditLogEntry): Promise<void> {
    await db.adminAuditLogs.create({
      data: {
        ...entry,
        created_at: new Date(),
      },
    });

    // Alert on critical actions
    if (this.isCriticalAction(entry.action)) {
      await this.sendAlert(entry);
    }
  }

  async query(filters: {
    actor_id?: string;
    action?: string;
    target_type?: string;
    target_id?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AdminAuditLog[]> {
    return db.adminAuditLogs.findMany({
      where: {
        actor_id: filters.actor_id,
        action: filters.action,
        target_type: filters.target_type,
        target_id: filters.target_id,
        created_at: {
          gte: filters.from,
          lte: filters.to,
        },
      },
      orderBy: { created_at: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });
  }

  private isCriticalAction(action: string): boolean {
    return [
      'USER_BANNED',
      'USER_DELETED',
      'ADMIN_CREATED',
      'ADMIN_REMOVED',
      'SETTING_CHANGED',
      'SESSION_HIJACK_ATTEMPT',
    ].includes(action);
  }

  private async sendAlert(entry: AuditLogEntry): Promise<void> {
    await slackNotifier.send({
      channel: '#admin-alerts',
      text: `Critical admin action: ${entry.action}`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Actor', value: entry.actor_id, short: true },
          { title: 'Action', value: entry.action, short: true },
          { title: 'Target', value: `${entry.target_type}:${entry.target_id}` },
          { title: 'Details', value: JSON.stringify(entry.details) },
        ],
      }],
    });
  }
}

export const auditLog = new AuditLogService();
```

---

## 6. Rate Limiting

### 6.1 Admin Endpoint Limits

| Endpoint Category | Limit | Window | Action |
|-------------------|-------|--------|--------|
| Login attempts | 5 | 15 min | Lock account for 1 hour |
| 2FA attempts | 3 | 5 min | Lock account for 1 hour |
| User moderation | 50 | 1 hour | Warning notification |
| Content deletion | 100 | 1 hour | Warning notification |
| Bulk operations | 10 | 1 hour | Block until reviewed |
| Data export | 5 | 24 hours | Hard limit |

### 6.2 Implementation

```typescript
// server/src/admin/rateLimit.ts
import { RateLimiterRedis } from 'rate-limiter-flexible';

const adminRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'admin_rl',
  points: 50,
  duration: 60 * 60, // 1 hour
});

const loginRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'admin_login_rl',
  points: 5,
  duration: 15 * 60, // 15 minutes
  blockDuration: 60 * 60, // Block for 1 hour
});

export async function checkAdminRateLimit(
  userId: string,
  action: string
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const result = await adminRateLimiter.consume(userId);
    return { allowed: true, remaining: result.remainingPoints };
  } catch (rejRes) {
    await auditLog.record({
      action: 'RATE_LIMIT_EXCEEDED',
      actor_id: userId,
      details: { attempted_action: action },
    });
    return { allowed: false, remaining: 0 };
  }
}
```

---

## 7. API Endpoints

```typescript
// Admin Authentication
POST   /api/admin/auth/login          // Admin login (email + password)
POST   /api/admin/auth/2fa            // Verify 2FA token
POST   /api/admin/auth/logout         // Admin logout
POST   /api/admin/auth/2fa/setup      // Set up 2FA
POST   /api/admin/auth/2fa/verify     // Verify 2FA setup
POST   /api/admin/auth/2fa/backup     // Use backup code

// User Management
GET    /api/admin/users               // List users (paginated, filtered)
GET    /api/admin/users/:id           // Get user details
PUT    /api/admin/users/:id/warn      // Issue warning
PUT    /api/admin/users/:id/suspend   // Suspend user
PUT    /api/admin/users/:id/ban       // Ban user
DELETE /api/admin/users/:id/ban       // Unban user
DELETE /api/admin/users/:id           // Delete user (requires reauth)

// Content Moderation
GET    /api/admin/reports             // List reported content
PUT    /api/admin/reports/:id/resolve // Resolve report
DELETE /api/admin/content/:type/:id   // Delete content
PUT    /api/admin/content/:type/:id/restore // Restore content

// Admin Management (Super Admin only)
GET    /api/admin/admins              // List all admins
POST   /api/admin/admins              // Create admin (requires reauth)
PUT    /api/admin/admins/:id/role     // Change admin role
DELETE /api/admin/admins/:id          // Remove admin access

// Audit Logs
GET    /api/admin/audit-logs          // Query audit logs
GET    /api/admin/audit-logs/export   // Export audit logs (CSV/JSON)

// IP Whitelist (Super Admin only)
GET    /api/admin/ip-whitelist        // List whitelisted IPs
POST   /api/admin/ip-whitelist        // Add IP to whitelist
DELETE /api/admin/ip-whitelist/:id    // Remove IP from whitelist

// System Settings (Super Admin only)
GET    /api/admin/settings            // Get system settings
PUT    /api/admin/settings            // Update settings (requires reauth)

// Data Export (GDPR)
POST   /api/admin/users/:id/export    // Request data export
GET    /api/admin/exports             // List pending exports
GET    /api/admin/exports/:id         // Download export
```

---

## 8. BDD Test Scenarios

```gherkin
Feature: Admin Security
  As an admin
  I want secure access to admin panel
  So that the system is protected from unauthorized access

  Background:
    Given admin user "admin@example.com" exists
    And admin has 2FA enabled
    And IP "192.168.1.100" is whitelisted

  # Authentication
  Scenario: Admin login with 2FA
    Given admin is at login page
    When admin enters valid email and password
    Then admin is prompted for 2FA code
    When admin enters valid TOTP code
    Then admin is logged in successfully
    And audit log records "ADMIN_LOGIN"

  Scenario: Admin login from non-whitelisted IP
    Given request comes from IP "10.0.0.1" (not whitelisted)
    When admin tries to login
    Then access is denied with 403
    And audit log records "ADMIN_ACCESS_DENIED"

  Scenario: Failed 2FA attempts trigger lockout
    Given admin entered valid password
    When admin enters wrong 2FA code 3 times
    Then account is locked for 1 hour
    And audit log records "ADMIN_LOGIN_FAILED" x3

  Scenario: Use backup code for 2FA
    Given admin lost TOTP device
    When admin enters valid backup code
    Then admin is logged in
    And backup code is consumed (cannot reuse)

  # Session Security
  Scenario: Session expires after 4 hours
    Given admin logged in 4 hours ago
    When admin makes a request
    Then request fails with 401
    And admin must re-authenticate

  Scenario: Idle session expires after 30 minutes
    Given admin's last activity was 35 minutes ago
    When admin makes a request
    Then request fails with 401
    And admin must re-authenticate

  Scenario: Single session enforcement
    Given admin is logged in from Device A
    When admin logs in from Device B
    Then session on Device A is invalidated
    And only Device B session is active

  Scenario: Session hijacking detected
    Given admin logged in from IP 192.168.1.100
    When request comes from IP 10.0.0.50 with same session
    Then session is invalidated
    And audit log records "SESSION_HIJACK_ATTEMPT"

  # Sensitive Actions
  Scenario: Delete user requires re-authentication
    Given admin is logged in
    When admin attempts to delete user "user123"
    Then admin is prompted to enter password
    When admin enters correct password
    Then user is deleted
    And audit log records "USER_DELETED"

  Scenario: Failed re-auth blocks sensitive action
    Given admin is logged in
    When admin attempts to ban user "user123"
    And admin enters wrong password
    Then ban action is blocked
    And audit log records "REAUTH_FAILED"

  # Audit Logging
  Scenario: All admin actions are logged
    Given admin is logged in
    When admin suspends user "user456" for 7 days
    Then audit log contains:
      | action | USER_SUSPENDED |
      | actor_id | <admin_id> |
      | target_id | user456 |
      | details | duration: 7 days |

  Scenario: Critical action triggers alert
    Given admin is logged in
    When admin bans user "user789"
    Then audit log records "USER_BANNED"
    And Slack alert is sent to #admin-alerts

  # Rate Limiting
  Scenario: Admin rate limit exceeded
    Given admin performed 50 moderation actions this hour
    When admin tries to warn another user
    Then request fails with 429 Too Many Requests
    And audit log records "RATE_LIMIT_EXCEEDED"

  # Permission Enforcement
  Scenario: Moderator cannot create admin
    Given moderator is logged in
    When moderator tries to create admin account
    Then request fails with 403 Forbidden
    And error message is "Insufficient permissions"

  Scenario: Admin cannot modify system settings
    Given admin (not super admin) is logged in
    When admin tries to modify system settings
    Then request fails with 403 Forbidden
```

---

## 9. Monitoring & Alerts

### 9.1 Security Metrics

```typescript
const adminSecurityMetrics = {
  loginAttempts: new Counter({
    name: 'admin_login_attempts_total',
    help: 'Total admin login attempts',
    labelNames: ['status', 'reason'],
  }),

  twoFactorAttempts: new Counter({
    name: 'admin_2fa_attempts_total',
    help: 'Total 2FA verification attempts',
    labelNames: ['status', 'method'],
  }),

  sessionHijackAttempts: new Counter({
    name: 'admin_session_hijack_attempts_total',
    help: 'Potential session hijacking attempts',
  }),

  sensitiveActionAttempts: new Counter({
    name: 'admin_sensitive_action_attempts_total',
    help: 'Sensitive action attempts',
    labelNames: ['action', 'status'],
  }),

  activeAdminSessions: new Gauge({
    name: 'admin_active_sessions',
    help: 'Current active admin sessions',
  }),
};
```

### 9.2 Alert Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Multiple failed logins | >3 failures in 5 min | Warning | Notify security team |
| Session hijack detected | Any occurrence | Critical | Lock account, notify |
| Unusual admin activity | >100 actions/hour | Warning | Review required |
| Non-whitelisted IP access | Any occurrence | Critical | Block, notify |
| After-hours admin access | Login outside 6AM-10PM | Warning | Notify manager |
| Bulk deletion | >20 deletions/hour | Warning | Rate limit, notify |

---

## 10. Implementation Checklist

### Phase 1: Authentication (Week 1)
- [ ] Implement admin login flow
- [ ] Add TOTP 2FA with speakeasy
- [ ] Generate and store backup codes
- [ ] Build 2FA setup UI

### Phase 2: Authorization (Week 2)
- [ ] Implement IP whitelisting
- [ ] Add role-based permission checks
- [ ] Build session management
- [ ] Add re-authentication for sensitive actions

### Phase 3: Audit & Monitoring (Week 3)
- [ ] Create audit log schema and service
- [ ] Implement comprehensive logging
- [ ] Set up Slack alerts for critical actions
- [ ] Build audit log query interface

### Phase 4: Testing (Week 4)
- [ ] Write BDD scenario tests
- [ ] Security penetration testing
- [ ] Rate limit stress testing
- [ ] Session security validation

---

## 11. Risk Assessment - Post-Specification

| Risk | Before | After | Mitigation |
|------|--------|-------|------------|
| Admin account compromise | HIGH | LOW | 2FA + IP whitelist + session binding |
| Unauthorized access | HIGH | LOW | Role-based permissions, audit logging |
| Session hijacking | MEDIUM | LOW | IP/UA binding, single session |
| Insider threat | MEDIUM | LOW | Audit trail, re-auth, alerts |

**Milestone 8 Readiness**: **4.5/5.0** (up from 3.0/5.0) - READY FOR DEVELOPMENT

---

**Document Created By**: QE Requirements Validator Agent
**Date**: 2025-12-16
**Status**: SPECIFICATION COMPLETE

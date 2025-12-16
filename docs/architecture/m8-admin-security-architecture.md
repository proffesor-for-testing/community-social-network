# M8 Admin Panel & Security - Architecture Documentation

**Project**: Community Social Network MVP
**Milestone**: M8 - Admin & Moderation
**Phase**: SPARC Phase 3 - Architecture
**Version**: 1.0.0
**Date**: 2025-12-16
**Status**: ARCHITECTURE DRAFT

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Architecture](#2-component-architecture)
3. [Two-Factor Authentication Architecture](#3-two-factor-authentication-architecture)
4. [Database Schema](#4-database-schema)
5. [IP Whitelisting Implementation](#5-ip-whitelisting-implementation)
6. [Session Security Architecture](#6-session-security-architecture)
7. [Sensitive Action Re-authentication Flow](#7-sensitive-action-re-authentication-flow)
8. [Audit Logging Pipeline](#8-audit-logging-pipeline)
9. [Admin Permission Matrix](#9-admin-permission-matrix)
10. [Security Monitoring & Alerting](#10-security-monitoring--alerting)
11. [API Contract Definitions](#11-api-contract-definitions)
12. [Technology Stack](#12-technology-stack)
13. [Security Best Practices](#13-security-best-practices)

---

## 1. System Overview

### 1.1 Architecture Principles

The M8 Admin Panel & Security module follows defense-in-depth security architecture:

- **Multi-layered Authentication**: Username/password + 2FA + IP whitelisting
- **Session Hardening**: Secure cookies, rotation, timeout enforcement
- **Audit Everything**: Comprehensive logging of all admin actions
- **Least Privilege**: Role-based access with granular permissions
- **Zero Trust**: Re-authenticate for sensitive operations
- **Fail Secure**: Default deny, explicit allow

### 1.2 Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Internet (Untrusted)                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                  ┌─────────▼──────────┐
                  │   CDN / WAF        │
                  │   (DDoS Protection)│
                  └─────────┬──────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                     API Gateway Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Rate Limiter │  │  IP Filter   │  │ SSL/TLS      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              Admin Authentication Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Credentials  │→ │  2FA/TOTP    │→ │ IP Whitelist │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              Admin Application Layer                         │
│  ┌────────────────────────────────────────────────┐         │
│  │           Admin Panel Components                │         │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │         │
│  │  │ User Mgmt│  │ Content  │  │  System  │     │         │
│  │  │          │  │ Moderation│  │  Config  │     │         │
│  │  └──────────┘  └──────────┘  └──────────┘     │         │
│  └────────────────────────────────────────────────┘         │
│                                                               │
│  ┌────────────────────────────────────────────────┐         │
│  │         Security Components                     │         │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │         │
│  │  │ Session  │  │  Audit   │  │  RBAC    │     │         │
│  │  │ Manager  │  │  Logger  │  │ Enforcer │     │         │
│  │  └──────────┘  └──────────┘  └──────────┘     │         │
│  └────────────────────────────────────────────────┘         │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    Data Persistence Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │  Redis Cache │  │  Audit Store │      │
│  │  (Admin Data)│  │  (Sessions)  │  │ (Time Series)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture

### 2.1 High-Level Component Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                      Admin Panel Frontend                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Login Page   │  │ 2FA Setup    │  │ Admin        │         │
│  │ Component    │  │ Component    │  │ Dashboard    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────┐
│                   Admin API Gateway                             │
│  ┌──────────────────────────────────────────────────┐          │
│  │  Middleware Chain                                 │          │
│  │  [Helmet] → [CORS] → [Rate Limit] → [IP Filter] │          │
│  └──────────────────────────────────────────────────┘          │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│ Auth Service   │  │ Admin Service   │  │ Audit Service  │
│                │  │                 │  │                │
│ - Login        │  │ - User Mgmt     │  │ - Log Events   │
│ - 2FA Setup    │  │ - Content Mod   │  │ - Query Logs   │
│ - 2FA Verify   │  │ - System Config │  │ - Retention    │
│ - Session Mgmt │  │ - Permissions   │  │ - Alerts       │
│ - IP Whitelist │  │ - Reporting     │  │                │
└───────┬────────┘  └────────┬────────┘  └───────┬────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│   PostgreSQL   │  │  Redis Cache    │  │  Audit DB      │
│                │  │                 │  │  (TimescaleDB) │
│ - admin_users  │  │ - sessions      │  │                │
│ - admin_2fa    │  │ - rate_limits   │  │ - audit_logs   │
│ - admin_roles  │  │ - ip_whitelist  │  │ - alerts       │
│ - admin_perms  │  │                 │  │                │
└────────────────┘  └─────────────────┘  └────────────────┘
```

### 2.2 Component Responsibilities

#### Auth Service
- **Purpose**: Authentication and authorization for admin users
- **Technology**: Node.js/Express, Passport.js, otplib
- **Scaling**: Stateless, horizontal scaling 2-5 instances
- **Dependencies**: PostgreSQL, Redis, Audit Service

**Key Responsibilities**:
- Username/password authentication
- TOTP 2FA generation and verification
- Backup code management
- Session creation and validation
- IP whitelist enforcement
- Re-authentication for sensitive actions

#### Admin Service
- **Purpose**: Core admin panel functionality
- **Technology**: Node.js/Express, React Admin UI
- **Scaling**: Horizontal scaling 2-10 instances
- **Dependencies**: Auth Service, PostgreSQL, Audit Service

**Key Responsibilities**:
- User management (CRUD, suspend, delete)
- Content moderation (review, approve, reject)
- System configuration
- Permission management
- Analytics and reporting

#### Audit Service
- **Purpose**: Comprehensive audit logging and alerting
- **Technology**: Node.js, TimescaleDB/PostgreSQL
- **Scaling**: Write-heavy, dedicated instances 1-3
- **Dependencies**: PostgreSQL/TimescaleDB

**Key Responsibilities**:
- Log all admin actions with context
- Store immutable audit trail
- Query and search audit logs
- Trigger security alerts
- Enforce retention policies

---

## 3. Two-Factor Authentication Architecture

### 3.1 TOTP Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    2FA Enrollment Flow                       │
└─────────────────────────────────────────────────────────────┘

Admin User          Frontend            Auth Service        Database
    │                   │                     │                 │
    │ Click "Enable 2FA"│                     │                 │
    ├──────────────────►│                     │                 │
    │                   │ POST /auth/2fa/setup│                 │
    │                   ├────────────────────►│                 │
    │                   │                     │ Generate Secret │
    │                   │                     │ (32 bytes)      │
    │                   │                     ├────────┐        │
    │                   │                     │        │        │
    │                   │                     │◄───────┘        │
    │                   │                     │                 │
    │                   │                     │ Generate QR Code│
    │                   │                     ├────────┐        │
    │                   │                     │        │        │
    │                   │                     │◄───────┘        │
    │                   │                     │                 │
    │                   │                     │ Generate Backup │
    │                   │                     │ Codes (10)      │
    │                   │                     ├────────┐        │
    │                   │                     │        │        │
    │                   │                     │◄───────┘        │
    │                   │                     │                 │
    │                   │                     │ Encrypt & Store │
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │ {qrCode, backupCodes}                 │
    │                   │◄────────────────────┤                 │
    │                   │                     │                 │
    │ Display QR Code   │                     │                 │
    │◄──────────────────┤                     │                 │
    │                   │                     │                 │
    │ Scan with Google  │                     │                 │
    │ Authenticator     │                     │                 │
    │                   │                     │                 │
    │ Download Backup   │                     │                 │
    │ Codes (once)      │                     │                 │
    │                   │                     │                 │
    │ Enter 6-digit code│                     │                 │
    ├──────────────────►│ POST /auth/2fa/verify                │
    │                   ├────────────────────►│                 │
    │                   │                     │ Decrypt Secret  │
    │                   │                     ├────────┐        │
    │                   │                     │        │        │
    │                   │                     │◄───────┘        │
    │                   │                     │                 │
    │                   │                     │ Compute TOTP    │
    │                   │                     │ (±90s window)   │
    │                   │                     ├────────┐        │
    │                   │                     │        │        │
    │                   │                     │◄───────┘        │
    │                   │                     │                 │
    │                   │                     │ Mark Enabled    │
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │ {success: true}     │                 │
    │ 2FA Enabled!      │◄────────────────────┤                 │
    │◄──────────────────┤                     │                 │
```

### 3.2 TOTP Login Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    2FA Login Flow                            │
└─────────────────────────────────────────────────────────────┘

Admin User          Frontend            Auth Service        Database
    │                   │                     │                 │
    │ Enter credentials │                     │                 │
    ├──────────────────►│ POST /auth/login    │                 │
    │                   ├────────────────────►│                 │
    │                   │                     │ Verify Password │
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │                     │ Check IP        │
    │                   │                     │ Whitelist       │
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │                     │ Check 2FA       │
    │                   │                     │ Enabled?        │
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │ {requires2FA: true} │                 │
    │ Show 2FA Input    │◄────────────────────┤                 │
    │◄──────────────────┤                     │                 │
    │                   │                     │                 │
    │ Enter 6-digit code│                     │                 │
    ├──────────────────►│ POST /auth/2fa/login│                 │
    │                   ├────────────────────►│                 │
    │                   │                     │ Rate Limit Check│
    │                   │                     ├────────┐        │
    │                   │                     │        │        │
    │                   │                     │◄───────┘        │
    │                   │                     │                 │
    │                   │                     │ Decrypt Secret  │
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │                     │ Verify TOTP     │
    │                   │                     │ (constant time) │
    │                   │                     ├────────┐        │
    │                   │                     │        │        │
    │                   │                     │◄───────┘        │
    │                   │                     │                 │
    │                   │                     │ Create Session  │
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │                     │ Log Success     │
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │ {token, sessionId}  │                 │
    │ Logged In!        │◄────────────────────┤                 │
    │◄──────────────────┤                     │                 │
```

### 3.3 TOTP Technology Stack

**Library**: `otplib` (v12.0.1+)
- RFC 4226 (HOTP) and RFC 6238 (TOTP) compliant
- Support for SHA-1, SHA-256, SHA-512
- QR code generation via `qrcode` library

**Configuration**:
```javascript
{
  algorithm: 'sha1',        // TOTP standard
  digits: 6,                // 6-digit codes
  step: 30,                 // 30-second time window
  window: 1,                // ±1 window (90s total)
  encoding: 'base32',       // Standard encoding
  secretLength: 32          // 256-bit secret
}
```

**QR Code Generation**:
- Library: `qrcode` (v1.5.0+)
- Format: PNG data URL
- OTPAuth URL: `otpauth://totp/CommunityNetwork:{email}?secret={secret}&issuer=CommunityNetwork`

**Backup Codes**:
- Count: 10 codes
- Format: 8 hex characters (32 bits entropy each)
- Storage: bcrypt hashed (cost factor 10)
- One-time use: Marked used after verification

---

## 4. Database Schema

### 4.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Security Schema                    │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│      admin_users         │
├──────────────────────────┤
│ PK id                    │ UUID
│    email                 │ VARCHAR(255) UNIQUE
│    password_hash         │ VARCHAR(255)
│    status                │ ENUM(active,suspended,deleted)
│    role_id               │ UUID FK → admin_roles.id
│    require_2fa           │ BOOLEAN
│    require_ip_whitelist  │ BOOLEAN
│    last_login_at         │ TIMESTAMP
│    last_login_ip         │ INET
│    failed_login_count    │ INTEGER
│    locked_until          │ TIMESTAMP
│    created_at            │ TIMESTAMP
│    updated_at            │ TIMESTAMP
└──────────┬───────────────┘
           │ 1
           │
           │ *
┌──────────▼───────────────┐
│   admin_two_factor       │
├──────────────────────────┤
│ PK id                    │ UUID
│ FK user_id               │ UUID → admin_users.id
│    secret                │ TEXT (AES-256 encrypted)
│    backup_codes          │ JSONB (bcrypt hashed array)
│    enabled               │ BOOLEAN
│    verified_at           │ TIMESTAMP
│    created_at            │ TIMESTAMP
│    updated_at            │ TIMESTAMP
└──────────────────────────┘

┌──────────────────────────┐
│   admin_sessions         │
├──────────────────────────┤
│ PK id                    │ UUID
│ FK user_id               │ UUID → admin_users.id
│    token_hash            │ VARCHAR(255) UNIQUE
│    ip_address            │ INET
│    user_agent            │ TEXT
│    last_activity_at      │ TIMESTAMP
│    expires_at            │ TIMESTAMP
│    is_active             │ BOOLEAN
│    created_at            │ TIMESTAMP
└──────────────────────────┘

┌──────────────────────────┐
│   admin_ip_whitelist     │
├──────────────────────────┤
│ PK id                    │ UUID
│ FK user_id               │ UUID → admin_users.id
│    ip_address            │ INET
│    ip_range_start        │ INET (for CIDR ranges)
│    ip_range_end          │ INET (for CIDR ranges)
│    description           │ VARCHAR(255)
│    is_active             │ BOOLEAN
│    created_by            │ UUID → admin_users.id
│    created_at            │ TIMESTAMP
│    expires_at            │ TIMESTAMP
└──────────────────────────┘

┌──────────────────────────┐
│     admin_roles          │
├──────────────────────────┤
│ PK id                    │ UUID
│    name                  │ VARCHAR(100) UNIQUE
│    description           │ TEXT
│    is_active             │ BOOLEAN
│    created_at            │ TIMESTAMP
│    updated_at            │ TIMESTAMP
└──────────┬───────────────┘
           │ 1
           │
           │ *
┌──────────▼───────────────┐
│  admin_permissions       │
├──────────────────────────┤
│ PK id                    │ UUID
│ FK role_id               │ UUID → admin_roles.id
│    resource              │ VARCHAR(100)
│    action                │ VARCHAR(100)
│    conditions            │ JSONB
│    created_at            │ TIMESTAMP
└──────────────────────────┘

┌──────────────────────────┐
│    audit_logs            │
├──────────────────────────┤
│ PK id                    │ BIGSERIAL
│ FK user_id               │ UUID → admin_users.id
│    action                │ VARCHAR(100)
│    resource_type         │ VARCHAR(100)
│    resource_id           │ UUID
│    changes               │ JSONB
│    ip_address            │ INET
│    user_agent            │ TEXT
│    status                │ ENUM(success,failure,blocked)
│    error_message         │ TEXT
│    created_at            │ TIMESTAMP
│    session_id            │ UUID → admin_sessions.id
└──────────────────────────┘
      (Partitioned by month)

┌──────────────────────────┐
│  security_alerts         │
├──────────────────────────┤
│ PK id                    │ UUID
│ FK user_id               │ UUID → admin_users.id
│    alert_type            │ VARCHAR(100)
│    severity              │ ENUM(low,medium,high,critical)
│    description           │ TEXT
│    metadata              │ JSONB
│    acknowledged          │ BOOLEAN
│    acknowledged_by       │ UUID → admin_users.id
│    acknowledged_at       │ TIMESTAMP
│    created_at            │ TIMESTAMP
└──────────────────────────┘
```

### 4.2 Schema Implementation

```sql
-- Admin Users Table
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    role_id UUID NOT NULL,
    require_2fa BOOLEAN DEFAULT true,
    require_ip_whitelist BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP,
    last_login_ip INET,
    failed_login_count INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES admin_roles(id),
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_role_id (role_id)
);

-- Two-Factor Authentication Table
CREATE TABLE admin_two_factor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    secret TEXT NOT NULL,  -- AES-256 encrypted
    backup_codes JSONB NOT NULL,  -- Array of bcrypt hashed codes
    enabled BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_2fa UNIQUE (user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_enabled (enabled)
);

-- Admin Sessions Table
CREATE TABLE admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires_at (expires_at),
    INDEX idx_is_active (is_active)
);

-- IP Whitelist Table
CREATE TABLE admin_ip_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ip_address INET,
    ip_range_start INET,
    ip_range_end INET,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES admin_users(id),
    CONSTRAINT check_ip_or_range CHECK (
        (ip_address IS NOT NULL AND ip_range_start IS NULL AND ip_range_end IS NULL) OR
        (ip_address IS NULL AND ip_range_start IS NOT NULL AND ip_range_end IS NOT NULL)
    ),
    INDEX idx_user_id (user_id),
    INDEX idx_ip_address (ip_address),
    INDEX idx_ip_range USING gist (inet_range(ip_range_start, ip_range_end)),
    INDEX idx_is_active (is_active)
);

-- Admin Roles Table
CREATE TABLE admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_name (name),
    INDEX idx_is_active (is_active)
);

-- Admin Permissions Table
CREATE TABLE admin_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    conditions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
    CONSTRAINT unique_role_resource_action UNIQUE (role_id, resource, action),
    INDEX idx_role_id (role_id),
    INDEX idx_resource (resource),
    INDEX idx_action (action)
);

-- Audit Logs Table (Partitioned by Month)
CREATE TABLE audit_logs (
    id BIGSERIAL,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    changes JSONB,
    ip_address INET NOT NULL,
    user_agent TEXT,
    status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success', 'failure', 'blocked')),
    error_message TEXT,
    session_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES admin_users(id),
    CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES admin_sessions(id),
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_resource_type (resource_type),
    INDEX idx_created_at (created_at),
    INDEX idx_status (status)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- Additional partitions created via cron job

-- Security Alerts Table
CREATE TABLE security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    metadata JSONB,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES admin_users(id),
    CONSTRAINT fk_acknowledged_by FOREIGN KEY (acknowledged_by) REFERENCES admin_users(id),
    INDEX idx_user_id (user_id),
    INDEX idx_alert_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_acknowledged (acknowledged),
    INDEX idx_created_at (created_at)
);
```

---

## 5. IP Whitelisting Implementation

### 5.1 IP Whitelist Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              IP Whitelist Verification Flow                  │
└─────────────────────────────────────────────────────────────┘

Incoming Request → [Extract IP] → [Check Redis Cache]
                         │              │
                         │              │ Cache Hit
                         │              └─────────► Allow/Deny
                         │
                         │ Cache Miss
                         ▼
                   [Query Database]
                         │
            ┌────────────┼────────────┐
            │            │            │
            ▼            ▼            ▼
    [Exact Match]  [CIDR Range]  [Wildcard]
            │            │            │
            └────────────┼────────────┘
                         │
                   [Cache Result]
                         │
                         ▼
                    Allow/Deny
```

### 5.2 IP Whitelist Configuration

**Single IP Address**:
```javascript
{
  user_id: 'uuid',
  ip_address: '203.0.113.42',
  description: 'Office Static IP',
  is_active: true,
  expires_at: null  // No expiration
}
```

**CIDR Range**:
```javascript
{
  user_id: 'uuid',
  ip_range_start: '203.0.113.0',
  ip_range_end: '203.0.113.255',
  description: 'Office Network /24',
  is_active: true,
  expires_at: null
}
```

**Dynamic IP (Temporary)**:
```javascript
{
  user_id: 'uuid',
  ip_address: '198.51.100.55',
  description: 'Home Network (7 days)',
  is_active: true,
  expires_at: '2025-12-23T00:00:00Z'
}
```

### 5.3 IP Verification Algorithm

```javascript
// Pseudocode
ALGORITHM: VerifyIPWhitelist
INPUT: userId, requestIP
OUTPUT: boolean (allowed/denied)

BEGIN
    // Check if user requires IP whitelisting
    user ← Database.SELECT FROM admin_users WHERE id = userId
    IF NOT user.require_ip_whitelist THEN
        RETURN true  // IP whitelisting not required
    END IF

    // Check Redis cache first
    cacheKey ← "ip_whitelist:" + userId + ":" + requestIP
    cached ← Redis.GET(cacheKey)
    IF cached IS NOT NULL THEN
        RETURN cached = "allowed"
    END IF

    // Query database for matches
    whitelistEntries ← Database.SELECT FROM admin_ip_whitelist
                       WHERE user_id = userId
                       AND is_active = true
                       AND (expires_at IS NULL OR expires_at > NOW())

    FOR EACH entry IN whitelistEntries DO
        // Exact IP match
        IF entry.ip_address = requestIP THEN
            Redis.SET(cacheKey, "allowed", EX=3600)
            RETURN true
        END IF

        // CIDR range match
        IF entry.ip_range_start IS NOT NULL THEN
            IF requestIP >= entry.ip_range_start
               AND requestIP <= entry.ip_range_end THEN
                Redis.SET(cacheKey, "allowed", EX=3600)
                RETURN true
            END IF
        END IF
    END FOR

    // No match found - deny and cache denial
    Redis.SET(cacheKey, "denied", EX=300)  // Cache denials for 5 minutes

    // Log security event
    AuditLog.Record("IP_WHITELIST_DENIED", userId, {
        ip_address: requestIP,
        timestamp: NOW()
    })

    RETURN false
END

COMPLEXITY: O(n) where n = whitelist entries, cached to O(1)
```

---

## 6. Session Security Architecture

### 6.1 Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                   Session Lifecycle Flow                     │
└─────────────────────────────────────────────────────────────┘

[Login Success] → [Create Session] → [Set Secure Cookie]
                        │
                        ├─► Session Token (cryptographically random)
                        ├─► Store in Redis + PostgreSQL
                        ├─► Set httpOnly, secure, sameSite flags
                        └─► Set expiration (2 hours idle, 8 hours absolute)

[Each Request] → [Validate Session] → [Update Activity]
                        │
                        ├─► Verify token signature
                        ├─► Check expiration
                        ├─► Verify IP consistency
                        └─► Update last_activity_at

[Idle Timeout] → [Rotate Session] → [Issue New Token]
                        │
                        ├─► Invalidate old token
                        ├─► Create new session
                        └─► Update cookie

[Logout/Expire] → [Destroy Session] → [Clear Cookie]
                        │
                        ├─► Mark session inactive
                        ├─► Remove from Redis
                        └─► Clear client cookie
```

### 6.2 Session Cookie Configuration

```javascript
{
  name: 'admin_session',
  secret: process.env.SESSION_SECRET,  // 256-bit secret

  cookie: {
    httpOnly: true,       // Prevent XSS access
    secure: true,         // HTTPS only
    sameSite: 'strict',   // CSRF protection
    maxAge: 2 * 60 * 60 * 1000,  // 2 hours
    domain: '.example.com',
    path: '/admin'
  },

  rolling: true,          // Reset maxAge on activity
  resave: false,
  saveUninitialized: false,

  store: new RedisStore({
    client: redisClient,
    prefix: 'admin_session:',
    ttl: 2 * 60 * 60  // 2 hours in seconds
  })
}
```

### 6.3 Session Token Format

```
Session Token Structure:
┌──────────────────────────────────────────────────────┐
│  [Version:1][UserID:36][Random:32][Signature:32]     │
│     1 byte    36 bytes   32 bytes    32 bytes        │
│                      (101 bytes total)                │
└──────────────────────────────────────────────────────┘

Version: Protocol version (0x01)
UserID: UUID of admin user
Random: Cryptographically secure random bytes
Signature: HMAC-SHA256(Version + UserID + Random, SECRET_KEY)

Encoding: Base64URL (no padding)
Final length: ~134 characters
```

### 6.4 Session Rotation Strategy

**Rotation Triggers**:
- After 15 minutes of activity
- After privilege escalation
- After sensitive action completion
- On user agent change (security event)
- On IP change (if strict mode enabled)

**Rotation Process**:
```javascript
ALGORITHM: RotateSession
INPUT: currentSessionId, userId
OUTPUT: newSessionToken

BEGIN
    // Load current session
    currentSession ← Database.SELECT FROM admin_sessions
                     WHERE id = currentSessionId

    // Invalidate current session
    Database.UPDATE admin_sessions
    SET is_active = false
    WHERE id = currentSessionId

    Redis.DEL("admin_session:" + currentSessionId)

    // Create new session with same properties
    newSessionId ← GenerateUUID()
    newToken ← GenerateSessionToken(userId)

    Database.INSERT INTO admin_sessions (
        id: newSessionId,
        user_id: userId,
        token_hash: HASH(newToken),
        ip_address: currentSession.ip_address,
        user_agent: currentSession.user_agent,
        expires_at: NOW() + INTERVAL '2 hours'
    )

    // Cache new session
    Redis.SET("admin_session:" + newToken, sessionData, EX=7200)

    // Log rotation
    AuditLog.Record("SESSION_ROTATED", userId, {
        old_session_id: currentSessionId,
        new_session_id: newSessionId,
        reason: "periodic_rotation"
    })

    RETURN newToken
END
```

---

## 7. Sensitive Action Re-authentication Flow

### 7.1 Re-authentication Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           Sensitive Action Re-authentication Flow            │
└─────────────────────────────────────────────────────────────┘

Admin User          Frontend            Auth Service        Database
    │                   │                     │                 │
    │ Click "Delete User"                     │                 │
    ├──────────────────►│                     │                 │
    │                   │ Check Last Re-auth  │                 │
    │                   ├────────┐            │                 │
    │                   │        │            │                 │
    │                   │◄───────┘            │                 │
    │                   │                     │                 │
    │                   │ Last re-auth > 5min │                 │
    │                   │                     │                 │
    │ Show Re-auth Modal│                     │                 │
    │◄──────────────────┤                     │                 │
    │                   │                     │                 │
    │ Enter Password +  │                     │                 │
    │ 2FA Code          │                     │                 │
    ├──────────────────►│ POST /auth/reauth   │                 │
    │                   ├────────────────────►│                 │
    │                   │                     │ Verify Password │
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │                     │ Verify 2FA      │
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │                     │ Create Re-auth  │
    │                   │                     │ Token (5min TTL)│
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │ {reauthToken}       │                 │
    │                   │◄────────────────────┤                 │
    │                   │                     │                 │
    │                   │ POST /admin/users/:id/delete          │
    │                   │ Header: X-Reauth-Token                │
    │                   ├────────────────────►│                 │
    │                   │                     │ Verify Re-auth  │
    │                   │                     │ Token           │
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │                     │ Execute Deletion│
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │                   │                     │ Invalidate Token│
    │                   │                     ├────────────────►│
    │                   │                     │                 │
    │ User Deleted      │ {success: true}     │                 │
    │◄──────────────────┤◄────────────────────┤                 │
```

### 7.2 Sensitive Actions Definition

**Critical Actions (Re-auth Required)**:
- Delete admin user
- Change admin permissions
- Modify system configuration
- Access audit logs
- Export user data
- Reset 2FA for another user
- Add/remove IP whitelist entries

**Re-authentication Configuration**:
```javascript
{
  sensitive_actions: [
    {
      action: 'admin.user.delete',
      reauth_required: true,
      reauth_ttl: 300,  // 5 minutes
      require_2fa: true,
      require_password: true
    },
    {
      action: 'admin.permissions.modify',
      reauth_required: true,
      reauth_ttl: 300,
      require_2fa: true,
      require_password: true
    },
    {
      action: 'admin.system.config',
      reauth_required: true,
      reauth_ttl: 600,  // 10 minutes
      require_2fa: true,
      require_password: true
    }
  ]
}
```

### 7.3 Re-authentication Token Structure

```
Re-auth Token:
┌──────────────────────────────────────────────────────┐
│  JWT Token with Claims:                               │
│  {                                                     │
│    "sub": "admin_user_id",                            │
│    "iat": 1702742400,                                 │
│    "exp": 1702742700,  // 5 minutes                   │
│    "type": "reauth",                                  │
│    "action": "admin.user.delete",                     │
│    "single_use": true                                 │
│  }                                                     │
└──────────────────────────────────────────────────────┘

Algorithm: RS256
Signature: Private key from environment
Storage: Redis with TTL
```

---

## 8. Audit Logging Pipeline

### 8.1 Audit Log Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Audit Logging Pipeline                      │
└─────────────────────────────────────────────────────────────┘

[Admin Action] → [Capture Context] → [Queue Event]
                        │                   │
                        ▼                   ▼
                  ┌──────────┐      ┌──────────┐
                  │ Context  │      │  Redis   │
                  │ Builder  │      │  Queue   │
                  └──────────┘      └────┬─────┘
                        │                │
                        └────────┬───────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Audit Processor │
                        │ (Background)    │
                        └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
            ┌──────────┐  ┌──────────┐  ┌──────────┐
            │PostgreSQL│  │ Alerting │  │Analytics │
            │ (Primary)│  │  Engine  │  │ Pipeline │
            └──────────┘  └──────────┘  └──────────┘
```

### 8.2 Audit Event Structure

```javascript
{
  id: 'bigserial',
  user_id: 'uuid',
  action: 'admin.user.delete',
  resource_type: 'user',
  resource_id: 'uuid-of-deleted-user',
  changes: {
    before: {
      email: 'user@example.com',
      status: 'active'
    },
    after: {
      status: 'deleted',
      deleted_at: '2025-12-16T10:30:00Z'
    }
  },
  ip_address: '203.0.113.42',
  user_agent: 'Mozilla/5.0...',
  status: 'success',
  session_id: 'uuid',
  created_at: '2025-12-16T10:30:00Z'
}
```

### 8.3 Audit Categories

**Authentication Events**:
- `auth.login.success`
- `auth.login.failure`
- `auth.logout`
- `auth.2fa.enabled`
- `auth.2fa.disabled`
- `auth.2fa.verification.failure`
- `auth.session.expired`

**Authorization Events**:
- `authz.permission.denied`
- `authz.role.assigned`
- `authz.role.removed`

**User Management Events**:
- `admin.user.created`
- `admin.user.updated`
- `admin.user.deleted`
- `admin.user.suspended`

**System Configuration Events**:
- `system.config.updated`
- `system.feature.toggled`

**Security Events**:
- `security.ip_whitelist.added`
- `security.ip_whitelist.removed`
- `security.ip_denied`
- `security.brute_force.detected`

### 8.4 Retention Policy

```javascript
{
  retention_policies: [
    {
      category: 'authentication',
      retention_days: 90,
      archive_after_days: 30
    },
    {
      category: 'user_management',
      retention_days: 365,
      archive_after_days: 90
    },
    {
      category: 'security',
      retention_days: 730,  // 2 years
      archive_after_days: 180
    },
    {
      category: 'system_config',
      retention_days: 365,
      archive_after_days: 90
    }
  ],

  archive_destination: 's3://audit-logs-archive/',
  compression: 'gzip',
  encryption: 'AES-256'
}
```

### 8.5 Audit Query API

```javascript
// Example: Query audit logs
GET /admin/audit-logs?
  user_id=uuid&
  action=admin.user.*&
  start_date=2025-12-01&
  end_date=2025-12-16&
  status=success&
  limit=100&
  offset=0

// Response
{
  total: 1523,
  limit: 100,
  offset: 0,
  logs: [
    {
      id: 1523,
      user_id: 'uuid',
      action: 'admin.user.updated',
      resource_type: 'user',
      resource_id: 'uuid',
      changes: {...},
      ip_address: '203.0.113.42',
      created_at: '2025-12-16T10:30:00Z'
    }
  ]
}
```

---

## 9. Admin Permission Matrix

### 9.1 Role Hierarchy

```
Super Admin
    │
    ├─► Admin
    │     │
    │     ├─► Moderator
    │     │
    │     └─► Support
    │
    └─► Auditor (Read-only)
```

### 9.2 Permission Matrix

| Resource          | Action         | Super Admin | Admin | Moderator | Support | Auditor |
|-------------------|----------------|-------------|-------|-----------|---------|---------|
| **Users**         |                |             |       |           |         |         |
|                   | create         | ✓           | ✓     | ✗         | ✗       | ✗       |
|                   | read           | ✓           | ✓     | ✓         | ✓       | ✓       |
|                   | update         | ✓           | ✓     | ✓         | ✗       | ✗       |
|                   | delete         | ✓           | ✓     | ✗         | ✗       | ✗       |
|                   | suspend        | ✓           | ✓     | ✓         | ✗       | ✗       |
| **Admin Users**   |                |             |       |           |         |         |
|                   | create         | ✓           | ✗     | ✗         | ✗       | ✗       |
|                   | read           | ✓           | ✓     | ✗         | ✗       | ✗       |
|                   | update         | ✓           | self  | self      | self    | self    |
|                   | delete         | ✓           | ✗     | ✗         | ✗       | ✗       |
| **Roles**         |                |             |       |           |         |         |
|                   | create         | ✓           | ✗     | ✗         | ✗       | ✗       |
|                   | read           | ✓           | ✓     | ✗         | ✗       | ✓       |
|                   | update         | ✓           | ✗     | ✗         | ✗       | ✗       |
|                   | assign         | ✓           | ✗     | ✗         | ✗       | ✗       |
| **Content**       |                |             |       |           |         |         |
|                   | moderate       | ✓           | ✓     | ✓         | ✗       | ✗       |
|                   | delete         | ✓           | ✓     | ✓         | ✗       | ✗       |
| **Audit Logs**    |                |             |       |           |         |         |
|                   | read           | ✓           | ✓     | ✗         | ✗       | ✓       |
|                   | export         | ✓           | ✗     | ✗         | ✗       | ✓       |
| **System Config** |                |             |       |           |         |         |
|                   | read           | ✓           | ✓     | ✗         | ✗       | ✗       |
|                   | update         | ✓           | ✗     | ✗         | ✗       | ✗       |

### 9.3 Permission Enforcement

```javascript
ALGORITHM: CheckPermission
INPUT: userId, resource, action
OUTPUT: boolean (allowed/denied)

BEGIN
    // Load user and role
    user ← Database.SELECT FROM admin_users WHERE id = userId
    role ← Database.SELECT FROM admin_roles WHERE id = user.role_id

    // Check if user is active
    IF user.status != 'active' THEN
        RETURN false
    END IF

    // Load permissions for role
    permissions ← Database.SELECT FROM admin_permissions
                  WHERE role_id = role.id
                  AND resource = resource
                  AND action = action

    IF permissions IS EMPTY THEN
        RETURN false
    END IF

    // Check conditions (e.g., "self" only)
    FOR EACH perm IN permissions DO
        IF perm.conditions IS NULL THEN
            RETURN true  // Unconditional permission
        END IF

        IF EvaluateConditions(perm.conditions, context) THEN
            RETURN true
        END IF
    END FOR

    RETURN false
END

COMPLEXITY: O(1) with proper indexing and caching
```

---

## 10. Security Monitoring & Alerting

### 10.1 Alert Triggers

**Authentication Anomalies**:
- 5+ failed login attempts in 15 minutes
- Login from new IP address
- Login from new country
- 2FA disabled without re-authentication
- Backup code usage

**Authorization Anomalies**:
- Multiple permission denials (5+ in 5 minutes)
- Access to unusual resources
- Privilege escalation attempts

**Session Anomalies**:
- User agent change during session
- IP address change during session
- Concurrent sessions from different locations

**System Anomalies**:
- Mass user deletions (5+ in 5 minutes)
- Bulk permission changes
- System configuration changes

### 10.2 Alert Severity Levels

```javascript
{
  severity_levels: {
    low: {
      notification: 'email',
      aggregation: '1 hour',
      examples: ['Single failed login', 'Password change']
    },
    medium: {
      notification: 'email + dashboard',
      aggregation: '15 minutes',
      examples: ['3 failed logins', 'New IP login']
    },
    high: {
      notification: 'email + SMS + dashboard',
      aggregation: 'immediate',
      examples: ['Account lockout', 'IP denied 5+ times']
    },
    critical: {
      notification: 'email + SMS + dashboard + webhook',
      aggregation: 'immediate',
      examples: ['Brute force detected', 'Mass deletion']
    }
  }
}
```

### 10.3 Monitoring Dashboard Metrics

```
Admin Security Dashboard
┌─────────────────────────────────────────────────────────────┐
│  Active Admin Sessions: 24                                   │
│  Failed Logins (24h): 12                                     │
│  Active Alerts: 3 (1 High, 2 Medium)                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Login Activity (Last 7 Days)                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Success ████████████████████████████ 342              │   │
│  │ Failure ███ 18                                         │   │
│  │ Blocked ██ 7                                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Recent Security Alerts                                      │
│  [HIGH] Brute force attempt from 198.51.100.55              │
│         10 failed logins in 2 minutes                        │
│         User: admin@example.com                              │
│         Time: 2025-12-16 10:15:00                            │
│         Status: IP blocked for 1 hour                        │
│                                                               │
│  [MEDIUM] New IP login                                       │
│         User: moderator@example.com                          │
│         IP: 203.0.113.88 (New York, US)                      │
│         Time: 2025-12-16 09:30:00                            │
│         Status: 2FA verified                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. API Contract Definitions

### 11.1 Authentication Endpoints

```yaml
openapi: 3.0.0
info:
  title: Admin Authentication API
  version: 1.0.0

paths:
  /admin/auth/login:
    post:
      summary: Admin login with credentials
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
          description: Login successful, 2FA required
          content:
            application/json:
              schema:
                type: object
                properties:
                  requires2FA:
                    type: boolean
                  tempToken:
                    type: string
        401:
          description: Invalid credentials
        403:
          description: IP not whitelisted or account locked

  /admin/auth/2fa/login:
    post:
      summary: Complete 2FA login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [tempToken, totpCode]
              properties:
                tempToken:
                  type: string
                totpCode:
                  type: string
                  pattern: '^[0-9]{6}$'
      responses:
        200:
          description: Authentication successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  sessionToken:
                    type: string
                  expiresAt:
                    type: string
                    format: date-time
          headers:
            Set-Cookie:
              schema:
                type: string
                example: admin_session=abc123; HttpOnly; Secure; SameSite=Strict

  /admin/auth/2fa/setup:
    post:
      summary: Generate 2FA secret and QR code
      security:
        - bearerAuth: []
      responses:
        200:
          description: 2FA setup initiated
          content:
            application/json:
              schema:
                type: object
                properties:
                  secret:
                    type: string
                    description: Base32 encoded secret (show once)
                  qrCodeUrl:
                    type: string
                    description: Data URL of QR code
                  backupCodes:
                    type: array
                    items:
                      type: string
                    description: One-time backup codes (show once)

  /admin/auth/2fa/verify:
    post:
      summary: Verify and enable 2FA
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [totpCode]
              properties:
                totpCode:
                  type: string
                  pattern: '^[0-9]{6}$'
      responses:
        200:
          description: 2FA enabled successfully
        400:
          description: Invalid TOTP code

  /admin/auth/reauth:
    post:
      summary: Re-authenticate for sensitive action
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [password, totpCode, action]
              properties:
                password:
                  type: string
                totpCode:
                  type: string
                action:
                  type: string
      responses:
        200:
          description: Re-authentication successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  reauthToken:
                    type: string
                  expiresAt:
                    type: string
                    format: date-time
```

### 11.2 Admin Management Endpoints

```yaml
paths:
  /admin/users:
    get:
      summary: List all admin users
      security:
        - bearerAuth: []
      parameters:
        - name: page
          in: query
          schema:
            type: integer
        - name: limit
          in: query
          schema:
            type: integer
        - name: role
          in: query
          schema:
            type: string
      responses:
        200:
          description: List of admin users
          content:
            application/json:
              schema:
                type: object
                properties:
                  total:
                    type: integer
                  users:
                    type: array
                    items:
                      $ref: '#/components/schemas/AdminUser'

  /admin/users/{id}:
    delete:
      summary: Delete admin user (requires re-auth)
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: X-Reauth-Token
          in: header
          required: true
          schema:
            type: string
      responses:
        200:
          description: User deleted successfully
        403:
          description: Re-authentication required or insufficient permissions

  /admin/audit-logs:
    get:
      summary: Query audit logs
      security:
        - bearerAuth: []
      parameters:
        - name: user_id
          in: query
          schema:
            type: string
        - name: action
          in: query
          schema:
            type: string
        - name: start_date
          in: query
          schema:
            type: string
            format: date-time
        - name: end_date
          in: query
          schema:
            type: string
            format: date-time
      responses:
        200:
          description: Audit logs
          content:
            application/json:
              schema:
                type: object
                properties:
                  total:
                    type: integer
                  logs:
                    type: array
                    items:
                      $ref: '#/components/schemas/AuditLog'

components:
  schemas:
    AdminUser:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
        role:
          type: string
        status:
          type: string
          enum: [active, suspended, deleted]
        require2FA:
          type: boolean
        lastLoginAt:
          type: string
          format: date-time

    AuditLog:
      type: object
      properties:
        id:
          type: integer
        userId:
          type: string
        action:
          type: string
        resourceType:
          type: string
        resourceId:
          type: string
        changes:
          type: object
        ipAddress:
          type: string
        createdAt:
          type: string
          format: date-time

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

## 12. Technology Stack

### 12.1 Core Technologies

**Backend Framework**:
- Node.js 18+ LTS
- Express.js 4.18+
- TypeScript 5.0+

**Authentication & Security**:
- `passport` - Authentication middleware
- `otplib` v12.0.1+ - TOTP implementation
- `qrcode` v1.5.0+ - QR code generation
- `bcrypt` v5.1.0+ - Password hashing
- `helmet` - HTTP security headers
- `express-rate-limit` - Rate limiting
- `express-validator` - Input validation

**Session Management**:
- `express-session` - Session middleware
- `connect-redis` - Redis session store
- Redis 7.0+ - Session cache

**Database**:
- PostgreSQL 15+ - Primary data store
- TimescaleDB (extension) - Time-series audit logs
- `pg` - PostgreSQL client
- `pg-promise` - Promise-based PostgreSQL

**Monitoring & Logging**:
- `winston` - Logging framework
- `morgan` - HTTP request logging
- Prometheus - Metrics collection
- Grafana - Visualization

### 12.2 Deployment Architecture

```
Production Environment
┌─────────────────────────────────────────────────────────────┐
│  Load Balancer (AWS ALB / Nginx)                             │
│  - SSL/TLS termination                                       │
│  - Health checks                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼───────┐ ┌──────▼──────┐ ┌──────▼──────┐
│ Auth Service  │ │ Auth Service│ │ Auth Service│
│ Instance 1    │ │ Instance 2  │ │ Instance 3  │
└───────┬───────┘ └──────┬──────┘ └──────┬──────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼────────┐ ┌─────▼────────┐ ┌────▼────────┐
│   PostgreSQL   │ │ Redis Cluster│ │  TimescaleDB│
│   Primary      │ │ (Sentinel)   │ │  (Audit)    │
└───────┬────────┘ └──────────────┘ └─────────────┘
        │
┌───────▼────────┐
│   PostgreSQL   │
│   Replica 1    │
└────────────────┘
```

---

## 13. Security Best Practices

### 13.1 Defense-in-Depth Layers

**Layer 1: Network**
- TLS 1.3 only
- IP whitelisting
- DDoS protection (CloudFlare/AWS Shield)
- VPC isolation

**Layer 2: Application**
- Input validation and sanitization
- CSRF protection (SameSite cookies)
- XSS prevention (Content-Security-Policy headers)
- SQL injection prevention (parameterized queries)
- Rate limiting (per IP, per user)

**Layer 3: Authentication**
- Strong password requirements (12+ chars, complexity)
- Multi-factor authentication (TOTP)
- Account lockout after failed attempts
- Session timeout and rotation

**Layer 4: Authorization**
- Role-based access control (RBAC)
- Principle of least privilege
- Re-authentication for sensitive actions
- Audit all authorization decisions

**Layer 5: Data**
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Secure key management (AWS KMS)
- Data retention and deletion policies

### 13.2 Security Checklist

- [ ] All passwords hashed with bcrypt (cost factor 10+)
- [ ] 2FA secrets encrypted with AES-256
- [ ] Session tokens cryptographically random (256 bits)
- [ ] All cookies marked httpOnly, secure, sameSite
- [ ] Rate limiting on all authentication endpoints
- [ ] IP whitelisting enforced for admin users
- [ ] Audit logging for all admin actions
- [ ] Security alerts for anomalous behavior
- [ ] Regular security audits and penetration testing
- [ ] Dependency scanning for vulnerabilities
- [ ] Secrets in environment variables, never in code
- [ ] Database credentials rotated quarterly
- [ ] Backup encryption and offsite storage
- [ ] Incident response plan documented
- [ ] Security training for all admin users

### 13.3 Compliance Considerations

**GDPR**:
- Right to access audit logs
- Right to delete admin account
- Data breach notification (72 hours)
- Data retention policies enforced

**SOC 2**:
- Comprehensive audit logging
- Access controls and segregation of duties
- Encryption requirements met
- Regular security assessments

**PCI-DSS** (if handling payments):
- Network segmentation
- Strong access controls
- Regular security testing
- Audit trail maintenance

---

## Appendix A: Glossary

- **TOTP**: Time-based One-Time Password (RFC 6238)
- **HOTP**: HMAC-based One-Time Password (RFC 4226)
- **2FA**: Two-Factor Authentication
- **RBAC**: Role-Based Access Control
- **CIDR**: Classless Inter-Domain Routing (IP range notation)
- **CSRF**: Cross-Site Request Forgery
- **XSS**: Cross-Site Scripting
- **TLS**: Transport Layer Security
- **AES**: Advanced Encryption Standard
- **HMAC**: Hash-based Message Authentication Code

---

**Document Status**: ARCHITECTURE DRAFT
**Next Phase**: SPARC Phase 4 - Refinement (Implementation)
**Review Required**: Security team approval before implementation
**Estimated Implementation**: 3-4 weeks (40-60 hours)

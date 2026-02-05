# ADR-013: Data Privacy and GDPR Compliance

**Status**: Accepted
**Date**: 2026-02-05
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-004 (Token Auth), ADR-005 (Database), ADR-007 (Bounded Contexts), ADR-009 (Domain Events), ADR-010 (Repository Pattern)

## Context

The Community Social Network stores personal data across all seven bounded contexts (ADR-007). This includes email addresses, display names, bios, locations, IP addresses, user agent strings, password hashes, and audit logs. GDPR (General Data Protection Regulation) and similar privacy regulations (CCPA, LGPD) impose specific requirements on how this data is collected, stored, processed, and deleted.

Current architectural gaps:

1. **No right to erasure**: ADR-010 implements soft delete by default (`deletedAt` timestamp). GDPR Article 17 requires the ability to permanently erase personal data on request. Soft delete alone is insufficient because the PII remains in the database.
2. **No data portability**: GDPR Article 20 requires providing users their data in a machine-readable format. No export mechanism exists.
3. **No consent management**: Registration captures email and password but does not record explicit consent for data processing, nor does it provide granular opt-in/opt-out for optional processing activities.
4. **No data retention policies**: Expired refresh tokens (ADR-004), old notifications (ADR-005 partitioning), and audit logs have no defined lifecycle or cleanup schedule.
5. **No PII classification**: Data fields are not classified by sensitivity level, making it unclear which fields require extra protection or special handling.
6. **Log sanitization**: The `MemberAuthenticatedEvent` (ADR-009) includes `ipAddress` and `userAgent` fields with no documented retention limit or anonymization strategy.

Regulatory requirements driving this decision:

- **GDPR Article 5**: Principles of data minimization, purpose limitation, storage limitation
- **GDPR Article 6**: Lawful basis for processing (consent, legitimate interest, contractual necessity)
- **GDPR Article 17**: Right to erasure ("right to be forgotten")
- **GDPR Article 20**: Right to data portability
- **GDPR Article 25**: Data protection by design and by default
- **GDPR Article 30**: Records of processing activities
- **GDPR Article 32**: Security of processing

## Decision

We adopt a **privacy-by-design approach** with GDPR compliance as the baseline standard. All privacy requirements apply regardless of the deployment region, ensuring a single consistent data handling model.

### Privacy Architecture Overview

```
+---------------------------------------------------------------------------+
|                     Privacy-by-Design Architecture                         |
+---------------------------------------------------------------------------+

+---------------------------------------------------------------------------+
|                            API LAYER                                       |
|                                                                            |
|  +---------------------------+    +---------------------------+           |
|  | Cookie Consent Middleware |    | Consent Verification      |           |
|  | (essential vs analytics)  |    | Middleware                |           |
|  +---------------------------+    +---------------------------+           |
|                                                                            |
+---------------------------------------------------------------------------+
                |                              |
                v                              v
+---------------------------------------------------------------------------+
|                       APPLICATION LAYER                                    |
|                                                                            |
|  +---------------------------+    +---------------------------+           |
|  | EraseUserDataCommand      |    | ExportUserDataCommand     |           |
|  | Handler                   |    | Handler                   |           |
|  +---------------------------+    +---------------------------+           |
|                                                                            |
|  +---------------------------+    +---------------------------+           |
|  | ConsentManagement         |    | DataRetention             |           |
|  | Service                   |    | Scheduler                 |           |
|  +---------------------------+    +---------------------------+           |
|                                                                            |
+---------------------------------------------------------------------------+
                |                              |
                v                              v
+---------------------------------------------------------------------------+
|                       DOMAIN LAYER                                         |
|                                                                            |
|  +---------------------------+    +---------------------------+           |
|  | ErasureRequest            |    | ConsentRecord             |           |
|  | (Value Object)            |    | (Entity)                  |           |
|  +---------------------------+    +---------------------------+           |
|                                                                            |
|  +---------------------------+    +---------------------------+           |
|  | DataExportRequest         |    | RetentionPolicy           |           |
|  | (Value Object)            |    | (Value Object)            |           |
|  +---------------------------+    +---------------------------+           |
|                                                                            |
+---------------------------------------------------------------------------+
                |                              |
                v                              v
+---------------------------------------------------------------------------+
|                    INFRASTRUCTURE LAYER                                     |
|                                                                            |
|  +---------------------------+    +---------------------------+           |
|  | ErasureJobProcessor       |    | DataExportJobProcessor    |           |
|  | (Bull Queue Worker)       |    | (Bull Queue Worker)       |           |
|  +---------------------------+    +---------------------------+           |
|                                                                            |
|  +---------------------------+    +---------------------------+           |
|  | RetentionCleanupJob       |    | LogSanitizer              |           |
|  | (Cron Scheduler)          |    | (Middleware)              |           |
|  +---------------------------+    +---------------------------+           |
|                                                                            |
+---------------------------------------------------------------------------+
```

---

### 1. Data Classification

All PII fields across bounded contexts are classified into four sensitivity levels. This classification determines encryption requirements, access controls, retention policies, and erasure behavior.

#### Classification Levels

| Level | Definition | Access Control | Encryption | Erasure Behavior |
|-------|-----------|----------------|------------|------------------|
| **Public** | Visible to any authenticated user (e.g., display name on posts) | Read: all authenticated users | At rest (database-level) | Anonymize on erasure |
| **Private** | Visible only to the data subject | Read: owner only | At rest (database-level) | Hard delete on erasure |
| **Internal** | System use only, never exposed via API | Read: system processes only | At rest (database-level) | Anonymize or hard delete |
| **Sensitive** | Requires extra protection, high risk if exposed | Read: owner + explicit authorization | At rest (column-level encryption) | Hard delete on erasure |

#### PII Inventory by Bounded Context

| Bounded Context | Table | Field | Data Type | Classification | Purpose | Lawful Basis |
|-----------------|-------|-------|-----------|---------------|---------|--------------|
| Identity | `users` | `email` | Personal | Sensitive | Account identification, login | Contractual necessity |
| Identity | `users` | `password_hash` | Personal | Sensitive | Authentication | Contractual necessity |
| Identity | `refresh_tokens` | `ip_address` | Technical | Internal | Security audit, abuse detection | Legitimate interest |
| Identity | `refresh_tokens` | `device_info` | Technical | Internal | Session management, device display | Legitimate interest |
| Profile | `user_profiles` | `display_name` | Personal | Public | User identification in UI | Consent |
| Profile | `user_profiles` | `bio` | Personal | Public | Self-expression | Consent |
| Profile | `user_profiles` | `avatar_url` | Personal | Public | Visual identification | Consent |
| Profile | `user_profiles` | `location` | Personal | Private | Optional geographic context | Consent |
| Content | `posts` | `content` | Behavioral | Public | User-generated content | Consent |
| Content | `posts` | `author_id` | Personal | Public | Content attribution | Contractual necessity |
| Content | `comments` | `content` | Behavioral | Public | User-generated content | Consent |
| Content | `comments` | `author_id` | Personal | Public | Content attribution | Contractual necessity |
| Social Graph | `follows` | `follower_id` | Behavioral | Private | Social relationship | Consent |
| Social Graph | `follows` | `following_id` | Behavioral | Private | Social relationship | Consent |
| Social Graph | `blocks` | `blocker_id` | Behavioral | Private | Privacy enforcement | Legitimate interest |
| Social Graph | `blocks` | `blocked_id` | Behavioral | Private | Privacy enforcement | Legitimate interest |
| Community | `group_members` | `user_id` | Behavioral | Public | Group participation | Consent |
| Notification | `notifications` | `recipient_id` | Personal | Private | Alert delivery | Contractual necessity |
| Admin | `audit_logs` | `admin_id` | Personal | Internal | Security compliance | Legal obligation |
| Admin | `audit_logs` | `ip_address` | Technical | Internal | Security forensics | Legitimate interest |

---

### 2. Right to Erasure (GDPR Article 17)

When a user requests account deletion, we execute a multi-step erasure process that combines hard deletion and anonymization depending on the data classification. Content authored by the user is preserved for community integrity but disassociated from the deleted identity.

#### Erasure Strategy by Data Type

| Data | Strategy | Rationale |
|------|----------|-----------|
| `users` record | Hard delete | Remove authentication credentials entirely |
| `user_profiles` record | Anonymize then hard delete | Clear PII fields, then remove record |
| `posts` | Anonymize author | Keep content for thread integrity; replace `author_id` with system "deleted-user" account |
| `comments` | Anonymize author | Keep content for thread integrity; replace `author_id` with system "deleted-user" account |
| `follows` | Hard delete | No community value after user deletion |
| `blocks` | Hard delete | No purpose after user deletion |
| `group_members` | Hard delete | Remove all group associations |
| `notifications` | Hard delete | No value to other users |
| `refresh_tokens` | Hard delete | Security cleanup |
| `token_blacklist` | Retain until expiry | Security: prevents reuse of revoked tokens |
| `audit_logs` | Anonymize | Replace user identifiers with `deleted-user-{sha256(memberId).substring(0, 12)}` |
| Redis cache entries | Purge | Remove all cached data for this user |

#### Erasure Command

```typescript
// src/application/identity/commands/EraseUserDataCommand.ts

interface EraseUserDataCommand {
  memberId: string;
  requestedAt: Date;
  verificationToken: string;
}

// Erasure steps (ordered)
// 1. Revoke all tokens and sessions
// 2. Anonymize user_profiles (set display_name to "Deleted User", clear bio, avatar, location)
// 3. Update posts: set author_id to system "deleted-user" account, keep content
// 4. Delete follows, blocks, group memberships
// 5. Delete notifications
// 6. Anonymize audit_logs: replace user identifiers with "deleted-user-{sha256(memberId)}"
// 7. Delete the users record (hard delete)
// 8. Purge all caches for this user
// 9. Emit UserDataErasedEvent for downstream cleanup
```

#### Erasure Handler

```typescript
// src/application/identity/handlers/EraseUserDataHandler.ts

export class EraseUserDataHandler {
  constructor(
    private readonly memberRepository: MemberRepository,
    private readonly profileRepository: ProfileRepository,
    private readonly publicationRepository: PublicationRepository,
    private readonly connectionRepository: ConnectionRepository,
    private readonly blockRepository: BlockRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly alertRepository: AlertRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly tokenService: TokenService,
    private readonly cacheService: CacheService,
    private readonly eventPublisher: EventPublisher,
    private readonly dataSource: DataSource
  ) {}

  async execute(command: EraseUserDataCommand): Promise<void> {
    const member = await this.memberRepository.findById(
      MemberId.from(command.memberId)
    );

    if (!member) {
      throw new MemberNotFoundError(command.memberId);
    }

    // Execute all erasure steps within a single transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const memberId = command.memberId;
      const anonymizedId = `deleted-user-${sha256(memberId).substring(0, 12)}`;

      // Step 1: Revoke all tokens and sessions
      await this.tokenService.revokeAllForUser(memberId);

      // Step 2: Anonymize profile
      await queryRunner.query(
        `UPDATE user_profiles
         SET display_name = 'Deleted User',
             bio = NULL,
             avatar_url = NULL,
             location = NULL,
             updated_at = NOW()
         WHERE user_id = $1`,
        [memberId]
      );

      // Step 3: Anonymize authored content (reassign to system account)
      const DELETED_USER_SYSTEM_ID = '00000000-0000-0000-0000-000000000000';
      await queryRunner.query(
        `UPDATE posts SET author_id = $1 WHERE author_id = $2`,
        [DELETED_USER_SYSTEM_ID, memberId]
      );
      await queryRunner.query(
        `UPDATE comments SET author_id = $1 WHERE author_id = $2`,
        [DELETED_USER_SYSTEM_ID, memberId]
      );

      // Step 4: Delete social graph data
      await queryRunner.query(
        `DELETE FROM follows WHERE follower_id = $1 OR following_id = $1`,
        [memberId]
      );
      await queryRunner.query(
        `DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1`,
        [memberId]
      );
      await queryRunner.query(
        `DELETE FROM group_members WHERE user_id = $1`,
        [memberId]
      );

      // Step 5: Delete notifications
      await queryRunner.query(
        `DELETE FROM notifications WHERE recipient_id = $1`,
        [memberId]
      );

      // Step 6: Anonymize audit logs
      await queryRunner.query(
        `UPDATE audit_logs
         SET admin_id = $1,
             details = jsonb_set(
               COALESCE(details, '{}'::jsonb),
               '{anonymized}',
               'true'::jsonb
             )
         WHERE admin_id = $2`,
        [anonymizedId, memberId]
      );

      // Step 7: Delete user_profiles and users records
      await queryRunner.query(
        `DELETE FROM user_profiles WHERE user_id = $1`,
        [memberId]
      );
      await queryRunner.query(
        `DELETE FROM users WHERE id = $1`,
        [memberId]
      );

      await queryRunner.commitTransaction();

      // Step 8: Purge all caches (outside transaction)
      await this.cacheService.invalidatePattern(`member:${memberId}*`);
      await this.cacheService.invalidatePattern(`profile:${memberId}*`);
      await this.cacheService.invalidatePattern(`member:email:*`);
      await this.cacheService.invalidatePattern(`block:${memberId}*`);
      await this.cacheService.invalidatePattern(`connection:${memberId}*`);

      // Step 9: Emit event for any downstream cleanup
      await this.eventPublisher.publish(
        new UserDataErasedEvent(memberId, anonymizedId, new Date())
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

#### Erasure Domain Event

```typescript
// src/domain/identity/events/UserDataErasedEvent.ts

export class UserDataErasedEvent extends DomainEvent {
  constructor(
    readonly originalMemberId: string,
    readonly anonymizedId: string,
    readonly erasedAt: Date
  ) {
    super(originalMemberId, 'Member');
  }

  get eventType(): string {
    return 'identity.user_data_erased';
  }

  protected getPayload() {
    return {
      anonymizedId: this.anonymizedId,
      erasedAt: this.erasedAt.toISOString(),
    };
  }
}
```

#### Erasure Timeline and Verification

- **Request acknowledgment**: Immediate (HTTP 202 Accepted)
- **Erasure execution**: Within 30 calendar days of request (GDPR Article 17(1))
- **Implementation target**: Complete within 24 hours via Bull Queue job
- **Verification**: A daily scheduled job (`ErasureVerificationJob`) scans for erasure requests older than 48 hours that have not been completed and raises a `SecurityAlertRaisedEvent` with severity `high`

```typescript
// src/infrastructure/identity/jobs/ErasureVerificationJob.ts

export class ErasureVerificationJob {
  // Runs daily at 02:00 UTC via cron
  // Checks erasure_requests table for status = 'pending' AND requested_at < NOW() - INTERVAL '48 hours'
  // Raises SecurityAlertRaisedEvent for any overdue requests
  // Verifies completed erasures by checking that no PII remains for the memberId
}
```

#### System "Deleted User" Account

A reserved system account with a well-known UUID is created during database seeding. This account serves as the attribution target for orphaned content.

```sql
-- Database seed: system deleted-user account
INSERT INTO users (id, email, password_hash, status, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system-deleted@internal.local',
  'NOLOGIN',
  'system',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_profiles (id, user_id, display_name, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'Deleted User',
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;
```

---

### 3. Right to Data Portability (GDPR Article 20)

Users can request an export of all their personal data in a machine-readable format (JSON).

#### Export Endpoint

```
GET /api/v1/users/me/data-export
Authorization: Bearer {accessToken}
Response: 202 Accepted
{
  "message": "Data export has been queued. You will receive a notification when it is ready.",
  "estimatedTime": "5 minutes"
}
```

#### Export Contents

The exported JSON archive contains the following sections:

```typescript
// src/application/identity/commands/ExportUserDataCommand.ts

interface UserDataExport {
  exportedAt: string;          // ISO 8601 timestamp
  dataSubject: {
    id: string;
    email: string;
    emailVerified: boolean;
    createdAt: string;
    status: string;
  };
  profile: {
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    location: string | null;
    isPrivate: boolean;
  };
  posts: Array<{
    id: string;
    content: string;
    visibility: string;
    createdAt: string;
    updatedAt: string;
  }>;
  comments: Array<{
    id: string;
    postId: string;
    content: string;
    createdAt: string;
  }>;
  following: Array<{
    userId: string;
    followedAt: string;
  }>;
  followers: Array<{
    userId: string;
    followedAt: string;
  }>;
  groups: Array<{
    groupId: string;
    groupName: string;
    role: string;
    joinedAt: string;
  }>;
  blocks: Array<{
    blockedUserId: string;
    createdAt: string;
  }>;
  notificationPreferences: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  consents: Array<{
    type: string;
    granted: boolean;
    version: string;
    grantedAt: string;
    withdrawnAt: string | null;
  }>;
}
```

#### Export Processing

Exports are processed asynchronously via Bull Queue to avoid blocking API responses for users with large amounts of data.

```typescript
// src/infrastructure/identity/jobs/DataExportJobProcessor.ts

export class DataExportJobProcessor {
  // Bull Queue job name: 'user-data-export'
  // Priority: medium (3)
  // Timeout: 5 minutes
  // Retries: 2

  async process(job: Job<{ memberId: string }>): Promise<void> {
    const { memberId } = job.data;

    // 1. Query all user data across bounded contexts
    // 2. Assemble UserDataExport JSON
    // 3. Write to temporary file storage (e.g., /tmp/exports/{memberId}-{timestamp}.json)
    // 4. Generate signed download URL (expires in 7 days)
    // 5. Create notification for user with download link
    // 6. Emit DataExportReadyEvent
  }
}
```

#### Export Retention

- Export files are retained for **7 days** after generation
- A daily cleanup job (`ExportCleanupJob`) deletes expired export files
- Users can request a new export at any time (rate limited to 1 per 24 hours)

---

### 4. Consent Management

Consent is recorded explicitly at registration and can be managed at any time via profile settings.

#### Consent Categories

| Category | Required | Default | Lawful Basis | Withdrawable |
|----------|----------|---------|--------------|--------------|
| Terms of Service | Yes | N/A (must accept) | Contractual necessity | No (account deletion required) |
| Privacy Policy | Yes | N/A (must accept) | Contractual necessity | No (account deletion required) |
| Email notifications | No | Opt-in | Consent | Yes |
| Push notifications | No | Opt-in | Consent | Yes |
| Analytics / usage tracking | No | Opt-out (disabled by default) | Consent | Yes |
| Cookie analytics | No | Opt-out (disabled by default) | Consent | Yes |

#### Consent Record Schema

```sql
-- Consent records table
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(100) NOT NULL,
    granted BOOLEAN NOT NULL,
    policy_version VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    withdrawn_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_consent (user_id, consent_type),
    INDEX idx_consent_type (consent_type)
);

-- Track policy version changes
CREATE TABLE privacy_policy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(50) UNIQUE NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Consent Domain Model

```typescript
// src/domain/identity/entities/ConsentRecord.ts

export class ConsentRecord {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly consentType: ConsentType,
    readonly granted: boolean,
    readonly policyVersion: string,
    readonly grantedAt: Date,
    readonly withdrawnAt: Date | null
  ) {}

  isActive(): boolean {
    return this.granted && this.withdrawnAt === null;
  }

  withdraw(): ConsentRecord {
    if (!this.granted || this.withdrawnAt !== null) {
      throw new ConsentAlreadyWithdrawnError(this.id);
    }
    return new ConsentRecord(
      this.id,
      this.userId,
      this.consentType,
      this.granted,
      this.policyVersion,
      this.grantedAt,
      new Date()
    );
  }
}

export enum ConsentType {
  TERMS_OF_SERVICE = 'terms_of_service',
  PRIVACY_POLICY = 'privacy_policy',
  EMAIL_NOTIFICATIONS = 'email_notifications',
  PUSH_NOTIFICATIONS = 'push_notifications',
  ANALYTICS = 'analytics',
  COOKIE_ANALYTICS = 'cookie_analytics',
}
```

#### Registration Flow with Consent

```typescript
// Updated registration command (extends ADR-008 Member aggregate)

interface RegisterMemberCommand {
  email: string;
  password: string;
  acceptedTermsVersion: string;
  acceptedPrivacyVersion: string;
  optInEmailNotifications: boolean;
  optInPushNotifications: boolean;
  optInAnalytics: boolean;
}

// Registration handler creates consent records alongside the Member aggregate
// Required consents (ToS, Privacy Policy) are validated before member creation
// Optional consents are recorded with the user's explicit choice
```

#### Consent Withdrawal

Users can withdraw optional consents at any time via `PATCH /api/v1/users/me/consents`. Withdrawing consent for Terms of Service or Privacy Policy requires account deletion (erasure request).

---

### 5. Data Retention Policies

All data types have defined retention periods enforced by scheduled cleanup jobs.

| Data Type | Retention Period | Action After Expiry | Enforcement Mechanism |
|-----------|-----------------|---------------------|-----------------------|
| User accounts (active) | Indefinite | N/A | N/A |
| User accounts (deactivated) | 90 days | Hard delete (erasure flow) | `DeactivatedAccountCleanupJob` (daily) |
| Refresh tokens (expired) | 30 days after expiry | Hard delete | `ExpiredTokenCleanupJob` (daily) |
| Token blacklist entries | Until token expiry + 1 hour | Hard delete | `BlacklistCleanupJob` (hourly) |
| Notifications | 6 months | Archive and detach partition (ADR-005) | `NotificationArchiveJob` (monthly) |
| Audit logs | 2 years | Archive to cold storage (S3/GCS) | `AuditLogArchiveJob` (monthly) |
| IP addresses in refresh_tokens | 90 days | Anonymize (truncate to /24 subnet) | `IPAnonymizationJob` (daily) |
| User agent strings in refresh_tokens | 90 days | Set to NULL | `IPAnonymizationJob` (daily) |
| Session data (Redis) | 7 days after token expiry | Automatic expiry (Redis TTL) | Redis key expiration |
| Data export files | 7 days | Hard delete from file storage | `ExportCleanupJob` (daily) |
| Erasure request records | 3 years | Archive | Legal retention for compliance proof |
| Consent records | Indefinite (while account exists) + 3 years after deletion | Archive | Legal retention for compliance proof |

#### Retention Enforcement Jobs

```typescript
// src/infrastructure/shared/jobs/RetentionScheduler.ts

export class RetentionScheduler {
  // All jobs use Bull Queue with cron scheduling

  readonly jobs = [
    {
      name: 'deactivated-account-cleanup',
      cron: '0 3 * * *',   // Daily at 03:00 UTC
      handler: DeactivatedAccountCleanupJob,
      description: 'Delete accounts deactivated > 90 days ago',
    },
    {
      name: 'expired-token-cleanup',
      cron: '0 4 * * *',   // Daily at 04:00 UTC
      handler: ExpiredTokenCleanupJob,
      description: 'Delete refresh_tokens where expires_at < NOW() - 30 days',
    },
    {
      name: 'blacklist-cleanup',
      cron: '0 * * * *',   // Hourly
      handler: BlacklistCleanupJob,
      description: 'Delete token_blacklist entries where expires_at + 1h < NOW()',
    },
    {
      name: 'notification-archive',
      cron: '0 2 1 * *',   // Monthly on 1st at 02:00 UTC
      handler: NotificationArchiveJob,
      description: 'Detach notification partitions older than 6 months',
    },
    {
      name: 'audit-log-archive',
      cron: '0 2 1 * *',   // Monthly on 1st at 02:00 UTC
      handler: AuditLogArchiveJob,
      description: 'Archive audit_logs older than 2 years to cold storage',
    },
    {
      name: 'ip-anonymization',
      cron: '0 5 * * *',   // Daily at 05:00 UTC
      handler: IPAnonymizationJob,
      description: 'Anonymize IP addresses and clear user agents older than 90 days',
    },
    {
      name: 'export-cleanup',
      cron: '0 6 * * *',   // Daily at 06:00 UTC
      handler: ExportCleanupJob,
      description: 'Delete data export files older than 7 days',
    },
    {
      name: 'erasure-verification',
      cron: '0 2 * * *',   // Daily at 02:00 UTC
      handler: ErasureVerificationJob,
      description: 'Verify pending erasure requests are completed within 48 hours',
    },
  ];
}
```

#### IP Address Anonymization

```sql
-- Anonymize IP addresses older than 90 days (truncate to /24 subnet)
UPDATE refresh_tokens
SET ip_address = set_masklen(ip_address, 24),
    device_info = NULL
WHERE created_at < NOW() - INTERVAL '90 days'
  AND ip_address IS NOT NULL
  AND masklen(ip_address) > 24;
```

---

### 6. Privacy by Design Principles

#### Data Minimization

Every PII field collected must have a documented purpose. The following table serves as the record of processing activities (GDPR Article 30).

| Field | Purpose | Necessary | Alternative if Removed |
|-------|---------|-----------|----------------------|
| `email` | Account identification, password reset, notifications | Yes | None -- required for account |
| `password_hash` | Authentication | Yes | None -- required for login |
| `display_name` | User identification in UI | Yes (can be pseudonymous) | Auto-generate from user ID |
| `bio` | Self-expression, profile completeness | No | Remove field entirely |
| `avatar_url` | Visual identification | No | Use generated avatar (initials) |
| `location` | Optional geographic context | No | Remove field entirely |
| `ip_address` | Security audit, rate limiting, abuse detection | Yes (temporary) | Anonymize after 90 days |
| `user_agent` | Device management UI, security audit | Yes (temporary) | Anonymize after 90 days |

#### Purpose Limitation

Data collected for one purpose must not be repurposed without additional consent. Specifically:

- Email addresses collected for authentication must not be used for marketing without explicit `email_notifications` consent
- IP addresses collected for security must not be used for analytics without explicit `analytics` consent
- Location data must not be shared with other users unless the profile is public and the user has consented

#### Storage Limitation

All data types have defined retention periods (see Section 5). No data is retained beyond its stated purpose. Retention enforcement is automated via scheduled jobs.

#### Log Sanitization

Application logs must never contain raw PII. The following sanitization rules apply:

```typescript
// src/infrastructure/shared/logging/LogSanitizer.ts

export class LogSanitizer {
  /**
   * Sanitize PII before logging.
   * Applied as a middleware/transform in the logging pipeline.
   */
  static sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...data };

    // Email: mask local part (j***@example.com)
    if (typeof sanitized.email === 'string') {
      sanitized.email = LogSanitizer.maskEmail(sanitized.email);
    }

    // Never log passwords, tokens, or hashes
    delete sanitized.password;
    delete sanitized.passwordHash;
    delete sanitized.accessToken;
    delete sanitized.refreshToken;
    delete sanitized.token;
    delete sanitized.verificationToken;

    // IP address: log only in security context, truncate to /24 for general logs
    if (typeof sanitized.ipAddress === 'string' && !sanitized._securityContext) {
      sanitized.ipAddress = LogSanitizer.truncateIP(sanitized.ipAddress);
    }

    return sanitized;
  }

  static maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const masked = local.charAt(0) + '***';
    return `${masked}@${domain}`;
  }

  static truncateIP(ip: string): string {
    // Truncate IPv4 to /24: 192.168.1.100 -> 192.168.1.0/24
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
    return ip; // Return as-is for IPv6 (handled separately)
  }
}
```

#### Logging Rules

| Log Context | Email | IP Address | User Agent | Tokens | User ID |
|-------------|-------|------------|------------|--------|---------|
| General application logs | Masked (`j***@example.com`) | Truncated (`/24`) | Omitted | Never logged | Allowed |
| Security / audit logs | Masked | Full (retained 90 days) | Full (retained 90 days) | Never logged | Allowed |
| Error logs | Masked | Truncated | Omitted | Never logged | Allowed |
| Debug logs (dev only) | Full | Full | Full | Never logged | Allowed |

---

### 7. Cookie Consent

The system uses cookies for authentication (refresh token) and optionally for analytics.

#### Cookie Classification

| Cookie | Purpose | Type | Consent Required | Lifetime |
|--------|---------|------|------------------|----------|
| `refresh_token` | Authentication session persistence | Strictly necessary | No (GDPR Recital 32 exemption) | 7 days (ADR-004) |
| `csn_analytics` | Usage analytics tracking | Analytics | Yes (explicit opt-in) | 1 year |
| `csn_cookie_consent` | Records user's cookie preference | Strictly necessary | No | 1 year |

#### Cookie Banner Requirements

For web client implementations:

1. On first visit, display a cookie banner explaining cookie usage
2. Essential cookies (`refresh_token`, `csn_cookie_consent`) are set without consent
3. Analytics cookies (`csn_analytics`) require explicit opt-in via the banner
4. The user's choice is stored in the `csn_cookie_consent` cookie and in the `consent_records` table (for authenticated users)
5. The cookie banner must provide a link to the full Privacy Policy
6. Users can change their cookie preferences at any time via profile settings

---

### 8. Erasure Request Tracking

To provide an audit trail for compliance, erasure requests are tracked in a dedicated table.

```sql
CREATE TABLE erasure_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verification_token_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_requested_at (requested_at)
);

-- Note: user_id does NOT have a foreign key to users, because the user record
-- is deleted as part of the erasure process. This table serves as the compliance
-- proof that the erasure was completed.
```

#### Erasure Request Status Flow

```
pending -> processing -> completed
                     \-> failed -> pending (retry)
```

---

## Alternatives Considered

### Option A: Minimal Compliance (Rejected)

**Implementation**: Handle deletion requests manually via admin panel. No automated retention. No consent tracking.

**Pros**:
- Simplest to implement
- No additional infrastructure

**Cons**:
- **Non-compliant**: Manual processes are error-prone and unauditable
- **Scalability**: Does not scale beyond a few requests per month
- **Legal risk**: No proof of compliance (no consent records, no erasure audit trail)

**Why Rejected**: Manual processes cannot guarantee the 30-day erasure timeline and provide no audit trail for regulatory inquiries.

### Option B: Full Anonymization Only (Rejected)

**Implementation**: Instead of hard deleting user records, anonymize all PII fields in place (replace email with hash, clear profile fields, etc.) but never delete any database rows.

**Pros**:
- Preserves referential integrity without a system "deleted-user" account
- Simpler transaction (no cascading deletes)
- Easier to implement incrementally

**Cons**:
- **Storage waste**: Anonymized rows accumulate indefinitely
- **Incomplete erasure**: Some regulators interpret "erasure" as requiring actual deletion, not just anonymization
- **Counter complexity**: Follower/following counts still reference anonymized records

**Why Rejected**: The hybrid approach (hard delete where possible, anonymize where content integrity requires it) better satisfies the spirit of GDPR Article 17 while maintaining data integrity.

### Option C: Encryption-Based Erasure (Crypto-Shredding) (Deferred)

**Implementation**: Encrypt each user's PII with a per-user encryption key. To "erase" a user, delete their encryption key, rendering all their encrypted data permanently unreadable.

**Pros**:
- Instant erasure (key deletion is O(1))
- No need to find and update every row containing user data
- Cryptographically provable erasure

**Cons**:
- **Complexity**: Requires per-user key management infrastructure
- **Performance**: Encryption/decryption overhead on every read/write
- **Search**: Cannot query encrypted fields (email lookup, name search)
- **Key management**: Must maintain secure key storage with backup and rotation

**Why Deferred**: Crypto-shredding is the gold standard for erasure at scale but introduces significant infrastructure complexity. Consider adopting when the user base exceeds 100,000 and per-record erasure becomes a performance bottleneck.

---

## Consequences

### Positive

- **Regulatory Compliance**: GDPR Articles 5, 6, 17, 20, 25, 30, and 32 are addressed with concrete implementations
- **User Trust**: Transparent data handling builds user confidence in the platform
- **Audit Trail**: Consent records and erasure request logs provide provable compliance for regulatory inquiries
- **Data Hygiene**: Retention policies prevent unbounded data growth, reducing storage costs and improving query performance
- **Security Posture**: Log sanitization and IP anonymization reduce the blast radius of a data breach

### Negative

- **Implementation Complexity**: The erasure handler touches all seven bounded contexts in a single transaction
- **Performance Overhead**: Erasure and export operations are resource-intensive for users with large data footprints
- **Schema Changes**: New tables (`consent_records`, `privacy_policy_versions`, `erasure_requests`) and schema modifications required
- **Operational Overhead**: Eight scheduled retention jobs require monitoring and alerting
- **Content Attribution**: Posts and comments from deleted users show "Deleted User" which may degrade reading experience

### Mitigation

| Risk | Mitigation |
|------|------------|
| Erasure transaction complexity | Execute via Bull Queue with retry logic; the handler is idempotent (re-running a partial erasure completes remaining steps) |
| Erasure performance for large accounts | Process in batches (1000 rows per batch) with progress tracking; timeout set to 5 minutes per job |
| Export performance for large accounts | Process asynchronously via Bull Queue; stream JSON assembly to avoid memory exhaustion |
| Retention job failures | Each job emits health metrics; failures trigger `SecurityAlertRaisedEvent` with severity `medium` |
| "Deleted User" attribution | Display a subtle indicator (e.g., grayed-out name) rather than a jarring "Deleted User" label |
| Cross-context transaction scope | The erasure handler uses a single database transaction since all contexts share the same PostgreSQL instance (ADR-002 modular monolith). If contexts are later extracted to separate services, the erasure flow must be converted to a saga pattern (ADR-009 events). |

## Privacy Impact Assessment Triggers

Any of the following changes require an updated Privacy Impact Assessment (PIA):

1. Adding a new PII field to any database table
2. Introducing a new third-party data processor (analytics, email service, etc.)
3. Changing the lawful basis for processing any existing data field
4. Extending a retention period beyond the values documented in this ADR
5. Introducing cross-border data transfers

## References

- GDPR Full Text: https://gdpr-info.eu/
- GDPR Article 17 (Right to Erasure): https://gdpr-info.eu/art-17-gdpr/
- GDPR Article 20 (Right to Data Portability): https://gdpr-info.eu/art-20-gdpr/
- GDPR Article 25 (Data Protection by Design): https://gdpr-info.eu/art-25-gdpr/
- ICO Guide to Data Protection: https://ico.org.uk/for-organisations/guide-to-data-protection/
- OWASP Privacy Risks: https://owasp.org/www-project-top-10-privacy-risks/
- ADR-004: Session vs Token Auth (token storage, refresh token lifecycle)
- ADR-005: SQL vs NoSQL (database schema, partitioning strategy)
- ADR-007: Bounded Contexts Definition (context boundaries, PII ownership)
- ADR-009: Domain Events Strategy (event-driven cross-context communication)
- ADR-010: Repository Pattern Implementation (soft delete default, cache invalidation)

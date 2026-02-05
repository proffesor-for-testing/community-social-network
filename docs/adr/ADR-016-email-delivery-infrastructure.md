# ADR-016: Email Delivery Infrastructure

**Status**: Accepted
**Date**: 2026-02-05
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-004 (Token Auth / Email Verification), ADR-007 (Bounded Contexts / Notification Context), ADR-009 (Domain Events / Bull Queue), ADR-012 (Observability Strategy), ADR-013 (Data Privacy / GDPR)

## Context

The Community Social Network platform relies on email for critical user lifecycle operations and engagement. ADR-004 mandates email verification on registration and email-based password reset. ADR-007 defines the Notification bounded context with Alert, Preference, and Channel aggregates, listing email as a primary delivery channel. ADR-009 establishes Bull Queue with Redis for asynchronous event processing and specifies at-least-once delivery guarantees for email notifications. ADR-013 requires GDPR-compliant consent tracking for marketing emails and mandates that every non-transactional email include an unsubscribe mechanism.

Despite these upstream decisions, no ADR specifies the concrete email delivery infrastructure: what SMTP transport sends emails, how templates are authored and rendered, how delivery is tracked, how bounces and complaints are processed, or how user preferences control email frequency per category.

The QE Requirements Validation Report identified this as a **P2 recommendation (#20)**: "Add email delivery infrastructure specification for notification channels beyond WebSocket."

Without this ADR, the following capabilities remain undefined:

1. **Authentication emails**: Email verification on registration, password reset links, password change confirmations, and new device login alerts are all referenced in ADR-004 but have no delivery specification.
2. **Social engagement emails**: New follower notifications and mention alerts have no template or delivery pipeline.
3. **Content interaction emails**: Comment and reaction notifications on user-authored content lack an email channel.
4. **Community management emails**: Group invitations and role change notifications have no email delivery path.
5. **Administrative emails**: Account suspension notices and weekly digest summaries have no sending mechanism.
6. **Delivery tracking**: No mechanism exists for recording whether emails were delivered, bounced, or marked as spam.
7. **User preferences**: ADR-007 states users can configure notification preferences per channel, but no implementation exists for email opt-out or frequency control.
8. **Anti-spam compliance**: No specification for SPF, DKIM, DMARC, or RFC 8058 one-click unsubscribe headers.
9. **Bounce handling**: No specification for processing hard bounces, soft bounces, or spam complaints from the email provider.

### Key Constraints

- **Bull Queue infrastructure exists**: ADR-009 already defines Bull Queue + Redis for asynchronous event processing with DLQ strategy.
- **Notification Context owns delivery**: ADR-007 places all delivery logic within the Notification bounded context.
- **At-least-once guarantee required**: ADR-009 specifies at-least-once delivery for email notifications.
- **GDPR compliance**: ADR-013 requires consent tracking and data portability; marketing email preferences fall under this scope.
- **Observability**: ADR-012 defines Prometheus metrics with `csn_` prefix, Pino structured logging, and OpenTelemetry tracing. Email metrics must follow these conventions.
- **1,000 concurrent users**: Scale target from ADR-002; email volume estimated at 5,000-10,000 emails per day at full scale.
- **AWS infrastructure**: ADR-011 references AWS for production deployment; SES is the natural email service within this ecosystem.

### Driving Requirements

| Requirement | Source | Priority |
|-------------|--------|----------|
| Email verification on registration | ADR-004 | Critical |
| Password reset via email | ADR-004 | Critical |
| Per-category notification preferences | ADR-007 | High |
| At-least-once delivery for email | ADR-009 | High |
| Marketing email consent tracking | ADR-013 | High |
| One-click unsubscribe | ADR-013 / GDPR | High |
| Observability for email pipeline | ADR-012 | Medium |
| Bounce/complaint handling | New (sender reputation) | Medium |

---

## Decision

We adopt a **Bull Queue-based asynchronous email delivery system** using **Nodemailer** for SMTP transport, **Handlebars** for template rendering, and **AWS SES** as the production SMTP provider. Development environments use **Ethereal** (a fake SMTP service that captures emails for inspection without delivering them). Staging environments use **SES sandbox mode** (verified addresses only).

### Email Architecture Overview

```
+---------------------------------------------------------------------------+
|                       Email Delivery Architecture                         |
+---------------------------------------------------------------------------+

  Domain Event (from any bounded context)
       |
       v
+------------------+     +------------------+     +------------------+
|   Notification   |     |   Bull Queue     |     |   Email Worker   |
|   Handler        |---->|  (email-delivery)|---->|                  |
|                  |     |                  |     |  1. Check suppr. |
|  - Resolve type  |     |  Priority levels:|     |  2. Check prefs  |
|  - Check consent |     |  1: critical     |     |  3. Render tpl   |
|  - Build payload |     |  2: high         |     |  4. Send SMTP    |
|  - Enqueue job   |     |  3: medium       |     |  5. Log delivery |
+------------------+     |  4: low          |     +--------+---------+
       ^                 +------------------+              |
       |                                                   v
       |                                          +------------------+
  Integration Event                               |   SMTP Transport |
  (from other contexts)                           |                  |
                                                  |  Prod: AWS SES   |
                                                  |  Staging: SES    |
                                                  |    sandbox       |
                                                  |  Dev: Ethereal   |
                                                  +--------+---------+
                                                           |
                                                           v
                                                  +------------------+
                                                  |   User Inbox     |
                                                  +------------------+
                                                           |
                                                  (bounce/complaint)
                                                           |
                                                           v
                                                  +------------------+
                                                  |  SES Webhook     |
                                                  |  (SNS -> API)    |
                                                  |                  |
                                                  |  Update:         |
                                                  |  - delivery log  |
                                                  |  - suppression   |
                                                  |  - preferences   |
                                                  +------------------+
```

---

### 1. Email Types Catalog

Every email sent by the platform falls into one of four categories. The category determines queue priority, whether the user can disable it, and which GDPR consent rules apply.

| Category | Email Type | Trigger Event | Priority | Can Disable? |
|----------|-----------|---------------|----------|--------------|
| Auth | Email verification | `identity.member_registered` | Critical (1) | No |
| Auth | Password reset | `identity.password_reset_requested` | Critical (1) | No |
| Auth | Password changed confirmation | `identity.password_changed` | High (2) | No |
| Auth | New device login alert | `identity.member_authenticated` (new device) | High (2) | No |
| Social | New follower notification | `social_graph.member_followed` | Medium (3) | Yes |
| Social | Mention notification | `content.member_mentioned` | Medium (3) | Yes |
| Content | Comment on your post | `content.discussion_created` | Medium (3) | Yes |
| Content | Reaction to your post | `content.reaction_added` | Low (4) | Yes |
| Community | Group invitation | `community.member_invited` | Medium (3) | Yes |
| Community | Group role changed | `community.member_promoted` / `community.member_demoted` | Medium (3) | Yes |
| Admin | Account suspended | `identity.member_suspended` | Critical (1) | No |
| Admin | Weekly digest | Scheduled (cron: `0 10 * * 0` -- Sundays at 10:00 UTC) | Low (4) | Yes |

#### Category Rules

| Category | GDPR Basis | Consent Required | Unsubscribe Header | Can User Disable |
|----------|-----------|-----------------|-------------------|-----------------|
| Auth | Contractual necessity | No | Not included | No |
| Social | Consent | Yes (ADR-013 `email_notifications`) | RFC 8058 | Yes |
| Content | Consent | Yes (ADR-013 `email_notifications`) | RFC 8058 | Yes |
| Community | Consent | Yes (ADR-013 `email_notifications`) | RFC 8058 | Yes |
| Admin (transactional) | Contractual necessity / Legal obligation | No | Not included | No |
| Admin (digest) | Consent | Yes | RFC 8058 | Yes |

**Rule**: Auth-category and admin-transactional emails (verification, password reset, password changed, new device login, account suspended) are sent regardless of user email preferences because they serve a security or contractual purpose. All other email types require active consent and respect per-category opt-out.

---

### 2. Template System

#### Technology Choice: Handlebars

Handlebars provides logic-less templates with partials and layouts, compiled once and cached in memory. Every HTML template has a corresponding plain-text alternative for email clients that do not render HTML.

#### Template Directory Structure

```
src/infrastructure/notification/templates/
  layouts/
    base.hbs                    # Shared HTML layout (header, footer, styles)
    base.txt.hbs                # Shared plain text layout
  partials/
    button.hbs                  # CTA button partial
    social-links.hbs            # Social media links in footer
    unsubscribe-footer.hbs      # Unsubscribe link and preferences link
  auth/
    email-verification.hbs
    email-verification.txt.hbs
    password-reset.hbs
    password-reset.txt.hbs
    password-changed.hbs
    password-changed.txt.hbs
    new-device-login.hbs
    new-device-login.txt.hbs
  social/
    new-follower.hbs
    new-follower.txt.hbs
    mention-notification.hbs
    mention-notification.txt.hbs
  content/
    comment-on-post.hbs
    comment-on-post.txt.hbs
    reaction-to-post.hbs
    reaction-to-post.txt.hbs
  community/
    group-invitation.hbs
    group-invitation.txt.hbs
    group-role-changed.hbs
    group-role-changed.txt.hbs
  admin/
    account-suspended.hbs
    account-suspended.txt.hbs
    weekly-digest.hbs
    weekly-digest.txt.hbs
```

#### Base Layout

Every email renders inside a base layout that provides a consistent header, footer, and responsive styling. The `{{{body}}}` triple-brace expression renders the inner template's HTML without escaping.

```handlebars
{{!-- src/infrastructure/notification/templates/layouts/base.hbs --}}

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }

    /* Base styles */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
      color: #333333;
      line-height: 1.6;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background: #ffffff;
      padding: 32px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .header {
      padding: 0 0 16px 0;
      border-bottom: 2px solid #1976d2;
      margin-bottom: 24px;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      color: #1976d2;
    }
    .content {
      padding: 0;
    }
    .footer {
      padding: 16px 0 0 0;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
      color: #999999;
      margin-top: 32px;
      text-align: center;
    }
    .footer a {
      color: #999999;
      text-decoration: underline;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background-color: #1976d2;
      color: #ffffff;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 600;
      margin: 16px 0;
    }
    .btn:hover {
      background-color: #1565c0;
    }
    .muted {
      color: #999999;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Community Social Network</h1>
      </div>
      <div class="content">
        {{{body}}}
      </div>
      <div class="footer">
        {{> unsubscribe-footer}}
      </div>
    </div>
  </div>
</body>
</html>
```

#### Unsubscribe Footer Partial

```handlebars
{{!-- src/infrastructure/notification/templates/partials/unsubscribe-footer.hbs --}}

<p>
  {{#if unsubscribeUrl}}
    <a href="{{unsubscribeUrl}}">Unsubscribe from these emails</a> &middot;
  {{/if}}
  <a href="{{preferencesUrl}}">Manage notification preferences</a>
</p>
<p class="muted">
  Community Social Network &middot; You are receiving this email because
  {{#if isTransactional}}
    it relates to your account security or a service you use.
  {{else}}
    you opted in to {{categoryLabel}} notifications.
  {{/if}}
</p>
```

#### Button Partial

```handlebars
{{!-- src/infrastructure/notification/templates/partials/button.hbs --}}

<a href="{{href}}" class="btn" style="color: #ffffff;">{{label}}</a>
```

#### Template Rendering Service

The `TemplateRenderer` compiles Handlebars templates once and caches the compiled functions in a `Map`. Partials are registered globally at construction time. Both HTML and plain-text variants are rendered for every email.

```typescript
// src/infrastructure/notification/email/TemplateRenderer.ts

import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Logger } from '@nestjs/common';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class TemplateRenderer implements OnModuleInit {
  private readonly logger = new Logger(TemplateRenderer.name);
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private baseHtmlLayout!: HandlebarsTemplateDelegate;
  private baseTextLayout!: HandlebarsTemplateDelegate;

  constructor(private readonly templateDir: string) {}

  onModuleInit(): void {
    this.registerPartials();
    this.baseHtmlLayout = this.compile('layouts/base.hbs');
    this.baseTextLayout = this.compile('layouts/base.txt.hbs');
    this.logger.log(`Template renderer initialized from ${this.templateDir}`);
  }

  render(templateName: string, data: Record<string, unknown>): RenderedEmail {
    const htmlTemplate = this.compile(`${templateName}.hbs`);
    const textTemplate = this.compile(`${templateName}.txt.hbs`);

    const htmlBody = htmlTemplate(data);
    const textBody = textTemplate(data);

    return {
      subject: data.subject as string,
      html: this.baseHtmlLayout({ ...data, body: htmlBody }),
      text: this.baseTextLayout({ ...data, body: textBody }),
    };
  }

  private registerPartials(): void {
    const partialsDir = path.join(this.templateDir, 'partials');

    if (!fs.existsSync(partialsDir)) {
      this.logger.warn(`Partials directory not found: ${partialsDir}`);
      return;
    }

    const partialFiles = fs.readdirSync(partialsDir)
      .filter((f) => f.endsWith('.hbs'));

    for (const file of partialFiles) {
      const partialName = path.basename(file, '.hbs');
      const partialSource = fs.readFileSync(
        path.join(partialsDir, file),
        'utf-8',
      );
      Handlebars.registerPartial(partialName, partialSource);
      this.logger.debug(`Registered partial: ${partialName}`);
    }
  }

  private compile(relativePath: string): HandlebarsTemplateDelegate {
    const cached = this.compiledTemplates.get(relativePath);
    if (cached) {
      return cached;
    }

    const fullPath = path.join(this.templateDir, relativePath);
    const source = fs.readFileSync(fullPath, 'utf-8');
    const compiled = Handlebars.compile(source);

    this.compiledTemplates.set(relativePath, compiled);
    return compiled;
  }
}
```

---

### 3. Queue Architecture

Email delivery uses a **dedicated Bull Queue** named `email-delivery`, separate from the general `integration-events` queue defined in ADR-009. This separation ensures that email processing throughput and retry policies do not interfere with other event consumers, and allows independent scaling of email workers.

#### Priority Levels

| Priority | Numeric Value | Category | Examples |
|----------|--------------|----------|----------|
| Critical | 1 | Auth, Admin (transactional) | Email verification, password reset, account suspended |
| High | 2 | Auth (informational) | Password changed, new device login |
| Medium | 3 | Social, Content, Community | New follower, mention, comment, group invitation |
| Low | 4 | Digest | Weekly digest, reaction notifications |

Higher-priority jobs are always dequeued before lower-priority jobs. A verification email (priority 1) will be processed before a weekly digest email (priority 4), even if the digest was enqueued first.

#### Rate Limiting

AWS SES imposes a sending rate limit. New SES accounts start at 1 email/second and can request increases. We configure the queue rate limiter to 14 emails/second, matching a typical early-production SES sending rate. This value is configurable via environment variable and should be increased as the SES sending rate is raised through support tickets.

#### Retry Strategy

Failed email sends are retried with a fixed exponential backoff schedule:

| Attempt | Delay | Cumulative Wait |
|---------|-------|----------------|
| 1st retry | 30 seconds | 30 seconds |
| 2nd retry | 2 minutes | 2 minutes 30 seconds |
| 3rd retry | 10 minutes | 12 minutes 30 seconds |

After 3 failed attempts, the job is moved to the Dead Letter Queue (DLQ) for manual inspection. This aligns with the DLQ strategy defined in ADR-009.

#### Queue Configuration

```typescript
// src/infrastructure/notification/email/EmailQueue.ts

import Queue from 'bull';
import { ConfigService } from '@nestjs/config';

export interface EmailJobData {
  to: string;
  recipientId: string;
  emailType: string;
  templateName: string;
  templateData: Record<string, unknown>;
  category: 'auth' | 'social' | 'content' | 'community' | 'admin';
  correlationId: string;
  isTransactional: boolean;
}

export const EMAIL_PRIORITY = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
} as const;

export type EmailPriorityLevel = typeof EMAIL_PRIORITY[keyof typeof EMAIL_PRIORITY];

/**
 * Retry delays in milliseconds for each attempt.
 * Attempt 1: 30 seconds
 * Attempt 2: 2 minutes (120,000ms)
 * Attempt 3: 10 minutes (600,000ms)
 */
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000];

export function createEmailQueue(config: ConfigService): Queue.Queue<EmailJobData> {
  const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
  const rateLimit = config.get<number>('EMAIL_RATE_LIMIT_PER_SECOND', 14);

  return new Queue<EmailJobData>('email-delivery', redisUrl, {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'custom',
      },
      removeOnComplete: {
        count: 1000,   // Keep last 1000 completed jobs for auditing
      },
      removeOnFail: false,  // Keep failed jobs for DLQ inspection
    },
    settings: {
      backoffStrategies: {
        custom(attemptsMade: number): number {
          // attemptsMade is 1-indexed: 1st retry, 2nd retry, 3rd retry
          const index = Math.min(attemptsMade - 1, RETRY_DELAYS_MS.length - 1);
          return RETRY_DELAYS_MS[index];
        },
      },
      maxStalledCount: 2,
      stalledInterval: 30_000,
    },
    limiter: {
      max: rateLimit,
      duration: 1000,  // per second
    },
  });
}
```

#### Queue Configuration Summary

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Queue name | `email-delivery` | Dedicated queue, separate from `integration-events` (ADR-009) |
| Max attempts | 3 | Sufficient retries for transient SMTP failures without excessive delay |
| Retry delays | 30s, 2min, 10min | Progressive backoff avoids overwhelming SMTP during outages |
| Rate limit | 14 emails/second | Matches typical early-production SES sending rate; configurable via env |
| Priority levels | 1 (critical) through 4 (low) | Verification/reset emails always processed first |
| Stalled job detection | 2 occurrences / 30s interval | Detects stuck workers; re-queues stalled jobs |
| Failed job retention | Permanent | Failed jobs remain for DLQ inspection and replay |
| Completed job retention | Last 1,000 | Sufficient for recent delivery auditing |

---

### 4. Transport Configuration

The SMTP transport is selected based on the deployment environment. This factory pattern ensures that no code changes are needed when switching between environments.

| Environment | Transport | Auth | Notes |
|-------------|-----------|------|-------|
| Production | AWS SES via SMTP | IAM SMTP credentials | Full sending capability, production domain verified |
| Staging | AWS SES sandbox | IAM SMTP credentials | Only verified email addresses can receive emails |
| Development | Ethereal (fake SMTP) | Auto-generated credentials | Captures all emails at ethereal.email for browser inspection |

#### Nodemailer Transport Factory

```typescript
// src/infrastructure/notification/email/TransportFactory.ts

import * as nodemailer from 'nodemailer';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmtpTransportConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

@Injectable()
export class TransportFactory implements OnModuleInit {
  private readonly logger = new Logger(TransportFactory.name);
  private transporter!: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const env = this.config.get<string>('NODE_ENV', 'development');
    const transportConfig = await this.createTransportConfig(env);
    this.transporter = nodemailer.createTransport(transportConfig);

    // Verify SMTP connection on startup
    try {
      await this.transporter.verify();
      this.logger.log(`SMTP transport verified for environment: ${env}`);
    } catch (error) {
      this.logger.error(
        `SMTP transport verification failed: ${(error as Error).message}`,
      );
      // Do not throw -- allow the application to start.
      // Failed sends will be retried via Bull Queue.
    }
  }

  getTransporter(): nodemailer.Transporter {
    return this.transporter;
  }

  private async createTransportConfig(
    env: string,
  ): Promise<SmtpTransportConfig> {
    switch (env) {
      case 'production':
      case 'staging':
        return this.createSesTransportConfig();

      case 'test':
        // In test, use a JSON transport that captures messages in memory
        return {
          host: 'localhost',
          port: 2525,
          secure: false,
        };

      default:
        return this.createEtherealTransportConfig();
    }
  }

  /**
   * Production and staging: AWS SES via SMTP interface.
   *
   * SES SMTP credentials are IAM-derived and configured via environment
   * variables. In staging, SES operates in sandbox mode: only verified
   * email addresses can receive messages.
   */
  private createSesTransportConfig(): SmtpTransportConfig {
    const host = this.config.getOrThrow<string>('SES_SMTP_HOST');
    const user = this.config.getOrThrow<string>('SES_SMTP_USER');
    const pass = this.config.getOrThrow<string>('SES_SMTP_PASS');

    return {
      host,
      port: 465,
      secure: true,
      auth: { user, pass },
    };
  }

  /**
   * Development: Ethereal fake SMTP.
   *
   * Ethereal provides throwaway SMTP credentials and a web interface
   * at https://ethereal.email where developers can inspect sent emails
   * without any emails actually being delivered.
   *
   * If ETHEREAL_USER and ETHEREAL_PASS are set in the environment,
   * those credentials are used. Otherwise, a new Ethereal test account
   * is created on startup.
   */
  private async createEtherealTransportConfig(): Promise<SmtpTransportConfig> {
    const existingUser = this.config.get<string>('ETHEREAL_USER');
    const existingPass = this.config.get<string>('ETHEREAL_PASS');

    if (existingUser && existingPass) {
      this.logger.log('Using existing Ethereal credentials');
      return {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: existingUser, pass: existingPass },
      };
    }

    // Create a new Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    this.logger.log(
      `Ethereal test account created: ${testAccount.user}`,
    );
    this.logger.log(
      `View sent emails at: https://ethereal.email/login`,
    );

    return {
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    };
  }
}
```

---

### 5. Email Sending Service

The `EmailService` is the primary injectable interface for the rest of the application. Other bounded contexts do not interact with Bull Queue, Nodemailer, or Handlebars directly. They call `sendEmail(type, recipient, data)` and the service handles template resolution, preference checking, and queue submission.

```typescript
// src/infrastructure/notification/email/EmailService.ts

import { Injectable, Logger } from '@nestjs/common';
import Queue from 'bull';
import { EmailJobData, EMAIL_PRIORITY, EmailPriorityLevel } from './EmailQueue';
import { EmailPreferenceService } from './EmailPreferenceService';
import { requestContextStorage } from '../../observability/tracing/CorrelationIdMiddleware';
import { emailQueuedTotal } from './EmailMetrics';

export interface EmailRecipient {
  id: string;
  email: string;
  displayName: string;
}

/**
 * Email type registry. Maps each email type to its template path,
 * category, priority, and whether it is transactional (cannot be disabled).
 */
const EMAIL_TYPE_REGISTRY: Record<
  string,
  {
    templateName: string;
    category: EmailJobData['category'];
    priority: EmailPriorityLevel;
    isTransactional: boolean;
    defaultSubject: string;
  }
> = {
  // Auth
  'email-verification': {
    templateName: 'auth/email-verification',
    category: 'auth',
    priority: EMAIL_PRIORITY.CRITICAL,
    isTransactional: true,
    defaultSubject: 'Verify your email address',
  },
  'password-reset': {
    templateName: 'auth/password-reset',
    category: 'auth',
    priority: EMAIL_PRIORITY.CRITICAL,
    isTransactional: true,
    defaultSubject: 'Reset your password',
  },
  'password-changed': {
    templateName: 'auth/password-changed',
    category: 'auth',
    priority: EMAIL_PRIORITY.HIGH,
    isTransactional: true,
    defaultSubject: 'Your password has been changed',
  },
  'new-device-login': {
    templateName: 'auth/new-device-login',
    category: 'auth',
    priority: EMAIL_PRIORITY.HIGH,
    isTransactional: true,
    defaultSubject: 'New sign-in to your account',
  },

  // Social
  'new-follower': {
    templateName: 'social/new-follower',
    category: 'social',
    priority: EMAIL_PRIORITY.MEDIUM,
    isTransactional: false,
    defaultSubject: 'You have a new follower',
  },
  'mention-notification': {
    templateName: 'social/mention-notification',
    category: 'social',
    priority: EMAIL_PRIORITY.MEDIUM,
    isTransactional: false,
    defaultSubject: 'You were mentioned in a post',
  },

  // Content
  'comment-on-post': {
    templateName: 'content/comment-on-post',
    category: 'content',
    priority: EMAIL_PRIORITY.MEDIUM,
    isTransactional: false,
    defaultSubject: 'Someone commented on your post',
  },
  'reaction-to-post': {
    templateName: 'content/reaction-to-post',
    category: 'content',
    priority: EMAIL_PRIORITY.LOW,
    isTransactional: false,
    defaultSubject: 'Someone reacted to your post',
  },

  // Community
  'group-invitation': {
    templateName: 'community/group-invitation',
    category: 'community',
    priority: EMAIL_PRIORITY.MEDIUM,
    isTransactional: false,
    defaultSubject: 'You have been invited to join a group',
  },
  'group-role-changed': {
    templateName: 'community/group-role-changed',
    category: 'community',
    priority: EMAIL_PRIORITY.MEDIUM,
    isTransactional: false,
    defaultSubject: 'Your role in a group has changed',
  },

  // Admin
  'account-suspended': {
    templateName: 'admin/account-suspended',
    category: 'admin',
    priority: EMAIL_PRIORITY.CRITICAL,
    isTransactional: true,
    defaultSubject: 'Your account has been suspended',
  },
  'weekly-digest': {
    templateName: 'admin/weekly-digest',
    category: 'admin',
    priority: EMAIL_PRIORITY.LOW,
    isTransactional: false,
    defaultSubject: 'Your weekly activity summary',
  },
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly emailQueue: Queue.Queue<EmailJobData>,
    private readonly preferenceService: EmailPreferenceService,
  ) {}

  /**
   * Send an email to a recipient.
   *
   * This method resolves the email type to a template, checks user
   * preferences for non-transactional emails, and enqueues the job
   * in the email-delivery Bull Queue.
   *
   * @param type - One of the registered email type keys
   * @param recipient - The target user with id, email, and displayName
   * @param data - Template-specific data (merged with base data)
   */
  async sendEmail(
    type: string,
    recipient: EmailRecipient,
    data: Record<string, unknown> = {},
  ): Promise<{ queued: boolean; reason?: string }> {
    const registration = EMAIL_TYPE_REGISTRY[type];
    if (!registration) {
      this.logger.error(`Unknown email type: ${type}`);
      throw new Error(`Unknown email type: ${type}`);
    }

    // Check suppression list first (applies to all email types)
    const isSuppressed = await this.preferenceService.isEmailSuppressed(
      recipient.id,
      recipient.email,
    );
    if (isSuppressed) {
      this.logger.debug(
        `Email suppressed for recipient ${recipient.id} (${type})`,
      );
      return { queued: false, reason: 'address_suppressed' };
    }

    // Check user preferences for non-transactional emails
    if (!registration.isTransactional) {
      const canSend = await this.preferenceService.canSendEmail(
        recipient.id,
        registration.category,
      );
      if (!canSend) {
        this.logger.debug(
          `Email preference disabled for recipient ${recipient.id}, ` +
          `category ${registration.category} (${type})`,
        );
        return { queued: false, reason: 'user_preference' };
      }
    }

    // Build the job payload
    const context = requestContextStorage.getStore();
    const correlationId = context?.requestId || crypto.randomUUID();

    const baseUrl = process.env.APP_BASE_URL || 'https://community.example.com';
    const preferencesUrl = `${baseUrl}/settings/notifications`;

    const unsubscribeToken = await this.preferenceService
      .generateUnsubscribeToken(recipient.id, registration.category);

    const unsubscribeUrl = registration.isTransactional
      ? undefined
      : `${baseUrl}/api/v1/email/unsubscribe` +
        `?uid=${recipient.id}` +
        `&cat=${registration.category}` +
        `&token=${unsubscribeToken}`;

    const jobData: EmailJobData = {
      to: recipient.email,
      recipientId: recipient.id,
      emailType: type,
      templateName: registration.templateName,
      templateData: {
        subject: data.subject || registration.defaultSubject,
        recipientName: recipient.displayName,
        preferencesUrl,
        unsubscribeUrl,
        isTransactional: registration.isTransactional,
        categoryLabel: registration.category,
        ...data,
      },
      category: registration.category,
      correlationId,
      isTransactional: registration.isTransactional,
    };

    // Enqueue with the appropriate priority
    await this.emailQueue.add(type, jobData, {
      priority: registration.priority,
      jobId: `${type}-${recipient.id}-${correlationId}`,
    });

    // Increment queued metric
    emailQueuedTotal.inc({
      email_type: type,
      category: registration.category,
    });

    this.logger.log({
      message: 'Email queued',
      emailType: type,
      recipientId: recipient.id,
      category: registration.category,
      priority: registration.priority,
      correlationId,
    });

    return { queued: true };
  }
}
```

---

### 6. Email Worker

The email worker processes jobs from the `email-delivery` queue. It renders templates, sends via SMTP, logs the delivery outcome, and records Prometheus metrics.

```typescript
// src/infrastructure/notification/email/EmailWorker.ts

import Queue from 'bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TemplateRenderer } from './TemplateRenderer';
import { TransportFactory } from './TransportFactory';
import { EmailDeliveryLogService } from './EmailDeliveryLogService';
import { EmailJobData } from './EmailQueue';
import {
  emailSentTotal,
  emailDeliveryLatency,
  emailSendErrorsTotal,
} from './EmailMetrics';

@Injectable()
export class EmailWorker implements OnModuleInit {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(
    private readonly emailQueue: Queue.Queue<EmailJobData>,
    private readonly renderer: TemplateRenderer,
    private readonly transportFactory: TransportFactory,
    private readonly deliveryLog: EmailDeliveryLogService,
  ) {}

  onModuleInit(): void {
    this.registerProcessor();
    this.registerEventHandlers();
    this.logger.log('Email worker registered and processing');
  }

  private registerProcessor(): void {
    this.emailQueue.process(async (job: Queue.Job<EmailJobData>) => {
      const startTime = Date.now();
      const {
        to,
        recipientId,
        emailType,
        templateName,
        templateData,
        category,
        correlationId,
        isTransactional,
      } = job.data;

      this.logger.log({
        message: 'Processing email job',
        jobId: job.id,
        emailType,
        recipientId,
        correlationId,
        attempt: job.attemptsMade + 1,
      });

      // 1. Render template
      const rendered = this.renderer.render(templateName, templateData);

      // 2. Build headers
      const headers: Record<string, string> = {
        'X-Correlation-Id': correlationId,
        'X-Email-Category': category,
        'X-Email-Type': emailType,
      };

      // Add RFC 8058 one-click unsubscribe for non-transactional emails
      if (!isTransactional && templateData.unsubscribeUrl) {
        headers['List-Unsubscribe'] =
          `<${templateData.unsubscribeUrl}>`;
        headers['List-Unsubscribe-Post'] =
          'List-Unsubscribe=One-Click';
      }

      // 3. Send email via SMTP
      const fromAddress =
        process.env.EMAIL_FROM_ADDRESS || 'noreply@mail.community.example.com';
      const fromName =
        process.env.EMAIL_FROM_NAME || 'Community Social Network';

      const transporter = this.transportFactory.getTransporter();
      const result = await transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers,
      });

      const durationMs = Date.now() - startTime;

      // 4. Log delivery
      await this.deliveryLog.recordSent({
        recipientId,
        correlationId,
        emailType,
        templateName,
        messageId: result.messageId,
        category,
        sentAt: new Date(),
      });

      // 5. Record metrics
      emailSentTotal.inc({
        email_type: emailType,
        status: 'sent',
      });
      emailDeliveryLatency.observe(
        { email_type: emailType },
        durationMs / 1000,
      );

      this.logger.log({
        message: 'Email sent successfully',
        jobId: job.id,
        emailType,
        recipientId,
        messageId: result.messageId,
        correlationId,
        durationMs,
      });

      return {
        status: 'sent',
        messageId: result.messageId,
        durationMs,
      };
    });
  }

  private registerEventHandlers(): void {
    this.emailQueue.on('failed', (job, error) => {
      this.logger.error({
        message: 'Email job failed',
        jobId: job.id,
        emailType: job.data.emailType,
        recipientId: job.data.recipientId,
        correlationId: job.data.correlationId,
        attempt: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        error: error.message,
      });

      emailSendErrorsTotal.inc({
        email_type: job.data.emailType,
        error_type: this.classifyError(error),
      });

      // If all retries are exhausted, log to DLQ
      if (job.attemptsMade >= (job.opts.attempts || 3)) {
        this.deliveryLog.recordFailed({
          recipientId: job.data.recipientId,
          correlationId: job.data.correlationId,
          emailType: job.data.emailType,
          templateName: job.data.templateName,
          category: job.data.category,
          error: error.message,
          failedAt: new Date(),
        });
      }
    });

    this.emailQueue.on('stalled', (jobId) => {
      this.logger.warn({
        message: 'Email job stalled',
        jobId,
      });
    });
  }

  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('connection')) return 'connection';
    if (message.includes('auth')) return 'authentication';
    if (message.includes('rate') || message.includes('throttl'))
      return 'rate_limit';
    return 'unknown';
  }
}
```

---

### 7. GDPR Compliance

Email delivery must comply with GDPR (ADR-013), CAN-SPAM Act, and RFC 8058. The following rules govern every email sent by the platform.

#### Transactional vs Marketing Classification

| Classification | GDPR Basis | Unsubscribe Required | Examples |
|---------------|-----------|---------------------|----------|
| Transactional | Contractual necessity | No | Verification, password reset, security alerts |
| Marketing/Engagement | Consent | Yes (RFC 8058 + footer link) | Follower, mention, comment, digest |

#### RFC 8058 One-Click Unsubscribe

Every non-transactional email includes two headers that enable one-click unsubscribe directly from email clients (Gmail, Apple Mail, Outlook):

```
List-Unsubscribe: <https://api.example.com/api/v1/email/unsubscribe?uid=USR_ID&cat=CATEGORY&token=TOKEN>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

The `List-Unsubscribe-Post` header tells the email client to issue a POST request to the URL, which immediately disables that email category for the user. No confirmation page or additional clicks are required.

#### Per-Category Email Preferences

Users can control email delivery per category via their notification settings (ADR-007 Preference aggregate). The following frequencies are available:

| Category | Available Frequencies | Default |
|----------|----------------------|---------|
| Social | `immediate`, `daily_digest`, `disabled` | `immediate` |
| Content | `immediate`, `daily_digest`, `disabled` | `immediate` |
| Community | `immediate`, `daily_digest`, `disabled` | `immediate` |
| Admin (digest) | `weekly`, `disabled` | `weekly` |

Transactional emails (auth, security, suspension) are always `immediate` and cannot be changed.

#### Consent Tracking

When a user enables `email_notifications` consent (ADR-013 consent management), a record is created in the `consent_records` table. The email service checks this consent before sending any non-transactional email. If consent has been withdrawn, the email is not queued.

---

### 8. Bounce and Complaint Handling

AWS SES publishes bounce and complaint notifications to an SNS topic, which forwards them to an API endpoint via HTTPS subscription. Proper bounce and complaint handling is critical for maintaining sender reputation and avoiding SES account suspension.

#### Bounce/Complaint Flow

```
+---------------------------------------------------------------------------+
|                     Bounce/Complaint Flow                                 |
+---------------------------------------------------------------------------+

  SES sends email
       |
       v
  Recipient mail server
       |
       +--- Delivery success --> SES notification --> SNS --> API webhook
       |                                                      (update log: delivered)
       |
       +--- Soft bounce ------> SES notification --> SNS --> API webhook
       |    (temporary failure)                               (update log: soft_bounce)
       |                                                      (no suppression)
       |
       +--- Hard bounce ------> SES notification --> SNS --> API webhook
       |    (permanent failure)                               (update log: hard_bounce)
       |                                                      (ADD to suppression list)
       |
       +--- Complaint --------> SES notification --> SNS --> API webhook
            (marked as spam)                                  (update log: complained)
                                                              (auto-unsubscribe user)
                                                              (ADD to suppression list)
```

#### SES Webhook Controller

```typescript
// src/infrastructure/notification/email/SesWebhookController.ts

import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailDeliveryLogService } from './EmailDeliveryLogService';
import { EmailPreferenceService } from './EmailPreferenceService';
import {
  emailBounceTotal,
  emailComplaintTotal,
  emailDeliveredTotal,
} from './EmailMetrics';

interface SnsNotification {
  Type: string;
  Message: string;
  MessageId: string;
  TopicArn: string;
  SubscribeURL?: string;
}

interface SesMessage {
  notificationType: 'Delivery' | 'Bounce' | 'Complaint';
  mail: {
    messageId: string;
    commonHeaders: { subject: string };
    headers: Array<{ name: string; value: string }>;
  };
  delivery?: {
    timestamp: string;
    recipients: string[];
  };
  bounce?: {
    bounceType: 'Permanent' | 'Transient';
    bounceSubType: string;
    bouncedRecipients: Array<{
      emailAddress: string;
      status: string;
      diagnosticCode: string;
    }>;
    timestamp: string;
  };
  complaint?: {
    complainedRecipients: Array<{ emailAddress: string }>;
    complaintFeedbackType: string;
    timestamp: string;
  };
}

@Controller('api/v1/webhooks/ses')
export class SesWebhookController {
  private readonly logger = new Logger(SesWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly deliveryLog: EmailDeliveryLogService,
    private readonly preferenceService: EmailPreferenceService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleNotification(
    @Body() notification: SnsNotification,
    @Headers('x-amz-sns-topic-arn') topicArn: string,
  ): Promise<{ status: string }> {
    this.validateTopicArn(topicArn);

    // Handle SNS subscription confirmation
    if (notification.Type === 'SubscriptionConfirmation') {
      this.logger.log(
        'SNS subscription confirmation received. ' +
        `Confirm URL: ${notification.SubscribeURL}`,
      );
      return { status: 'subscription_confirmation_received' };
    }

    if (notification.Type !== 'Notification') {
      return { status: 'ignored' };
    }

    const message: SesMessage = JSON.parse(notification.Message);
    const correlationId = this.extractHeader(
      message.mail.headers,
      'X-Correlation-Id',
    );
    const emailType = this.extractHeader(
      message.mail.headers,
      'X-Email-Type',
    );

    switch (message.notificationType) {
      case 'Delivery':
        await this.handleDelivery(message, correlationId);
        break;

      case 'Bounce':
        await this.handleBounce(message, correlationId, emailType);
        break;

      case 'Complaint':
        await this.handleComplaint(message, correlationId, emailType);
        break;
    }

    return { status: 'processed' };
  }

  private async handleDelivery(
    message: SesMessage,
    correlationId: string,
  ): Promise<void> {
    if (!message.delivery) return;

    await this.deliveryLog.recordDelivered({
      messageId: message.mail.messageId,
      correlationId,
      deliveredAt: new Date(message.delivery.timestamp),
      recipients: message.delivery.recipients,
    });

    emailDeliveredTotal.inc();

    this.logger.log({
      message: 'Email delivered',
      sesMessageId: message.mail.messageId,
      correlationId,
      recipients: message.delivery.recipients,
    });
  }

  private async handleBounce(
    message: SesMessage,
    correlationId: string,
    emailType: string,
  ): Promise<void> {
    if (!message.bounce) return;

    const isHardBounce = message.bounce.bounceType === 'Permanent';
    const bounceType = isHardBounce ? 'hard_bounce' : 'soft_bounce';

    for (const recipient of message.bounce.bouncedRecipients) {
      await this.deliveryLog.recordBounced({
        messageId: message.mail.messageId,
        correlationId,
        emailAddress: recipient.emailAddress,
        bounceType,
        bounceSubType: message.bounce.bounceSubType,
        diagnosticCode: recipient.diagnosticCode,
        bouncedAt: new Date(message.bounce.timestamp),
      });

      emailBounceTotal.inc({
        bounce_type: bounceType,
        email_type: emailType || 'unknown',
      });

      // Hard bounces: add to suppression list to protect sender reputation
      if (isHardBounce) {
        await this.preferenceService.suppressEmailAddress(
          recipient.emailAddress,
          'hard_bounce',
        );

        this.logger.warn({
          message: 'Hard bounce -- address suppressed',
          emailAddress: recipient.emailAddress,
          diagnosticCode: recipient.diagnosticCode,
          correlationId,
        });
      } else {
        this.logger.log({
          message: 'Soft bounce recorded',
          emailAddress: recipient.emailAddress,
          bounceSubType: message.bounce.bounceSubType,
          correlationId,
        });
      }
    }
  }

  private async handleComplaint(
    message: SesMessage,
    correlationId: string,
    emailType: string,
  ): Promise<void> {
    if (!message.complaint) return;

    for (const recipient of message.complaint.complainedRecipients) {
      await this.deliveryLog.recordComplaint({
        messageId: message.mail.messageId,
        correlationId,
        emailAddress: recipient.emailAddress,
        feedbackType: message.complaint.complaintFeedbackType,
        complaintAt: new Date(message.complaint.timestamp),
      });

      emailComplaintTotal.inc({
        feedback_type: message.complaint.complaintFeedbackType || 'unknown',
        email_type: emailType || 'unknown',
      });

      // Auto-unsubscribe from all non-transactional emails
      await this.preferenceService.unsubscribeFromAllByEmail(
        recipient.emailAddress,
      );

      // Add to suppression list
      await this.preferenceService.suppressEmailAddress(
        recipient.emailAddress,
        'complaint',
      );

      this.logger.warn({
        message: 'Spam complaint -- user unsubscribed and address suppressed',
        emailAddress: recipient.emailAddress,
        feedbackType: message.complaint.complaintFeedbackType,
        correlationId,
      });
    }
  }

  private validateTopicArn(topicArn: string): void {
    const expectedArn = this.config.get<string>('SES_SNS_TOPIC_ARN');
    if (!expectedArn) {
      this.logger.warn('SES_SNS_TOPIC_ARN not configured; skipping validation');
      return;
    }
    if (topicArn !== expectedArn) {
      throw new ForbiddenException('Invalid SNS topic ARN');
    }
  }

  private extractHeader(
    headers: Array<{ name: string; value: string }>,
    name: string,
  ): string {
    const header = headers?.find(
      (h) => h.name.toLowerCase() === name.toLowerCase(),
    );
    return header?.value || '';
  }
}
```

#### Suppression List Rules

| Trigger | Action | Reversible |
|---------|--------|-----------|
| Hard bounce | Add email address to suppression list | Manual removal by admin only |
| Spam complaint | Add email address to suppression list + unsubscribe from all | Manual removal by admin only |
| Soft bounce | Log only, no suppression | N/A |
| Admin manual suppression | Add to suppression list | Admin removal |

#### Complaint Rate Monitoring

AWS SES suspends sending privileges if the complaint rate exceeds 0.1% or the bounce rate exceeds 5%. The system must stay well below these thresholds.

| Metric | Warning Threshold | Action at Warning | Critical Threshold | Action at Critical |
|--------|------------------|-------------------|-------------------|-------------------|
| Bounce rate (24h) | > 3% | Alert ops team via Slack | > 5% | Pause non-transactional sending |
| Complaint rate (24h) | > 0.05% | Alert ops team via Slack | > 0.1% | Pause non-transactional sending |

---

### 9. Database Schema

#### Email Delivery Log

Tracks every email through its lifecycle from queuing through delivery, bounce, or complaint.

```sql
-- Email delivery log table
CREATE TABLE email_delivery_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id    UUID NOT NULL,
    recipient_email VARCHAR(320) NOT NULL,
    correlation_id  VARCHAR(255) NOT NULL,
    email_type      VARCHAR(100) NOT NULL,
    template_name   VARCHAR(100) NOT NULL,
    message_id      VARCHAR(255),
    category        VARCHAR(20) NOT NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'queued',
    -- Timestamps for lifecycle tracking
    queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    bounced_at      TIMESTAMPTZ,
    bounce_type     VARCHAR(20),
    bounce_sub_type VARCHAR(50),
    diagnostic_code TEXT,
    complaint_at    TIMESTAMPTZ,
    complaint_type  VARCHAR(50),
    failed_at       TIMESTAMPTZ,
    failure_reason  TEXT,
    -- Metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: lookup by recipient for preference management and user data export
CREATE INDEX idx_email_log_recipient
    ON email_delivery_log(recipient_id);

-- Index: lookup by status for monitoring dashboards
CREATE INDEX idx_email_log_status
    ON email_delivery_log(status);

-- Index: lookup by SES message ID for webhook processing
CREATE INDEX idx_email_log_message_id
    ON email_delivery_log(message_id)
    WHERE message_id IS NOT NULL;

-- Index: time-range queries for metrics and retention
CREATE INDEX idx_email_log_created
    ON email_delivery_log(created_at);

-- Index: correlation ID for distributed tracing (ADR-012)
CREATE INDEX idx_email_log_correlation
    ON email_delivery_log(correlation_id);

-- Partition by month for retention management (same pattern as
-- notifications table from ADR-007)
-- CREATE TABLE email_delivery_log ... PARTITION BY RANGE (created_at);
-- Partitions created by monthly cron job
```

#### Email Suppression List

Stores email addresses that must not receive any email, due to hard bounces or complaints.

```sql
-- Email suppression list
CREATE TABLE email_suppression_list (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_address   VARCHAR(320) NOT NULL,
    recipient_id    UUID,
    reason          VARCHAR(50) NOT NULL,  -- 'hard_bounce', 'complaint', 'manual'
    source_message_id VARCHAR(255),
    suppressed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at      TIMESTAMPTZ,
    removed_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_suppression_email UNIQUE (email_address)
        WHERE removed_at IS NULL
);

-- Index: fast lookup during send checks
CREATE INDEX idx_suppression_email_active
    ON email_suppression_list(email_address)
    WHERE removed_at IS NULL;

-- Index: lookup by recipient for data export (ADR-013)
CREATE INDEX idx_suppression_recipient
    ON email_suppression_list(recipient_id)
    WHERE recipient_id IS NOT NULL;
```

#### Email Notification Preferences

Per-user, per-category email frequency settings. This table extends the `notification_preferences` concept from ADR-007 with email-specific frequency options.

```sql
-- Email notification preferences
CREATE TABLE email_notification_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category        VARCHAR(30) NOT NULL,
    frequency       VARCHAR(20) NOT NULL DEFAULT 'immediate',
    -- frequency: 'immediate' | 'daily_digest' | 'weekly' | 'disabled'
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_email_pref_user_category UNIQUE (user_id, category)
);

-- Index: fast lookup during email send checks
CREATE INDEX idx_email_pref_user
    ON email_notification_preferences(user_id);
```

#### Delivery Status Transitions

```
queued --> sent --> delivered
                       |
queued --> sent --> bounced (soft_bounce | hard_bounce)
                       |
queued --> sent --> complained
                       |
queued --> skipped_preference
                       |
queued --> skipped_suppressed
                       |
queued --> failed (after 3 retry attempts)
```

---

### 10. Email Preference Entity

```typescript
// src/domain/notification/entities/EmailPreference.ts

export type EmailFrequency = 'immediate' | 'daily_digest' | 'weekly' | 'disabled';

export type EmailCategory = 'social' | 'content' | 'community' | 'admin_digest';

/**
 * Represents a user's email notification preference for a specific category.
 *
 * Transactional emails (auth, security) are not represented here because
 * they cannot be disabled. This entity only covers categories that the
 * user can control.
 */
export class EmailPreference {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly category: EmailCategory,
    private _frequency: EmailFrequency,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  get frequency(): EmailFrequency {
    return this._frequency;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Update the frequency for this category.
   * Validates that the frequency is allowed for the category.
   */
  updateFrequency(newFrequency: EmailFrequency): void {
    const allowedFrequencies = this.getAllowedFrequencies();
    if (!allowedFrequencies.includes(newFrequency)) {
      throw new Error(
        `Frequency '${newFrequency}' is not allowed for category ` +
        `'${this.category}'. Allowed: ${allowedFrequencies.join(', ')}`,
      );
    }

    this._frequency = newFrequency;
    this._updatedAt = new Date();
  }

  /**
   * Whether emails should be sent immediately for this category.
   */
  isImmediate(): boolean {
    return this._frequency === 'immediate';
  }

  /**
   * Whether the user has disabled emails for this category.
   */
  isDisabled(): boolean {
    return this._frequency === 'disabled';
  }

  /**
   * Returns the list of allowed frequencies for this category.
   */
  private getAllowedFrequencies(): EmailFrequency[] {
    if (this.category === 'admin_digest') {
      return ['weekly', 'disabled'];
    }
    return ['immediate', 'daily_digest', 'disabled'];
  }

  /**
   * Factory: create a default preference for a new user.
   */
  static createDefault(
    id: string,
    userId: string,
    category: EmailCategory,
  ): EmailPreference {
    const defaultFrequency: EmailFrequency =
      category === 'admin_digest' ? 'weekly' : 'immediate';

    return new EmailPreference(
      id,
      userId,
      category,
      defaultFrequency,
      new Date(),
      new Date(),
    );
  }
}
```

#### Email Preference Service

```typescript
// src/infrastructure/notification/email/EmailPreferenceService.ts

import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailNotificationPreferenceEntity } from './entities/EmailNotificationPreferenceEntity';
import { EmailSuppressionEntity } from './entities/EmailSuppressionEntity';
import { UnsubscribeTokenService } from './UnsubscribeTokenService';

@Injectable()
export class EmailPreferenceService {
  private readonly logger = new Logger(EmailPreferenceService.name);

  constructor(
    @InjectRepository(EmailNotificationPreferenceEntity)
    private readonly preferenceRepository: Repository<EmailNotificationPreferenceEntity>,

    @InjectRepository(EmailSuppressionEntity)
    private readonly suppressionRepository: Repository<EmailSuppressionEntity>,

    private readonly tokenService: UnsubscribeTokenService,
  ) {}

  /**
   * Check if an email address is on the suppression list.
   * Suppressed addresses receive NO emails (including transactional).
   */
  async isEmailSuppressed(
    recipientId: string,
    emailAddress: string,
  ): Promise<boolean> {
    const suppression = await this.suppressionRepository.findOne({
      where: { emailAddress, removedAt: null as any },
    });
    return suppression !== null;
  }

  /**
   * Check if a non-transactional email can be sent for a given category.
   * Returns true if the user has not disabled the category.
   */
  async canSendEmail(
    recipientId: string,
    category: string,
  ): Promise<boolean> {
    const pref = await this.preferenceRepository.findOne({
      where: { userId: recipientId, category },
    });

    // Default: enabled (immediate)
    if (!pref) return true;

    return pref.frequency !== 'disabled';
  }

  /**
   * Add an email address to the suppression list.
   */
  async suppressEmailAddress(
    emailAddress: string,
    reason: 'hard_bounce' | 'complaint' | 'manual',
  ): Promise<void> {
    await this.suppressionRepository.upsert(
      {
        emailAddress,
        reason,
        suppressedAt: new Date(),
      },
      {
        conflictPaths: ['emailAddress'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    this.logger.warn({
      message: 'Email address suppressed',
      emailAddress,
      reason,
    });
  }

  /**
   * Unsubscribe a user from all non-transactional emails (by email address).
   * Used when processing spam complaints.
   */
  async unsubscribeFromAllByEmail(emailAddress: string): Promise<void> {
    // Look up user by email, then disable all categories
    // This is a cross-context query; in production, this would go
    // through an anti-corruption layer to the Identity context
    await this.preferenceRepository
      .createQueryBuilder()
      .update()
      .set({ frequency: 'disabled', updatedAt: new Date() })
      .where(
        'user_id IN (SELECT id FROM users WHERE email = :email)',
        { email: emailAddress },
      )
      .execute();
  }

  /**
   * Update a user's preference for a specific category.
   */
  async updatePreference(
    userId: string,
    category: string,
    frequency: string,
  ): Promise<void> {
    await this.preferenceRepository.upsert(
      {
        userId,
        category,
        frequency,
        updatedAt: new Date(),
      },
      {
        conflictPaths: ['userId', 'category'],
      },
    );
  }

  /**
   * Generate a signed token for one-click unsubscribe links.
   */
  async generateUnsubscribeToken(
    userId: string,
    category: string,
  ): Promise<string> {
    return this.tokenService.generate(userId, category);
  }
}
```

---

### 11. Unsubscribe Endpoints

```typescript
// src/infrastructure/notification/email/UnsubscribeController.ts

import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EmailPreferenceService } from './EmailPreferenceService';
import { UnsubscribeTokenService } from './UnsubscribeTokenService';

@Controller('api/v1/email')
export class UnsubscribeController {
  private readonly logger = new Logger(UnsubscribeController.name);

  constructor(
    private readonly preferenceService: EmailPreferenceService,
    private readonly tokenService: UnsubscribeTokenService,
  ) {}

  /**
   * RFC 8058 one-click unsubscribe (POST).
   *
   * Email clients (Gmail, Apple Mail) send a POST request to this
   * endpoint when the user clicks the unsubscribe button in the
   * email client UI. No user interaction beyond the single click
   * is required.
   */
  @Post('unsubscribe')
  @HttpCode(200)
  async oneClickUnsubscribe(
    @Query('uid') userId: string,
    @Query('cat') category: string,
    @Query('token') token: string,
  ): Promise<{ status: string }> {
    this.validateParams(userId, category, token);
    this.tokenService.verify(token, userId, category);

    await this.preferenceService.updatePreference(
      userId,
      category,
      'disabled',
    );

    this.logger.log({
      message: 'One-click unsubscribe processed',
      userId,
      category,
    });

    return { status: 'unsubscribed' };
  }

  /**
   * Browser-based unsubscribe (GET).
   *
   * The unsubscribe link in the email footer points to this endpoint.
   * It processes the unsubscribe and returns a confirmation page.
   */
  @Get('unsubscribe')
  async unsubscribePage(
    @Query('uid') userId: string,
    @Query('cat') category: string,
    @Query('token') token: string,
  ): Promise<string> {
    this.validateParams(userId, category, token);
    this.tokenService.verify(token, userId, category);

    await this.preferenceService.updatePreference(
      userId,
      category,
      'disabled',
    );

    this.logger.log({
      message: 'Browser unsubscribe processed',
      userId,
      category,
    });

    // Return a minimal HTML page confirming the unsubscribe
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="utf-8"><title>Unsubscribed</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 40px;">
        <h2>You have been unsubscribed</h2>
        <p>You will no longer receive ${category} emails from Community Social Network.</p>
        <p>You can re-enable notifications in your
          <a href="${process.env.APP_BASE_URL || ''}/settings/notifications">
            account settings
          </a>.
        </p>
      </body>
      </html>
    `;
  }

  private validateParams(
    userId: string,
    category: string,
    token: string,
  ): void {
    if (!userId || !category || !token) {
      throw new BadRequestException(
        'Missing required parameters: uid, cat, token',
      );
    }
  }
}
```

---

### 12. Monitoring and Metrics

All email metrics follow the `csn_` prefix convention established in ADR-012 and are exposed via the `/metrics` Prometheus endpoint.

#### Email Metrics Definition

```typescript
// src/infrastructure/notification/email/EmailMetrics.ts

import { Counter, Histogram, Gauge } from 'prom-client';

/**
 * Total emails queued for delivery, by type and category.
 */
export const emailQueuedTotal = new Counter({
  name: 'csn_email_queued_total',
  help: 'Total number of emails queued for delivery',
  labelNames: ['email_type', 'category'],
});

/**
 * Total emails sent (handed to SMTP transport), by type and status.
 * status: 'sent' (SMTP accepted)
 */
export const emailSentTotal = new Counter({
  name: 'csn_email_sent_total',
  help: 'Total number of emails sent via SMTP',
  labelNames: ['email_type', 'status'],
});

/**
 * Total emails confirmed delivered by SES.
 */
export const emailDeliveredTotal = new Counter({
  name: 'csn_email_delivered_total',
  help: 'Total number of emails confirmed delivered by SES',
});

/**
 * Email delivery latency from queue dequeue to SMTP handoff, in seconds.
 */
export const emailDeliveryLatency = new Histogram({
  name: 'csn_email_delivery_latency_seconds',
  help: 'Duration from queue dequeue to SMTP send completion in seconds',
  labelNames: ['email_type'],
  buckets: [0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0],
});

/**
 * Total bounces by bounce type and email type.
 */
export const emailBounceTotal = new Counter({
  name: 'csn_email_bounce_total',
  help: 'Total number of email bounces',
  labelNames: ['bounce_type', 'email_type'],
});

/**
 * Bounce rate as a gauge, computed over a 24-hour rolling window.
 * Updated by a periodic metrics collector.
 */
export const emailBounceRate = new Gauge({
  name: 'csn_email_bounce_rate',
  help: 'Email bounce rate over 24h rolling window (0-1)',
});

/**
 * Total spam complaints by feedback type and email type.
 */
export const emailComplaintTotal = new Counter({
  name: 'csn_email_complaint_total',
  help: 'Total number of spam complaints',
  labelNames: ['feedback_type', 'email_type'],
});

/**
 * Complaint rate as a gauge, computed over a 24-hour rolling window.
 * Updated by a periodic metrics collector.
 */
export const emailComplaintRate = new Gauge({
  name: 'csn_email_complaint_rate',
  help: 'Email complaint rate over 24h rolling window (0-1)',
});

/**
 * Current email queue depth by state.
 */
export const emailQueueDepth = new Gauge({
  name: 'csn_email_queue_depth',
  help: 'Current number of jobs in the email-delivery queue',
  labelNames: ['state'],  // waiting, active, delayed, failed
});

/**
 * Total send errors by email type and error classification.
 */
export const emailSendErrorsTotal = new Counter({
  name: 'csn_email_send_errors_total',
  help: 'Total number of email send errors',
  labelNames: ['email_type', 'error_type'],
});

/**
 * Emails skipped due to user preference or suppression.
 */
export const emailSkippedTotal = new Counter({
  name: 'csn_email_skipped_total',
  help: 'Total number of emails skipped',
  labelNames: ['email_type', 'reason'],
  // reason: 'user_preference', 'address_suppressed'
});
```

#### Metrics Catalog

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `csn_email_queued_total` | Counter | email_type, category | Emails queued for delivery |
| `csn_email_sent_total` | Counter | email_type, status | Emails handed to SMTP transport |
| `csn_email_delivered_total` | Counter | -- | Emails confirmed delivered by SES |
| `csn_email_delivery_latency_seconds` | Histogram | email_type | Time from dequeue to SMTP send |
| `csn_email_bounce_total` | Counter | bounce_type, email_type | Bounces received from SES |
| `csn_email_bounce_rate` | Gauge | -- | 24h rolling bounce rate |
| `csn_email_complaint_total` | Counter | feedback_type, email_type | Spam complaints from SES |
| `csn_email_complaint_rate` | Gauge | -- | 24h rolling complaint rate |
| `csn_email_queue_depth` | Gauge | state | Current queue depth |
| `csn_email_send_errors_total` | Counter | email_type, error_type | Send errors by classification |
| `csn_email_skipped_total` | Counter | email_type, reason | Emails skipped (preference/suppression) |

#### Alerting Rules

These rules extend the alerting configuration from ADR-012.

```yaml
# config/alerting/email-alert-rules.yml

groups:
  - name: csn_email_alerts
    rules:
      # Bounce rate warning
      - alert: EmailBounceRateWarning
        expr: csn_email_bounce_rate > 0.03
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Email bounce rate exceeds 3%"
          description: >
            Current bounce rate is {{ $value | humanizePercentage }}.
            SES suspends at 5%. Investigate bounce reasons in delivery log.
          runbook: "docs/runbooks/email-bounce-rate.md"

      # Bounce rate critical
      - alert: EmailBounceRateCritical
        expr: csn_email_bounce_rate > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Email bounce rate exceeds 5% -- SES suspension imminent"
          description: >
            Current bounce rate is {{ $value | humanizePercentage }}.
            Non-transactional sending should be paused immediately.
          runbook: "docs/runbooks/email-bounce-rate.md"

      # Complaint rate warning
      - alert: EmailComplaintRateWarning
        expr: csn_email_complaint_rate > 0.0005
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Email complaint rate exceeds 0.05%"
          description: >
            Current complaint rate is {{ $value | humanizePercentage }}.
            SES suspends at 0.1%. Review email content and targeting.

      # Complaint rate critical
      - alert: EmailComplaintRateCritical
        expr: csn_email_complaint_rate > 0.001
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Email complaint rate exceeds 0.1% -- SES suspension imminent"

      # Queue depth warning
      - alert: EmailQueueDepthWarning
        expr: csn_email_queue_depth{state="waiting"} > 500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Email queue has {{ $value }} waiting jobs"
          description: >
            High queue depth may indicate SMTP transport issues or
            rate limiting. Check SES sending rate and worker health.

      # Queue depth critical
      - alert: EmailQueueDepthCritical
        expr: csn_email_queue_depth{state="waiting"} > 1000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Email queue has {{ $value }} waiting jobs -- delivery delays likely"

      # Failed jobs accumulating
      - alert: EmailFailedJobsHigh
        expr: increase(csn_email_send_errors_total[1h]) > 20
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "More than 20 email send errors in the last hour"

      # Delivery latency
      - alert: EmailDeliveryLatencyHigh
        expr: >
          histogram_quantile(0.95,
            rate(csn_email_delivery_latency_seconds_bucket[5m])
          ) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Email delivery p95 latency exceeds 10 seconds"
```

#### Grafana Dashboard Panel Layout

```
+-----------------------------------+
| Dashboard: CSN Email Delivery     |
+-----------------------------------+
| +------+ +------+ +------+       |
| |Sent/ | |Bounce| |Compl.|       |  <-- Key indicators
| |hour  | |rate  | |rate  |       |
| | 450  | | 1.2% | |0.02% |       |
| +------+ +------+ +------+       |
|                                   |
| +-------------------------------+ |
| | Emails Sent Over Time         | |  <-- By email_type label
| | (stacked area chart)          | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Delivery Latency (p50/p95)    | |  <-- Histogram quantiles
| +-------------------------------+ |
|                                   |
| +---------------+---------------+ |
| | Queue Depth   | Failed Jobs   | |  <-- Real-time gauges
| | (by state)    | (1h window)   | |
| +---------------+---------------+ |
|                                   |
| +-------------------------------+ |
| | Bounce Rate (24h rolling)     | |  <-- With 3% and 5% thresholds
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Complaint Rate (24h rolling)  | |  <-- With 0.05% and 0.1% thresholds
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | Skipped Emails                | |  <-- By reason label
| | (preference vs suppression)   | |
| +-------------------------------+ |
+-----------------------------------+
```

---

### 13. Anti-Spam DNS Configuration

Proper DNS records are required to authenticate emails sent from the platform's domain and protect sender reputation.

#### Required DNS Records

| Record Type | Name | Value | Purpose |
|-------------|------|-------|---------|
| SPF (TXT) | `mail.community.example.com` | `v=spf1 include:amazonses.com ~all` | Authorize SES to send on behalf of the domain |
| DKIM (CNAME) | `*._domainkey.mail.community.example.com` | SES-provided CNAME records (3 records) | Cryptographic email signing |
| DMARC (TXT) | `_dmarc.mail.community.example.com` | `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@community.example.com; pct=100` | Policy for failed SPF/DKIM checks |
| Return-Path (MX) | `mail.community.example.com` | `10 feedback-smtp.us-east-1.amazonses.com` | Bounce return path for SES |

#### Sender Reputation Protection

1. **Dedicated sending subdomain**: `mail.community.example.com` isolates email sender reputation from the main domain. If the email reputation degrades, the main domain is unaffected.
2. **Bounce rate monitoring**: Alert at 3%, pause non-transactional sending at 5% (SES suspends at 5%).
3. **Complaint rate monitoring**: Alert at 0.05%, pause non-transactional sending at 0.1% (SES suspends at 0.1%).
4. **Warmup plan**: For new SES accounts, start at 200 emails/day and increase 50% daily until reaching the target rate.
5. **Suppression list**: Hard-bounced and complained addresses are permanently suppressed, preventing repeated delivery attempts to invalid addresses.

---

### 14. Template Preview (Development Only)

A preview endpoint allows developers to render any email template with sample data in the browser, without sending an actual email. This endpoint is disabled in production.

```typescript
// src/infrastructure/notification/email/EmailPreviewController.ts

import {
  Controller,
  Get,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TemplateRenderer } from './TemplateRenderer';

@Controller('api/v1/admin/email-preview')
export class EmailPreviewController {
  constructor(
    private readonly renderer: TemplateRenderer,
    private readonly config: ConfigService,
  ) {}

  @Get(':category/:template')
  preview(
    @Param('category') category: string,
    @Param('template') template: string,
  ): { subject: string; html: string; text: string } {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new ForbiddenException(
        'Email preview is disabled in production',
      );
    }

    const sampleData = this.getSampleData(category, template);
    return this.renderer.render(`${category}/${template}`, sampleData);
  }

  private getSampleData(
    category: string,
    template: string,
  ): Record<string, unknown> {
    const baseUrl = 'https://community.example.com';
    const baseData = {
      recipientName: 'Jane Doe',
      preferencesUrl: `${baseUrl}/settings/notifications`,
      isTransactional: false,
      categoryLabel: category,
    };

    const fixtures: Record<string, Record<string, unknown>> = {
      'auth/email-verification': {
        ...baseData,
        subject: 'Verify your email address',
        verificationUrl: `${baseUrl}/verify?token=sample-token-123`,
        isTransactional: true,
      },
      'auth/password-reset': {
        ...baseData,
        subject: 'Reset your password',
        resetUrl: `${baseUrl}/reset-password?token=sample-token-456`,
        expiresInMinutes: 60,
        isTransactional: true,
      },
      'auth/password-changed': {
        ...baseData,
        subject: 'Your password has been changed',
        changedAt: new Date().toISOString(),
        ipAddress: '192.168.1.xxx',
        isTransactional: true,
      },
      'auth/new-device-login': {
        ...baseData,
        subject: 'New sign-in to your account',
        deviceName: 'Chrome on macOS',
        ipAddress: '203.0.113.xxx',
        loginTime: new Date().toISOString(),
        isTransactional: true,
      },
      'social/new-follower': {
        ...baseData,
        subject: 'You have a new follower',
        followerName: 'John Smith',
        followerProfileUrl: `${baseUrl}/profile/john-smith`,
        followerBio: 'Software engineer and open source contributor',
        unsubscribeUrl: `${baseUrl}/api/v1/email/unsubscribe?uid=123&cat=social&token=sample`,
      },
      'social/mention-notification': {
        ...baseData,
        subject: 'John Smith mentioned you',
        mentionerName: 'John Smith',
        sourceType: 'post',
        contentPreview: 'Hey @janedoe, check out this new feature...',
        sourceUrl: `${baseUrl}/posts/abc-123`,
        unsubscribeUrl: `${baseUrl}/api/v1/email/unsubscribe?uid=123&cat=social&token=sample`,
      },
      'content/comment-on-post': {
        ...baseData,
        subject: 'John Smith commented on your post',
        commenterName: 'John Smith',
        postTitle: 'My first post on the platform',
        commentPreview: 'Great post! I really enjoyed reading this...',
        postUrl: `${baseUrl}/posts/abc-123#comment-xyz`,
        unsubscribeUrl: `${baseUrl}/api/v1/email/unsubscribe?uid=123&cat=content&token=sample`,
      },
      'admin/weekly-digest': {
        ...baseData,
        subject: 'Your weekly activity summary',
        weekStartDate: '2026-01-26',
        weekEndDate: '2026-02-01',
        newFollowers: 5,
        postReactions: 23,
        commentCount: 8,
        topPost: { title: 'My popular post', reactionCount: 15 },
        unsubscribeUrl: `${baseUrl}/api/v1/email/unsubscribe?uid=123&cat=admin&token=sample`,
      },
    };

    return fixtures[`${category}/${template}`] || {
      ...baseData,
      subject: `Preview: ${template}`,
    };
  }
}
```

---

### 15. Development Setup

#### Docker Compose Addition

For local development, Ethereal is used as the SMTP transport (no Docker container needed -- it is a cloud service). However, if the team prefers a local mail capture tool, MailHog can be added as an alternative.

```yaml
# Addition to docker-compose.yml (ADR-011) -- optional local alternative
services:
  # ... existing services (api, postgres, redis, pgadmin) ...

  # Optional: MailHog for teams preferring a local mail capture UI
  # If used, set MAILHOG_ENABLED=true and the TransportFactory
  # will route to localhost:1025 instead of Ethereal
  mailhog:
    image: mailhog/mailhog:latest
    profiles:
      - mailhog  # Only starts with: docker compose --profile mailhog up
    ports:
      - '1025:1025'   # SMTP server
      - '8025:8025'   # Web UI for inspecting captured emails
    restart: unless-stopped
```

#### Environment Variables

| Variable | Required In | Example | Description |
|----------|-------------|---------|-------------|
| `SES_SMTP_HOST` | staging, production | `email-smtp.us-east-1.amazonaws.com` | SES SMTP endpoint |
| `SES_SMTP_USER` | staging, production | (IAM SMTP credential) | SES SMTP username |
| `SES_SMTP_PASS` | staging, production | (IAM SMTP credential) | SES SMTP password |
| `SES_SNS_TOPIC_ARN` | staging, production | `arn:aws:sns:us-east-1:123:ses-notifications` | SNS topic for bounce/complaint webhooks |
| `ETHEREAL_USER` | development (optional) | `jane.doe@ethereal.email` | Ethereal SMTP username (auto-generated if absent) |
| `ETHEREAL_PASS` | development (optional) | `abc123def456` | Ethereal SMTP password |
| `EMAIL_FROM_ADDRESS` | all | `noreply@mail.community.example.com` | Sender email address |
| `EMAIL_FROM_NAME` | all | `Community Social Network` | Sender display name |
| `EMAIL_RATE_LIMIT_PER_SECOND` | all | `14` | Bull Queue rate limiter (match SES sending rate) |
| `APP_BASE_URL` | all | `https://community.example.com` | Base URL for links in email templates |

---

### 16. Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Queue latency (event to enqueue) | < 1 second | App metrics: time from event handler entry to `queue.add()` completion |
| Transactional email delivery | < 30 seconds end-to-end | Delivery log: `sent_at` - `queued_at` |
| Social/content email delivery | < 5 minutes | Delivery log: `sent_at` - `queued_at` |
| Digest email delivery | < 1 hour of scheduled time | Cron start time vs last email `sent_at` |
| Delivery success rate | > 99% | `(delivered + sent) / (total - skipped)` over 24h |
| Template render time | < 50ms | Application metrics: Handlebars compile + render |
| Worker throughput | 14 emails/second | Bull Queue rate limiter (configurable) |
| Bounce rate | < 3% | SES notifications over 24h rolling window |
| Complaint rate | < 0.05% | SES notifications over 24h rolling window |

---

### 17. NestJS Module Registration

```typescript
// src/infrastructure/notification/email/EmailModule.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './EmailService';
import { EmailWorker } from './EmailWorker';
import { TemplateRenderer } from './TemplateRenderer';
import { TransportFactory } from './TransportFactory';
import { EmailDeliveryLogService } from './EmailDeliveryLogService';
import { EmailPreferenceService } from './EmailPreferenceService';
import { UnsubscribeTokenService } from './UnsubscribeTokenService';
import { UnsubscribeController } from './UnsubscribeController';
import { SesWebhookController } from './SesWebhookController';
import { EmailPreviewController } from './EmailPreviewController';
import { EmailDeliveryLogEntity } from './entities/EmailDeliveryLogEntity';
import { EmailSuppressionEntity } from './entities/EmailSuppressionEntity';
import { EmailNotificationPreferenceEntity } from './entities/EmailNotificationPreferenceEntity';
import { createEmailQueue } from './EmailQueue';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      EmailDeliveryLogEntity,
      EmailSuppressionEntity,
      EmailNotificationPreferenceEntity,
    ]),
  ],
  controllers: [
    UnsubscribeController,
    SesWebhookController,
    EmailPreviewController,
  ],
  providers: [
    {
      provide: 'EMAIL_QUEUE',
      useFactory: (config: ConfigService) => createEmailQueue(config),
      inject: [ConfigService],
    },
    {
      provide: TemplateRenderer,
      useFactory: () => {
        const templateDir = path.resolve(
          __dirname,
          '../../notification/templates',
        );
        return new TemplateRenderer(templateDir);
      },
    },
    TransportFactory,
    EmailDeliveryLogService,
    EmailPreferenceService,
    UnsubscribeTokenService,
    EmailService,
    EmailWorker,
  ],
  exports: [EmailService],
})
export class EmailModule {}
```

---

## Alternatives Considered

### Option A: SendGrid (Rejected)

**Implementation**: Replace AWS SES with SendGrid as the email delivery provider. SendGrid provides a REST API, SMTP relay, visual template editor, and built-in analytics dashboard.

**Evaluation Matrix**:

| Criterion | SendGrid | AWS SES (Chosen) |
|-----------|----------|------------------|
| Cost at 10K emails/day | ~$60/month (Essentials plan) | ~$30/month ($0.10 per 1,000) |
| Template engine | Built-in visual editor | None (we use Handlebars) |
| Delivery analytics | Built-in dashboard | Requires custom implementation via SNS |
| Bounce handling | Automatic | Manual via SNS webhooks |
| AWS integration | Separate vendor | Native AWS service |
| Rate limiting control | Managed by SendGrid | Full control via Bull Queue |
| Setup complexity | Lower (API-first) | Higher (SMTP + SNS + IAM) |

**Pros**:
- Built-in template editor with visual drag-and-drop design
- Integrated delivery analytics and reporting dashboard
- Simpler bounce/complaint handling (webhook events with structured payloads)
- Click and open tracking built-in

**Cons**:
- **Higher cost at scale**: At the projected 10,000 emails/day, SendGrid costs approximately double what SES costs
- **Vendor coupling**: Using SendGrid's template engine would couple templates to a proprietary format, making migration difficult
- **Reduced control**: Rate limiting and retry logic are managed by SendGrid, reducing visibility into delivery behavior
- **Non-AWS vendor**: Adds another vendor to manage when the rest of the infrastructure is on AWS (ADR-011)

**Why Rejected**: SES is more cost-effective at the projected email volume, provides full control over delivery behavior via Bull Queue, and is native to the existing AWS infrastructure. The additional setup complexity (SNS webhooks, Handlebars templates) is a one-time cost that pays for itself through lower operational expenses and tighter infrastructure integration.

---

### Option B: Postmark (Rejected)

**Implementation**: Use Postmark as the transactional email delivery provider.

**Evaluation Matrix**:

| Criterion | Postmark | AWS SES (Chosen) |
|-----------|----------|------------------|
| Cost at 10K emails/day | ~$150/month (100K/month plan) | ~$30/month |
| Delivery speed | Sub-second typical | 1-3 seconds typical |
| Deliverability | Excellent (dedicated IPs, strict anti-spam) | Good (shared IPs on new accounts) |
| Bulk/digest support | No (transactional only) | Yes (all email types) |
| API design | Simple, well-documented | More complex (SMTP + SDK) |
| Template engine | Built-in with layouts | None (we use Handlebars) |

**Pros**:
- Excellent deliverability reputation due to strict content policies
- Consistently fast delivery times (often sub-second)
- Simple, well-designed API with excellent documentation
- Built-in bounce and complaint handling

**Cons**:
- **No bulk/digest support**: Postmark is designed exclusively for transactional email. Marketing or digest emails require a separate provider, effectively doubling the integration effort
- **Higher cost**: 5x the cost of SES at the projected volume
- **API-only**: No SMTP relay option; API-only integration couples application code more tightly to Postmark
- **Dual provider required**: The weekly digest and engagement emails would need a second provider (e.g., Mailchimp), adding operational complexity

**Why Rejected**: The requirement to support both transactional and engagement email categories (12 email types across 4 categories) makes a single-provider solution (SES) operationally simpler than maintaining two separate integrations. The 5x cost difference further favors SES.

---

### Option C: Self-Hosted Postfix/Haraka SMTP (Rejected)

**Implementation**: Self-host a Postfix or Haraka SMTP server within the Kubernetes cluster for email delivery.

**Evaluation Matrix**:

| Criterion | Self-Hosted SMTP | AWS SES (Chosen) |
|-----------|-----------------|------------------|
| Per-email cost | $0 (infrastructure cost only) | $0.10 per 1,000 |
| Operational burden | Very high | Low (managed service) |
| Deliverability | Challenging (IP warming, reputation management) | Good (SES handles reputation) |
| Bounce handling | Manual implementation | SNS notifications |
| Scaling | Manual capacity planning | Automatic |
| Setup time | Days-weeks | Hours |

**Pros**:
- Zero per-email cost (only infrastructure costs)
- Full control over SMTP configuration and behavior
- No third-party vendor dependency for core functionality

**Cons**:
- **Deliverability challenges**: Self-hosted SMTP servers require IP warming (weeks), careful reputation management, and dedicated operations effort to avoid being blacklisted by major email providers
- **Operational burden**: Requires monitoring, patching, scaling, and maintaining an additional stateful service in the Kubernetes cluster
- **No built-in bounce handling**: Must implement all bounce parsing (RFC 3464), complaint feedback loops (ARF format), and suppression list management from scratch
- **IP reputation risk**: A single spam complaint or misconfiguration can blacklist the sending IP, affecting all email delivery
- **Scaling complexity**: Must manage connection pooling, queue depth, and rate limiting manually

**Why Rejected**: Email deliverability is a solved problem for managed providers like SES. The operational cost of maintaining a self-hosted SMTP server (engineering time for setup, monitoring, reputation management, bounce parsing) far exceeds the approximately $30/month SES cost at projected volumes. The risk of deliverability issues is unacceptable for critical transactional emails like verification and password reset.

---

## Consequences

### Positive

- **Reliable delivery**: Bull Queue with 3 retries and progressive backoff (30s, 2min, 10min) ensures at-least-once delivery for all email categories, aligned with ADR-009 guarantees.
- **Priority processing**: Transactional emails (verification, password reset, security alerts) are always processed before social or digest emails via queue priority levels.
- **User control**: Per-category email preferences with one-click unsubscribe (RFC 8058) comply with GDPR (ADR-013) and CAN-SPAM requirements.
- **Development parity**: Ethereal provides a zero-configuration email testing environment where developers can inspect sent emails without any emails leaving the development machine.
- **Observability**: 11 Prometheus metrics provide full visibility into the email delivery pipeline, with alerting rules for bounce rate, complaint rate, queue depth, and delivery latency (aligned with ADR-012).
- **Reputation protection**: Automatic suppression of hard-bounced addresses and auto-unsubscribe on complaints keep bounce/complaint rates below SES thresholds.
- **Template maintainability**: Handlebars layout + partials architecture avoids HTML duplication across 12 email templates.
- **Cost efficiency**: SES at $0.10/1,000 emails costs approximately $30/month at the projected 10,000 emails/day volume.

### Negative

- **Infrastructure dependency**: Email delivery adds SES, SNS, and Handlebars templates to the infrastructure footprint.
- **Template maintenance**: Handlebars templates must be maintained for both HTML and plain text variants across all 12 email types (24 template files total).
- **Webhook complexity**: SES bounce/complaint handling via SNS requires an API endpoint, SNS topic configuration, and IAM permissions.
- **Delivery latency**: Queue-based processing adds latency compared to synchronous email sending (mitigated by priority queuing for transactional emails).
- **DNS configuration**: SPF, DKIM, DMARC, and MX records must be configured correctly for the sending domain before production deployment.
- **SES sandbox limitations**: Staging environment can only send to verified email addresses, which limits testing scope.

### Mitigation

| Risk | Mitigation |
|------|------------|
| SES service outage | Bull Queue retries with progressive backoff (30s, 2min, 10min); DLQ preserves failed emails for replay after recovery |
| Template rendering errors | Email preview endpoint for development testing; integration tests that render all 12 templates with fixture data; plain text fallback for every HTML template |
| Bounce rate exceeds SES threshold | Automated monitoring alerts at 3%; automatic non-transactional pause at 5%; suppression list prevents re-sending to bounced addresses |
| Complaint rate exceeds SES threshold | Auto-unsubscribe on complaint; monitoring alerts at 0.05%; automatic non-transactional pause at 0.1%; RFC 8058 one-click unsubscribe reduces complaint likelihood |
| User receives unwanted email | One-click unsubscribe in every non-transactional email; complaint auto-unsubscribe; preference management via account settings; GDPR consent verification before queuing |
| Email volume exceeds SES rate limit | Bull Queue rate limiter (14/s configurable) prevents throttling; SES rate limit increase available via AWS support ticket |
| DNS misconfiguration | Pre-deployment checklist validates SPF, DKIM, DMARC records; staging environment tests with real SES sandbox |
| Development environment complexity | Ethereal requires zero infrastructure (cloud service with auto-generated accounts); optional MailHog for teams preferring local capture |

---

## References

### Internal ADRs

- ADR-004: Session vs Token Auth -- Email verification requirement, password reset flow
- ADR-007: Bounded Contexts -- Notification Context definition (Alert, Preference, Channel aggregates)
- ADR-009: Domain Events Strategy -- Bull Queue infrastructure, at-least-once delivery, DLQ strategy, event naming conventions
- ADR-012: Observability Strategy -- Prometheus metrics (`csn_` prefix), Pino structured logging, alerting thresholds
- ADR-013: Data Privacy / GDPR -- Consent tracking, email notification consent type, unsubscribe requirements

### External References

- AWS SES Developer Guide: https://docs.aws.amazon.com/ses/latest/dg/
- AWS SES SMTP Interface: https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html
- AWS SES Sending Quotas: https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html
- AWS SNS Developer Guide: https://docs.aws.amazon.com/sns/latest/dg/
- Nodemailer Documentation: https://nodemailer.com/
- Ethereal Email (Fake SMTP): https://ethereal.email/
- Handlebars Documentation: https://handlebarsjs.com/
- Bull Queue Documentation: https://github.com/OptimalBits/bull
- RFC 8058 (One-Click Unsubscribe): https://datatracker.ietf.org/doc/html/rfc8058
- RFC 3464 (Delivery Status Notifications): https://datatracker.ietf.org/doc/html/rfc3464
- CAN-SPAM Act Compliance Guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- GDPR Article 7 (Conditions for Consent): https://gdpr-info.eu/art-7-gdpr/
- DMARC Specification: https://dmarc.org/overview/

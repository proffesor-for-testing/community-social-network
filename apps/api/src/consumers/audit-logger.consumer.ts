import { Injectable, Logger, Inject } from '@nestjs/common';
import { IdempotencyStore } from '@csn/infra-messaging';
import { AUDIT_ENTRY_REPOSITORY } from '@csn/infra-admin';
import {
  AuditEntry,
  AuditEntryId,
  IAuditEntryRepository,
  IpAddress,
} from '@csn/domain-admin';
import { UserId } from '@csn/domain-shared';
import { EventConsumerHandler } from '@csn/infra-shared';

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

export interface MemberSuspendedPayload {
  eventId: string;
  aggregateId: string;
  reason: string;
  suspendedBy: string;
}

export interface MemberLockedPayload {
  eventId: string;
  aggregateId: string;
  reason: string;
  failedAttempts: number;
}

export interface SecurityAlertPayload {
  eventId: string;
  aggregateId: string;
  severity: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Consumer
// ---------------------------------------------------------------------------

/**
 * Cross-context event consumer that records administrative and security
 * actions as AuditEntry aggregates in the Admin bounded context.
 *
 * Handles:
 * - MemberSuspended   -> Audit entry for admin suspension action
 * - MemberLocked      -> Audit entry for account lockout
 * - SecurityAlertRaised -> Audit entry for security events
 *
 * Each handler is idempotent via IdempotencyStore.
 */
@Injectable()
export class AuditLoggerConsumer implements EventConsumerHandler {
  private readonly logger = new Logger(AuditLoggerConsumer.name);

  constructor(
    @Inject(AUDIT_ENTRY_REPOSITORY)
    private readonly auditEntryRepository: IAuditEntryRepository,
    private readonly idempotencyStore: IdempotencyStore,
  ) {}

  async handle(event: unknown): Promise<void> {
    const payload = event as Record<string, unknown>;
    const eventType = payload['type'] as string | undefined;

    switch (eventType) {
      case 'MemberSuspended':
        return this.onMemberSuspended(payload as unknown as MemberSuspendedPayload);
      case 'MemberLocked':
        return this.onMemberLocked(payload as unknown as MemberLockedPayload);
      case 'SecurityAlertRaised':
        return this.onSecurityAlertRaised(payload as unknown as SecurityAlertPayload);
      default:
        this.logger.warn(`Unknown audit event type: ${eventType}`);
    }
  }

  private async onMemberSuspended(
    payload: MemberSuspendedPayload,
  ): Promise<void> {
    await this.idempotencyStore.ensureIdempotent(
      `audit:suspend:${payload.eventId}`,
      async () => {
        const entryId = AuditEntryId.generate();
        const performedBy = UserId.create(payload.suspendedBy);
        const ipAddress = IpAddress.create('0.0.0.0'); // IP from request context in production

        const entry = AuditEntry.create(
          entryId,
          'MEMBER_SUSPENDED',
          performedBy,
          payload.aggregateId,
          'Member',
          { reason: payload.reason },
          ipAddress,
        );

        await this.auditEntryRepository.save(entry);

        this.logger.log(
          `Audit: MEMBER_SUSPENDED - member ${payload.aggregateId} by ${payload.suspendedBy}`,
        );
      },
    );
  }

  private async onMemberLocked(
    payload: MemberLockedPayload,
  ): Promise<void> {
    await this.idempotencyStore.ensureIdempotent(
      `audit:locked:${payload.eventId}`,
      async () => {
        const entryId = AuditEntryId.generate();
        // System-initiated lock uses the aggregate itself as performer
        const performedBy = UserId.create(payload.aggregateId);
        const ipAddress = IpAddress.create('0.0.0.0');

        const entry = AuditEntry.create(
          entryId,
          'MEMBER_LOCKED',
          performedBy,
          payload.aggregateId,
          'Member',
          {
            reason: payload.reason,
            failedAttempts: payload.failedAttempts,
          },
          ipAddress,
        );

        await this.auditEntryRepository.save(entry);

        this.logger.log(
          `Audit: MEMBER_LOCKED - member ${payload.aggregateId} after ${payload.failedAttempts} failed attempts`,
        );
      },
    );
  }

  private async onSecurityAlertRaised(
    payload: SecurityAlertPayload,
  ): Promise<void> {
    await this.idempotencyStore.ensureIdempotent(
      `audit:security:${payload.eventId}`,
      async () => {
        const entryId = AuditEntryId.generate();
        const performedBy = UserId.create(payload.aggregateId);
        const ipAddress = IpAddress.create('0.0.0.0');

        const entry = AuditEntry.create(
          entryId,
          'SECURITY_ALERT',
          performedBy,
          payload.aggregateId,
          'SecurityAlert',
          {
            severity: payload.severity,
            description: payload.description,
          },
          ipAddress,
        );

        await this.auditEntryRepository.save(entry);

        this.logger.log(
          `Audit: SECURITY_ALERT - severity=${payload.severity}, ${payload.description}`,
        );
      },
    );
  }
}

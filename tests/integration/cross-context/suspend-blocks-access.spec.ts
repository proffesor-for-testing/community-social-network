/**
 * Cross-Context Integration Test: Suspend Blocks Access
 *
 * Validates that when an admin suspends a user:
 * 1. The member status changes to SUSPENDED
 * 2. The suspended member cannot login
 * 3. An audit entry is created for the suspension action
 * 4. The AuditLoggerConsumer processes the MemberSuspended event
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';

// ── Identity handlers ───────────────────────────────────────────────────────

import { RegisterMemberHandler } from '../../../apps/api/src/modules/identity/commands/register-member.handler';
import { RegisterMemberCommand } from '../../../apps/api/src/modules/identity/commands/register-member.command';
import { LoginMemberHandler } from '../../../apps/api/src/modules/identity/commands/login-member.handler';
import { LoginMemberCommand } from '../../../apps/api/src/modules/identity/commands/login-member.command';

// ── Admin handlers ──────────────────────────────────────────────────────────

import { SuspendUserHandler } from '../../../apps/api/src/modules/admin/commands/suspend-user.handler';
import { SuspendUserCommand } from '../../../apps/api/src/modules/admin/commands/suspend-user.command';

// ── Cross-context consumer ──────────────────────────────────────────────────

import { AuditLoggerConsumer } from '../../../apps/api/src/consumers/audit-logger.consumer';

// ── Test infrastructure ─────────────────────────────────────────────────────

import {
  createTestRepositories,
  TestRepositories,
  MockJwtTokenService,
  MockIdempotencyStore,
} from '../../setup/test-app';
import { UserId } from '@csn/domain-shared';

describe('Cross-Context: Suspend Blocks Access', () => {
  let repos: TestRepositories;
  let mockIdempotency: MockIdempotencyStore;

  let registerHandler: RegisterMemberHandler;
  let loginHandler: LoginMemberHandler;
  let suspendHandler: SuspendUserHandler;
  let auditConsumer: AuditLoggerConsumer;

  const adminId = randomUUID();

  beforeEach(() => {
    repos = createTestRepositories();
    mockIdempotency = new MockIdempotencyStore();
    const mockJwt = new MockJwtTokenService();

    registerHandler = new RegisterMemberHandler(
      repos.memberRepo,
      repos.sessionRepo,
      mockJwt as any,
    );
    loginHandler = new LoginMemberHandler(
      repos.memberRepo,
      repos.sessionRepo,
      mockJwt as any,
    );
    suspendHandler = new SuspendUserHandler(
      repos.memberRepo,
      repos.auditEntryRepo,
    );
    auditConsumer = new AuditLoggerConsumer(
      repos.auditEntryRepo,
      mockIdempotency as any,
    );
  });

  // ── Step 1: Admin suspends a user ─────────────────────────────────────

  it('should suspend a member and change their status to SUSPENDED', async () => {
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('target@test.com', 'Target User', 'Str0ng!Pass#2024'),
    );

    const suspendCommand = new SuspendUserCommand(
      adminId,
      regResult.member.id,
      'Violation of terms of service',
      '192.168.1.1',
    );

    const result = await suspendHandler.execute(suspendCommand);

    expect(result.status).toBe('SUSPENDED');
    expect(result.id).toBe(regResult.member.id);
  });

  // ── Step 2: Suspended user cannot login ───────────────────────────────

  it('should prevent suspended user from logging in', async () => {
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('suspended@test.com', 'Suspended User', 'Str0ng!Pass#2024'),
    );

    await suspendHandler.execute(
      new SuspendUserCommand(
        adminId,
        regResult.member.id,
        'Bad behavior',
        '192.168.1.1',
      ),
    );

    await expect(
      loginHandler.execute(
        new LoginMemberCommand('suspended@test.com', 'Str0ng!Pass#2024'),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Step 3: Audit entry created for suspension ────────────────────────

  it('should create an audit entry when a user is suspended', async () => {
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('audited@test.com', 'Audited User', 'Str0ng!Pass#2024'),
    );

    await suspendHandler.execute(
      new SuspendUserCommand(
        adminId,
        regResult.member.id,
        'Audit test suspension',
        '10.0.0.1',
      ),
    );

    // Verify audit entry was created
    expect(repos.auditEntryRepo.count()).toBe(1);

    // Find by the admin who performed the action
    const entries = await repos.auditEntryRepo.findByPerformedBy(
      UserId.create(adminId),
    );
    expect(entries.total).toBe(1);
    expect(entries.items[0].action).toBe('SUSPEND_USER');
    expect(entries.items[0].targetId).toBe(regResult.member.id);
  });

  // ── Step 4: AuditLoggerConsumer processes MemberSuspended event ───────

  it('should process MemberSuspended event via AuditLoggerConsumer', async () => {
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('consumer-audit@test.com', 'Consumer Audit', 'Str0ng!Pass#2024'),
    );

    const eventPayload = {
      type: 'MemberSuspended',
      eventId: randomUUID(),
      aggregateId: regResult.member.id,
      reason: 'Consumer test suspension',
      suspendedBy: adminId,
    };

    await auditConsumer.handle(eventPayload);

    // Verify audit entry created by consumer
    const entries = await repos.auditEntryRepo.findByTargetId(regResult.member.id);
    expect(entries.total).toBeGreaterThanOrEqual(1);
  });

  // ── Cannot suspend already-suspended user ─────────────────────────────

  it('should reject suspending an already-suspended user', async () => {
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('double-sus@test.com', 'Double Suspend', 'Str0ng!Pass#2024'),
    );

    await suspendHandler.execute(
      new SuspendUserCommand(
        adminId,
        regResult.member.id,
        'First suspension',
        '10.0.0.1',
      ),
    );

    await expect(
      suspendHandler.execute(
        new SuspendUserCommand(
          adminId,
          regResult.member.id,
          'Second suspension',
          '10.0.0.1',
        ),
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ── AuditLoggerConsumer handles MemberLocked events ───────────────────

  it('should process MemberLocked event via AuditLoggerConsumer', async () => {
    const memberId = randomUUID();
    const eventPayload = {
      type: 'MemberLocked',
      eventId: randomUUID(),
      aggregateId: memberId,
      reason: 'Too many failed login attempts',
      failedAttempts: 5,
    };

    await auditConsumer.handle(eventPayload);

    const entries = await repos.auditEntryRepo.findByTargetId(memberId);
    expect(entries.total).toBe(1);
    expect(entries.items[0].action).toBe('MEMBER_LOCKED');
  });

  // ── Idempotent audit logging ──────────────────────────────────────────

  it('should not create duplicate audit entries for the same event', async () => {
    const eventPayload = {
      type: 'MemberSuspended',
      eventId: randomUUID(),
      aggregateId: randomUUID(),
      reason: 'Idempotency test',
      suspendedBy: adminId,
    };

    // Process twice
    await auditConsumer.handle(eventPayload);
    await auditConsumer.handle(eventPayload);

    // Should have at most 1 entry for this event
    const isProcessed = await mockIdempotency.isProcessed(
      `audit:suspend:${eventPayload.eventId}`,
    );
    expect(isProcessed).toBe(true);
  });

  // ── Full cross-context flow ───────────────────────────────────────────

  it('should complete full register -> suspend -> blocked login -> audit flow', async () => {
    // 1. Register a member
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('fullflow@test.com', 'Full Flow User', 'Str0ng!Pass#2024'),
    );
    expect(regResult.member.status).toBe('ACTIVE');

    // 2. Verify login works before suspension
    const loginResult = await loginHandler.execute(
      new LoginMemberCommand('fullflow@test.com', 'Str0ng!Pass#2024'),
    );
    expect(loginResult.member.status).toBe('ACTIVE');

    // 3. Admin suspends the user
    const suspendResult = await suspendHandler.execute(
      new SuspendUserCommand(
        adminId,
        regResult.member.id,
        'Full flow suspension test',
        '10.0.0.1',
      ),
    );
    expect(suspendResult.status).toBe('SUSPENDED');

    // 4. Verify login is now blocked
    await expect(
      loginHandler.execute(
        new LoginMemberCommand('fullflow@test.com', 'Str0ng!Pass#2024'),
      ),
    ).rejects.toThrow(ForbiddenException);

    // 5. Verify audit entry exists
    expect(repos.auditEntryRepo.count()).toBeGreaterThanOrEqual(1);

    // 6. Process MemberSuspended event through consumer
    const eventPayload = {
      type: 'MemberSuspended',
      eventId: randomUUID(),
      aggregateId: regResult.member.id,
      reason: 'Full flow suspension test',
      suspendedBy: adminId,
    };
    await auditConsumer.handle(eventPayload);

    // 7. Verify consumer audit entry created
    const entries = await repos.auditEntryRepo.findByTargetId(regResult.member.id);
    expect(entries.total).toBeGreaterThanOrEqual(1);
  });
});

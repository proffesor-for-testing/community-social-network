import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { SuspendUserHandler } from '../commands/suspend-user.handler';
import { SuspendUserCommand } from '../commands/suspend-user.command';
import type { IMemberRepository } from '@csn/domain-identity';
import type { IAuditEntryRepository } from '@csn/domain-admin';
import {
  Member,
  MemberId,
  Credential,
  MemberStatus,
} from '@csn/domain-identity';
import { Email, Timestamp, UserId } from '@csn/domain-shared';

function createTestMember(
  status: MemberStatus = MemberStatus.active(),
): Member {
  return Member.reconstitute(
    MemberId.create('550e8400-e29b-41d4-a716-446655440001'),
    Email.create('user@example.com'),
    Credential.create('$2b$10$hashedpasswordvalue1234567890abcdefghijklmnopqrs'),
    status,
    'Test User',
    0,
    null,
    Timestamp.fromDate(new Date('2024-01-15T10:30:00.000Z')),
    1,
  );
}

describe('SuspendUserHandler', () => {
  let handler: SuspendUserHandler;
  let mockMemberRepository: {
    findById: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    nextId: ReturnType<typeof vi.fn>;
  };
  let mockAuditEntryRepository: {
    findById: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    nextId: ReturnType<typeof vi.fn>;
    findByPerformedBy: ReturnType<typeof vi.fn>;
    findByTargetId: ReturnType<typeof vi.fn>;
    findByDateRange: ReturnType<typeof vi.fn>;
  };

  const adminId = '550e8400-e29b-41d4-a716-446655440099';
  const targetUserId = '550e8400-e29b-41d4-a716-446655440001';
  const ipAddress = '192.168.1.100';

  beforeEach(() => {
    mockMemberRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn(),
      nextId: vi.fn(),
    };

    mockAuditEntryRepository = {
      findById: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      exists: vi.fn(),
      nextId: vi.fn(),
      findByPerformedBy: vi.fn(),
      findByTargetId: vi.fn(),
      findByDateRange: vi.fn(),
    };

    handler = new SuspendUserHandler(
      mockMemberRepository as unknown as IMemberRepository,
      mockAuditEntryRepository as unknown as IAuditEntryRepository,
    );
  });

  it('should suspend an active member', async () => {
    const member = createTestMember(MemberStatus.active());
    mockMemberRepository.findById.mockResolvedValue(member);

    const command = new SuspendUserCommand(
      adminId,
      targetUserId,
      'Violated community guidelines repeatedly',
      ipAddress,
    );

    const result = await handler.execute(command);

    expect(result.id).toBe(targetUserId);
    expect(result.status).toBe('SUSPENDED');
    expect(mockMemberRepository.save).toHaveBeenCalledOnce();
    expect(mockAuditEntryRepository.save).toHaveBeenCalledOnce();
  });

  it('should throw NotFoundException when member does not exist', async () => {
    mockMemberRepository.findById.mockResolvedValue(null);

    const command = new SuspendUserCommand(
      adminId,
      targetUserId,
      'Violated community guidelines repeatedly',
      ipAddress,
    );

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    expect(mockMemberRepository.save).not.toHaveBeenCalled();
    expect(mockAuditEntryRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when member is already suspended', async () => {
    const member = createTestMember(MemberStatus.suspended());
    mockMemberRepository.findById.mockResolvedValue(member);

    const command = new SuspendUserCommand(
      adminId,
      targetUserId,
      'Violated community guidelines repeatedly',
      ipAddress,
    );

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(mockMemberRepository.save).not.toHaveBeenCalled();
    expect(mockAuditEntryRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when member is deactivated', async () => {
    const member = createTestMember(MemberStatus.deactivated());
    mockMemberRepository.findById.mockResolvedValue(member);

    const command = new SuspendUserCommand(
      adminId,
      targetUserId,
      'Violated community guidelines repeatedly',
      ipAddress,
    );

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(mockMemberRepository.save).not.toHaveBeenCalled();
    expect(mockAuditEntryRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when member is locked', async () => {
    const member = createTestMember(MemberStatus.locked());
    mockMemberRepository.findById.mockResolvedValue(member);

    const command = new SuspendUserCommand(
      adminId,
      targetUserId,
      'Violated community guidelines repeatedly',
      ipAddress,
    );

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(mockMemberRepository.save).not.toHaveBeenCalled();
    expect(mockAuditEntryRepository.save).not.toHaveBeenCalled();
  });

  it('should create an audit entry with correct details', async () => {
    const member = createTestMember(MemberStatus.active());
    mockMemberRepository.findById.mockResolvedValue(member);

    const reason = 'Violated community guidelines repeatedly';
    const command = new SuspendUserCommand(adminId, targetUserId, reason, ipAddress);

    await handler.execute(command);

    // Verify audit entry was saved
    expect(mockAuditEntryRepository.save).toHaveBeenCalledOnce();

    // The argument to save() is an AuditEntry aggregate
    const savedAuditEntry = mockAuditEntryRepository.save.mock.calls[0][0];
    expect(savedAuditEntry.action).toBe('SUSPEND_USER');
    expect(savedAuditEntry.performedBy.value).toBe(adminId);
    expect(savedAuditEntry.targetId).toBe(targetUserId);
    expect(savedAuditEntry.targetType).toBe('Member');
    expect(savedAuditEntry.details).toEqual({ reason });
    expect(savedAuditEntry.ipAddress.value).toBe(ipAddress);
  });

  it('should return AdminUserResponseDto with correct fields', async () => {
    const member = createTestMember(MemberStatus.active());
    mockMemberRepository.findById.mockResolvedValue(member);

    const command = new SuspendUserCommand(
      adminId,
      targetUserId,
      'Violated community guidelines repeatedly',
      ipAddress,
    );

    const result = await handler.execute(command);

    expect(result.id).toBe(targetUserId);
    expect(result.email).toBe('user@example.com');
    expect(result.displayName).toBe('Test User');
    expect(result.status).toBe('SUSPENDED');
    expect(result.failedLoginAttempts).toBe(0);
    expect(result.lastLoginAt).toBeNull();
    expect(result.createdAt).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should save the member before creating the audit entry', async () => {
    const callOrder: string[] = [];
    const member = createTestMember(MemberStatus.active());
    mockMemberRepository.findById.mockResolvedValue(member);
    mockMemberRepository.save.mockImplementation(async () => {
      callOrder.push('member.save');
    });
    mockAuditEntryRepository.save.mockImplementation(async () => {
      callOrder.push('audit.save');
    });

    const command = new SuspendUserCommand(
      adminId,
      targetUserId,
      'Violated community guidelines repeatedly',
      ipAddress,
    );

    await handler.execute(command);

    expect(callOrder).toEqual(['member.save', 'audit.save']);
  });
});

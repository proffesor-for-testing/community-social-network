import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Email, Timestamp } from '@csn/domain-shared';
import {
  Member,
  MemberId,
  Credential,
  MemberStatus,
} from '@csn/domain-identity';
import { PromoteUserHandler } from '../commands/promote-user.handler';

const ADMIN_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const TARGET_ID = 'b2c3d4e5-f6a7-4901-bcde-f12345678901';

function createMember(isAdmin = false): Member {
  return Member.reconstitute(
    MemberId.create(TARGET_ID),
    Email.create('target@example.com'),
    Credential.create('$2b$10$hashedpasswordvalue'),
    MemberStatus.active(),
    'Target User',
    0,
    null,
    Timestamp.fromDate(new Date('2025-01-01T00:00:00Z')),
    3,
    isAdmin,
  );
}

describe('PromoteUserHandler', () => {
  let memberRepository: { findById: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let auditEntryRepository: { save: ReturnType<typeof vi.fn> };
  let handler: PromoteUserHandler;

  beforeEach(() => {
    memberRepository = {
      findById: vi.fn().mockResolvedValue(createMember()),
      save: vi.fn().mockResolvedValue(undefined),
    };
    auditEntryRepository = { save: vi.fn().mockResolvedValue(undefined) };
    handler = new PromoteUserHandler(
      memberRepository as never,
      auditEntryRepository as never,
    );
  });

  it('should return the target member marked as admin', async () => {
    // Arrange
    const command = { adminId: ADMIN_ID, targetUserId: TARGET_ID, ipAddress: '10.0.0.1' };

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isAdmin).toBe(true);
  });

  it('should persist the promoted member', async () => {
    // Arrange
    const command = { adminId: ADMIN_ID, targetUserId: TARGET_ID, ipAddress: '10.0.0.1' };

    // Act
    await handler.execute(command);

    // Assert
    expect(memberRepository.save.mock.calls[0]![0].isAdmin).toBe(true);
  });

  it('should write a PROMOTE_USER audit entry', async () => {
    // Arrange
    const command = { adminId: ADMIN_ID, targetUserId: TARGET_ID, ipAddress: '10.0.0.1' };

    // Act
    await handler.execute(command);

    // Assert
    expect(auditEntryRepository.save.mock.calls[0]![0].action).toBe('PROMOTE_USER');
  });

  it('should attribute the audit entry to the acting admin', async () => {
    // Arrange
    const command = { adminId: ADMIN_ID, targetUserId: TARGET_ID, ipAddress: '10.0.0.1' };

    // Act
    await handler.execute(command);

    // Assert
    expect(auditEntryRepository.save.mock.calls[0]![0].performedBy.value).toBe(ADMIN_ID);
  });

  it('should leave an existing admin still an admin', async () => {
    // Arrange
    memberRepository.findById.mockResolvedValue(createMember(true));
    const command = { adminId: ADMIN_ID, targetUserId: TARGET_ID, ipAddress: '10.0.0.1' };

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isAdmin).toBe(true);
  });

  it('should throw NotFoundException when the target member does not exist', async () => {
    // Arrange
    memberRepository.findById.mockResolvedValue(null);
    const command = { adminId: ADMIN_ID, targetUserId: TARGET_ID, ipAddress: '10.0.0.1' };

    // Act & Assert
    await expect(handler.execute(command)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should not write an audit entry when the target member does not exist', async () => {
    // Arrange
    memberRepository.findById.mockResolvedValue(null);
    const command = { adminId: ADMIN_ID, targetUserId: TARGET_ID, ipAddress: '10.0.0.1' };

    // Act
    await handler.execute(command).catch(() => undefined);

    // Assert
    expect(auditEntryRepository.save).not.toHaveBeenCalled();
  });
});

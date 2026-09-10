import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Email, Timestamp } from '@csn/domain-shared';
import {
  Member,
  MemberId,
  Credential,
  MemberStatus,
} from '@csn/domain-identity';
import { DemoteUserHandler } from '../commands/demote-user.handler';

const ADMIN_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const TARGET_ID = 'b2c3d4e5-f6a7-4901-bcde-f12345678901';

function createMember(isAdmin = true): Member {
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

describe('DemoteUserHandler', () => {
  let memberRepository: { findById: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let auditEntryRepository: { save: ReturnType<typeof vi.fn> };
  let handler: DemoteUserHandler;

  beforeEach(() => {
    memberRepository = {
      findById: vi.fn().mockResolvedValue(createMember()),
      save: vi.fn().mockResolvedValue(undefined),
    };
    auditEntryRepository = { save: vi.fn().mockResolvedValue(undefined) };
    handler = new DemoteUserHandler(
      memberRepository as never,
      auditEntryRepository as never,
    );
  });

  it('should return the target member no longer marked as admin', async () => {
    // Arrange
    const command = { adminId: ADMIN_ID, targetUserId: TARGET_ID, ipAddress: '10.0.0.1' };

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isAdmin).toBe(false);
  });

  it('should persist the demoted member', async () => {
    // Arrange
    const command = { adminId: ADMIN_ID, targetUserId: TARGET_ID, ipAddress: '10.0.0.1' };

    // Act
    await handler.execute(command);

    // Assert
    expect(memberRepository.save.mock.calls[0]![0].isAdmin).toBe(false);
  });

  it('should write a DEMOTE_USER audit entry', async () => {
    // Arrange
    const command = { adminId: ADMIN_ID, targetUserId: TARGET_ID, ipAddress: '10.0.0.1' };

    // Act
    await handler.execute(command);

    // Assert
    expect(auditEntryRepository.save.mock.calls[0]![0].action).toBe('DEMOTE_USER');
  });

  it('should leave a non-admin member non-admin', async () => {
    // Arrange
    memberRepository.findById.mockResolvedValue(createMember(false));
    const command = { adminId: ADMIN_ID, targetUserId: TARGET_ID, ipAddress: '10.0.0.1' };

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result.isAdmin).toBe(false);
  });

  it('should reject an admin demoting themselves', async () => {
    // Arrange
    const command = { adminId: ADMIN_ID, targetUserId: ADMIN_ID, ipAddress: '10.0.0.1' };

    // Act & Assert
    await expect(handler.execute(command)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should not load the member when an admin demotes themselves', async () => {
    // Arrange
    const command = { adminId: ADMIN_ID, targetUserId: ADMIN_ID, ipAddress: '10.0.0.1' };

    // Act
    await handler.execute(command).catch(() => undefined);

    // Assert
    expect(memberRepository.findById).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when the target member does not exist', async () => {
    // Arrange
    memberRepository.findById.mockResolvedValue(null);
    const command = { adminId: ADMIN_ID, targetUserId: TARGET_ID, ipAddress: '10.0.0.1' };

    // Act & Assert
    await expect(handler.execute(command)).rejects.toBeInstanceOf(NotFoundException);
  });
});

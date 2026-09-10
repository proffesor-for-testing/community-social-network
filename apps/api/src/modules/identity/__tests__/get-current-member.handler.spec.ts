import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { GetCurrentMemberHandler } from '../queries/get-current-member.handler';
import { GetCurrentMemberQuery } from '../queries/get-current-member.query';
import { MemberResponseDto } from '../dto/member-response.dto';

function memberLike(id = '11111111-1111-4111-8111-111111111111') {
  return {
    id: { value: id },
    email: { value: 'user@example.com' },
    displayName: 'Test User',
    status: { value: 'ACTIVE' },
    createdAt: { value: new Date('2026-01-01T00:00:00.000Z') },
  };
}

describe('GetCurrentMemberHandler — role derivation', () => {
  let repo: { findById: ReturnType<typeof vi.fn> };
  let handler: GetCurrentMemberHandler;

  beforeEach(() => {
    // Arrange (shared)
    repo = { findById: vi.fn().mockResolvedValue(memberLike()) };
    handler = new GetCurrentMemberHandler(repo as never);
  });

  it("should report role 'admin' when the token roles include admin", async () => {
    // Act
    const dto = await handler.execute(new GetCurrentMemberQuery(memberLike().id.value, ['admin', 'member']));

    // Assert
    expect(dto.role).toBe('admin');
  });

  it("should report role 'member' for an ordinary member token", async () => {
    // Act
    const dto = await handler.execute(new GetCurrentMemberQuery(memberLike().id.value, ['member']));

    // Assert
    expect(dto.role).toBe('member');
  });

  it("should default to role 'member' when no roles are supplied", async () => {
    // Act
    const dto = await handler.execute(new GetCurrentMemberQuery(memberLike().id.value));

    // Assert
    expect(dto.role).toBe('member');
  });

  it('should throw NotFoundException when the member does not exist', async () => {
    // Arrange
    repo.findById.mockResolvedValue(null);

    // Act + Assert
    await expect(
      handler.execute(new GetCurrentMemberQuery(memberLike().id.value, ['member'])),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MemberResponseDto.roleFromClaims', () => {
  it.each([
    [['admin'], 'admin'],
    [['member', 'admin'], 'admin'],
    [['member'], 'member'],
    [[], 'member'],
    [undefined, 'member'],
  ])('should map roles %j to %s', (roles, expected) => {
    // Act
    const role = MemberResponseDto.roleFromClaims(roles as string[] | undefined);

    // Assert
    expect(role).toBe(expected);
  });
});

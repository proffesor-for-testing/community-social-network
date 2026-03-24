import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Connection,
  ConnectionId,
  IConnectionRepository,
  IBlockRepository,
} from '@csn/domain-social-graph';
import { FollowMemberHandler } from '../commands/follow-member.handler';
import { FollowMemberCommand } from '../commands/follow-member.command';

describe('FollowMemberHandler', () => {
  let handler: FollowMemberHandler;
  let connectionRepo: IConnectionRepository;
  let blockRepo: IBlockRepository;

  const followerId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const followeeId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

  beforeEach(() => {
    connectionRepo = {
      nextId: vi.fn().mockReturnValue(ConnectionId.generate()),
      findById: vi.fn().mockResolvedValue(null),
      exists: vi.fn().mockResolvedValue(false),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      findByFollowerAndFollowee: vi.fn().mockResolvedValue(null),
      findFollowers: vi.fn().mockResolvedValue([]),
      findFollowing: vi.fn().mockResolvedValue([]),
      countFollowers: vi.fn().mockResolvedValue(0),
      countFollowing: vi.fn().mockResolvedValue(0),
    };

    blockRepo = {
      nextId: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      exists: vi.fn().mockResolvedValue(false),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      findByBlockerAndBlocked: vi.fn().mockResolvedValue(null),
      findByBlocker: vi.fn().mockResolvedValue([]),
      isBlocked: vi.fn().mockResolvedValue(false),
    };

    handler = new FollowMemberHandler(connectionRepo, blockRepo);
  });

  it('should create a follow request successfully', async () => {
    const command = new FollowMemberCommand(followerId, followeeId);

    const result = await handler.execute(command);

    expect(result).toBeDefined();
    expect(result.followerId).toBe(followerId);
    expect(result.followeeId).toBe(followeeId);
    expect(result.status).toBe('PENDING');
    expect(connectionRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw BadRequestException when following yourself', async () => {
    const command = new FollowMemberCommand(followerId, followerId);

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    await expect(handler.execute(command)).rejects.toThrow('Cannot follow yourself');
  });

  it('should throw BadRequestException when users are blocked', async () => {
    vi.mocked(blockRepo.isBlocked).mockResolvedValue(true);

    const command = new FollowMemberCommand(followerId, followeeId);

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    await expect(handler.execute(command)).rejects.toThrow('Cannot follow this user');
  });

  it('should throw ConflictException when follow request already exists', async () => {
    const existingConnection = Connection.request(
      ConnectionId.generate(),
      UserId.create(followerId),
      UserId.create(followeeId),
    );
    vi.mocked(connectionRepo.findByFollowerAndFollowee).mockResolvedValue(
      existingConnection,
    );

    const command = new FollowMemberCommand(followerId, followeeId);

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    await expect(handler.execute(command)).rejects.toThrow(
      'Follow request already exists',
    );
  });

  it('should check block status before creating connection', async () => {
    const command = new FollowMemberCommand(followerId, followeeId);

    await handler.execute(command);

    expect(blockRepo.isBlocked).toHaveBeenCalledTimes(1);
    // Verify isBlocked was called before save
    const isBlockedOrder = vi.mocked(blockRepo.isBlocked).mock.invocationCallOrder[0];
    const saveOrder = vi.mocked(connectionRepo.save).mock.invocationCallOrder[0];
    expect(isBlockedOrder).toBeLessThan(saveOrder);
  });

  it('should generate a new connection ID', async () => {
    const command = new FollowMemberCommand(followerId, followeeId);

    await handler.execute(command);

    expect(connectionRepo.nextId).toHaveBeenCalledTimes(1);
  });

  it('should return a ConnectionResponseDto with all fields populated', async () => {
    const command = new FollowMemberCommand(followerId, followeeId);

    const result = await handler.execute(command);

    expect(result.id).toBeDefined();
    expect(result.followerId).toBe(followerId);
    expect(result.followeeId).toBe(followeeId);
    expect(result.status).toBe('PENDING');
    expect(result.createdAt).toBeDefined();
    // Verify createdAt is a valid ISO string
    expect(() => new Date(result.createdAt)).not.toThrow();
    expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
  });

  it('should persist the connection through the repository', async () => {
    const command = new FollowMemberCommand(followerId, followeeId);

    await handler.execute(command);

    expect(connectionRepo.save).toHaveBeenCalledTimes(1);
    const savedConnection = vi.mocked(connectionRepo.save).mock.calls[0][0];
    expect(savedConnection).toBeInstanceOf(Connection);
    expect(savedConnection.followerId.value).toBe(followerId);
    expect(savedConnection.followeeId.value).toBe(followeeId);
  });
});

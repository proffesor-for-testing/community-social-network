import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionController } from '../controllers/connection.controller';
import { FollowMemberHandler } from '../commands/follow-member.handler';
import { UnfollowMemberHandler } from '../commands/unfollow-member.handler';
import { ApproveFollowHandler } from '../commands/approve-follow.handler';
import { RejectFollowHandler } from '../commands/reject-follow.handler';
import { GetFollowersHandler } from '../queries/get-followers.handler';
import { GetFollowingHandler } from '../queries/get-following.handler';
import { GetPendingRequestsHandler } from '../queries/get-pending-requests.handler';
import { ConnectionResponseDto } from '../dto/connection-response.dto';
import { PaginatedConnectionsDto } from '../dto/paginated-connections.dto';

describe('ConnectionController', () => {
  let controller: ConnectionController;
  let followMemberHandler: FollowMemberHandler;
  let unfollowMemberHandler: UnfollowMemberHandler;
  let approveFollowHandler: ApproveFollowHandler;
  let rejectFollowHandler: RejectFollowHandler;
  let getFollowersHandler: GetFollowersHandler;
  let getFollowingHandler: GetFollowingHandler;
  let getPendingRequestsHandler: GetPendingRequestsHandler;

  const currentUserId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const targetUserId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const connectionId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

  beforeEach(() => {
    followMemberHandler = {
      execute: vi.fn(),
    } as unknown as FollowMemberHandler;

    unfollowMemberHandler = {
      execute: vi.fn(),
    } as unknown as UnfollowMemberHandler;

    approveFollowHandler = {
      execute: vi.fn(),
    } as unknown as ApproveFollowHandler;

    rejectFollowHandler = {
      execute: vi.fn(),
    } as unknown as RejectFollowHandler;

    getFollowersHandler = {
      execute: vi.fn(),
    } as unknown as GetFollowersHandler;

    getFollowingHandler = {
      execute: vi.fn(),
    } as unknown as GetFollowingHandler;

    getPendingRequestsHandler = {
      execute: vi.fn(),
    } as unknown as GetPendingRequestsHandler;

    controller = new ConnectionController(
      followMemberHandler,
      unfollowMemberHandler,
      approveFollowHandler,
      rejectFollowHandler,
      getFollowersHandler,
      getFollowingHandler,
      getPendingRequestsHandler,
    );
  });

  describe('follow()', () => {
    it('should delegate to FollowMemberHandler with correct command', async () => {
      const expectedResponse = new ConnectionResponseDto();
      expectedResponse.id = connectionId;
      expectedResponse.followerId = currentUserId;
      expectedResponse.followeeId = targetUserId;
      expectedResponse.status = 'PENDING';
      expectedResponse.createdAt = new Date().toISOString();

      vi.mocked(followMemberHandler.execute).mockResolvedValue(expectedResponse);

      const result = await controller.follow(targetUserId, currentUserId);

      expect(followMemberHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          followerId: currentUserId,
          followeeId: targetUserId,
        }),
      );
      expect(result).toBe(expectedResponse);
    });

    it('should pass through handler errors', async () => {
      vi.mocked(followMemberHandler.execute).mockRejectedValue(
        new Error('Cannot follow yourself'),
      );

      await expect(
        controller.follow(currentUserId, currentUserId),
      ).rejects.toThrow('Cannot follow yourself');
    });
  });

  describe('unfollow()', () => {
    it('should delegate to UnfollowMemberHandler with correct command', async () => {
      vi.mocked(unfollowMemberHandler.execute).mockResolvedValue(undefined);

      await controller.unfollow(targetUserId, currentUserId);

      expect(unfollowMemberHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          followerId: currentUserId,
          followeeId: targetUserId,
        }),
      );
    });
  });

  describe('approveFollow()', () => {
    it('should delegate to ApproveFollowHandler with correct command', async () => {
      const expectedResponse = new ConnectionResponseDto();
      expectedResponse.id = connectionId;
      expectedResponse.status = 'ACCEPTED';

      vi.mocked(approveFollowHandler.execute).mockResolvedValue(expectedResponse);

      const result = await controller.approveFollow(connectionId, currentUserId);

      expect(approveFollowHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId,
          currentUserId,
        }),
      );
      expect(result).toBe(expectedResponse);
    });
  });

  describe('rejectFollow()', () => {
    it('should delegate to RejectFollowHandler with correct command', async () => {
      vi.mocked(rejectFollowHandler.execute).mockResolvedValue(undefined);

      await controller.rejectFollow(connectionId, currentUserId);

      expect(rejectFollowHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId,
          currentUserId,
        }),
      );
    });
  });

  describe('getFollowers()', () => {
    it('should delegate to GetFollowersHandler and return paginated result', async () => {
      const expectedResponse = PaginatedConnectionsDto.create([], 0);

      vi.mocked(getFollowersHandler.execute).mockResolvedValue(expectedResponse);

      const result = await controller.getFollowers(currentUserId);

      expect(getFollowersHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ userId: currentUserId }),
      );
      expect(result).toBe(expectedResponse);
    });

    it('should return followers when they exist', async () => {
      const followerDto = new ConnectionResponseDto();
      followerDto.id = connectionId;
      followerDto.followerId = targetUserId;
      followerDto.followeeId = currentUserId;
      followerDto.status = 'ACCEPTED';
      followerDto.createdAt = new Date().toISOString();

      const expectedResponse = PaginatedConnectionsDto.create([followerDto], 1);

      vi.mocked(getFollowersHandler.execute).mockResolvedValue(expectedResponse);

      const result = await controller.getFollowers(currentUserId);

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].followerId).toBe(targetUserId);
    });
  });

  describe('getFollowing()', () => {
    it('should delegate to GetFollowingHandler and return paginated result', async () => {
      const expectedResponse = PaginatedConnectionsDto.create([], 0);

      vi.mocked(getFollowingHandler.execute).mockResolvedValue(expectedResponse);

      const result = await controller.getFollowing(currentUserId);

      expect(getFollowingHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ userId: currentUserId }),
      );
      expect(result).toBe(expectedResponse);
    });
  });

  describe('getPendingRequests()', () => {
    it('should delegate to GetPendingRequestsHandler and return paginated result', async () => {
      const expectedResponse = PaginatedConnectionsDto.create([], 0);

      vi.mocked(getPendingRequestsHandler.execute).mockResolvedValue(expectedResponse);

      const result = await controller.getPendingRequests(currentUserId);

      expect(getPendingRequestsHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ userId: currentUserId }),
      );
      expect(result).toBe(expectedResponse);
    });

    it('should return pending requests when they exist', async () => {
      const pendingDto = new ConnectionResponseDto();
      pendingDto.id = connectionId;
      pendingDto.followerId = targetUserId;
      pendingDto.followeeId = currentUserId;
      pendingDto.status = 'PENDING';
      pendingDto.createdAt = new Date().toISOString();

      const expectedResponse = PaginatedConnectionsDto.create([pendingDto], 1);

      vi.mocked(getPendingRequestsHandler.execute).mockResolvedValue(expectedResponse);

      const result = await controller.getPendingRequests(currentUserId);

      expect(result.total).toBe(1);
      expect(result.items[0].status).toBe('PENDING');
    });
  });
});

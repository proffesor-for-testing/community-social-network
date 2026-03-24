import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostController } from '../controllers/post.controller';
import { CreatePostCommand } from '../commands/create-post.command';
import { CreatePostResult } from '../commands/create-post.handler';
import { UpdatePostCommand } from '../commands/update-post.command';
import { DeletePostCommand } from '../commands/delete-post.command';
import { GetPostQuery } from '../queries/get-post.query';
import { GetFeedQuery } from '../queries/get-feed.query';
import { FeedResult } from '../queries/get-feed.handler';
import { PostResponseDto } from '../dto/post-response.dto';
import { VisibilityEnum } from '@csn/domain-content';
import { AccessTokenPayload } from '@csn/infra-auth';

describe('PostController', () => {
  let controller: PostController;
  let commandBusExecute: ReturnType<typeof vi.fn>;
  let queryBusExecute: ReturnType<typeof vi.fn>;

  const mockUser: AccessTokenPayload = {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'test@example.com',
    roles: ['member'],
    jti: 'jti-1',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  };

  const mockPostResponse: PostResponseDto = Object.assign(new PostResponseDto(), {
    id: '22222222-2222-2222-2222-222222222222',
    authorId: mockUser.userId,
    content: 'Hello world!',
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    reactionCounts: {},
    commentCount: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  });

  beforeEach(() => {
    commandBusExecute = vi.fn();
    queryBusExecute = vi.fn();

    const commandBus = { execute: commandBusExecute } as any;
    const queryBus = { execute: queryBusExecute } as any;

    controller = new PostController(commandBus, queryBus);
  });

  describe('createPost', () => {
    it('should create a post and return the ID', async () => {
      const postId = '22222222-2222-2222-2222-222222222222';
      commandBusExecute.mockResolvedValue(new CreatePostResult(postId));

      const result = await controller.createPost(mockUser, {
        content: 'Hello world!',
        visibility: VisibilityEnum.PUBLIC,
      });

      expect(result).toEqual({ id: postId });
      expect(commandBusExecute).toHaveBeenCalledOnce();

      const calledCommand = commandBusExecute.mock.calls[0][0] as CreatePostCommand;
      expect(calledCommand.authorId).toBe(mockUser.userId);
      expect(calledCommand.content).toBe('Hello world!');
      expect(calledCommand.visibility).toBe(VisibilityEnum.PUBLIC);
    });

    it('should default visibility to PUBLIC if not provided', async () => {
      const postId = '33333333-3333-3333-3333-333333333333';
      commandBusExecute.mockResolvedValue(new CreatePostResult(postId));

      await controller.createPost(mockUser, {
        content: 'No visibility specified',
      } as any);

      const calledCommand = commandBusExecute.mock.calls[0][0] as CreatePostCommand;
      expect(calledCommand.visibility).toBe(VisibilityEnum.PUBLIC);
    });
  });

  describe('getPost', () => {
    it('should return a post by ID', async () => {
      queryBusExecute.mockResolvedValue(mockPostResponse);

      const result = await controller.getPost(mockPostResponse.id);

      expect(result).toEqual(mockPostResponse);
      expect(queryBusExecute).toHaveBeenCalledOnce();
      const calledQuery = queryBusExecute.mock.calls[0][0];
      expect(calledQuery).toBeInstanceOf(GetPostQuery);
    });

    it('should propagate NotFoundException from query handler', async () => {
      queryBusExecute.mockRejectedValue(
        new NotFoundException('Post not found'),
      );

      await expect(
        controller.getPost('99999999-9999-9999-9999-999999999999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePost', () => {
    it('should execute update command for the post owner', async () => {
      commandBusExecute.mockResolvedValue(undefined);

      await controller.updatePost(mockUser, mockPostResponse.id, {
        content: 'Updated content',
      });

      expect(commandBusExecute).toHaveBeenCalledOnce();
      const calledCommand = commandBusExecute.mock.calls[0][0] as UpdatePostCommand;
      expect(calledCommand.postId).toBe(mockPostResponse.id);
      expect(calledCommand.requesterId).toBe(mockUser.userId);
      expect(calledCommand.content).toBe('Updated content');
    });

    it('should propagate ForbiddenException when non-owner tries to update', async () => {
      commandBusExecute.mockRejectedValue(
        new ForbiddenException('You can only edit your own posts'),
      );

      await expect(
        controller.updatePost(mockUser, mockPostResponse.id, {
          content: 'Hacked!',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deletePost', () => {
    it('should execute delete command for the post owner', async () => {
      commandBusExecute.mockResolvedValue(undefined);

      await controller.deletePost(mockUser, mockPostResponse.id);

      expect(commandBusExecute).toHaveBeenCalledOnce();
      const calledCommand = commandBusExecute.mock.calls[0][0] as DeletePostCommand;
      expect(calledCommand.postId).toBe(mockPostResponse.id);
      expect(calledCommand.requesterId).toBe(mockUser.userId);
    });
  });

  describe('getFeed', () => {
    it('should return a feed with cursor pagination', async () => {
      const feedResult = new FeedResult([mockPostResponse], null, false);
      queryBusExecute.mockResolvedValue(feedResult);

      const result = await controller.getFeed(mockUser, { limit: 20 });

      expect(result).toEqual(feedResult);
      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('should pass cursor through to query', async () => {
      const feedResult = new FeedResult([], null, false);
      queryBusExecute.mockResolvedValue(feedResult);

      await controller.getFeed(mockUser, {
        cursor: '44444444-4444-4444-4444-444444444444',
        limit: 10,
      });

      const calledQuery = queryBusExecute.mock.calls[0][0] as GetFeedQuery;
      expect(calledQuery.userId).toBe(mockUser.userId);
      expect(calledQuery.cursor).toBe('44444444-4444-4444-4444-444444444444');
      expect(calledQuery.limit).toBe(10);
    });
  });
});

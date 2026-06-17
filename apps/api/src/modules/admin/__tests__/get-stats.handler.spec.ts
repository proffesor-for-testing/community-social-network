import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAdminStatsHandler } from '../queries/get-stats.handler';

function makeCountingRepo(initial: number[]) {
  // Each `count()` call dequeues the next value, letting tests assert order.
  const queue = [...initial];
  return {
    count: vi.fn(async () => queue.shift() ?? 0),
  };
}

describe('GetAdminStatsHandler', () => {
  let memberRepo: ReturnType<typeof makeCountingRepo>;
  let publicationRepo: ReturnType<typeof makeCountingRepo>;
  let reactionRepo: ReturnType<typeof makeCountingRepo>;
  let groupRepo: ReturnType<typeof makeCountingRepo>;

  beforeEach(() => {
    // Arrange shared: each repo will be wired with its own count() queue.
    memberRepo = makeCountingRepo([]);
    publicationRepo = makeCountingRepo([]);
    reactionRepo = makeCountingRepo([]);
    groupRepo = makeCountingRepo([]);
  });

  it('should return totalUsers from the member repository', async () => {
    // Arrange — first member.count() is total, second is active, third is today
    memberRepo = makeCountingRepo([42, 30, 3]);
    publicationRepo = makeCountingRepo([100, 5]);
    reactionRepo = makeCountingRepo([900]);
    groupRepo = makeCountingRepo([7]);
    const handler = new GetAdminStatsHandler(
      memberRepo as never,
      publicationRepo as never,
      reactionRepo as never,
      groupRepo as never,
    );

    // Act
    const result = await handler.execute();

    // Assert
    expect(result.totalUsers).toBe(42);
  });

  it('should report activeUsers as the count of members with status ACTIVE', async () => {
    // Arrange
    memberRepo = makeCountingRepo([42, 30, 3]);
    publicationRepo = makeCountingRepo([100, 5]);
    reactionRepo = makeCountingRepo([900]);
    groupRepo = makeCountingRepo([7]);
    const handler = new GetAdminStatsHandler(
      memberRepo as never,
      publicationRepo as never,
      reactionRepo as never,
      groupRepo as never,
    );

    // Act
    const result = await handler.execute();

    // Assert
    expect(result.activeUsers).toBe(30);
  });

  it('should report totalPosts from the publication repository', async () => {
    // Arrange
    memberRepo = makeCountingRepo([1, 1, 0]);
    publicationRepo = makeCountingRepo([55, 2]);
    reactionRepo = makeCountingRepo([0]);
    groupRepo = makeCountingRepo([0]);
    const handler = new GetAdminStatsHandler(
      memberRepo as never,
      publicationRepo as never,
      reactionRepo as never,
      groupRepo as never,
    );

    // Act
    const result = await handler.execute();

    // Assert
    expect(result.totalPosts).toBe(55);
  });

  it('should report totalReactions from the reaction repository', async () => {
    // Arrange
    memberRepo = makeCountingRepo([1, 1, 0]);
    publicationRepo = makeCountingRepo([1, 0]);
    reactionRepo = makeCountingRepo([1234]);
    groupRepo = makeCountingRepo([0]);
    const handler = new GetAdminStatsHandler(
      memberRepo as never,
      publicationRepo as never,
      reactionRepo as never,
      groupRepo as never,
    );

    // Act
    const result = await handler.execute();

    // Assert
    expect(result.totalReactions).toBe(1234);
  });

  it('should return zeros when every repository is empty', async () => {
    // Arrange — empty queues default to 0
    const handler = new GetAdminStatsHandler(
      memberRepo as never,
      publicationRepo as never,
      reactionRepo as never,
      groupRepo as never,
    );

    // Act
    const result = await handler.execute();

    // Assert
    expect(result).toEqual({
      totalUsers: 0,
      activeUsers: 0,
      totalPosts: 0,
      totalGroups: 0,
      totalReactions: 0,
      newUsersToday: 0,
      newPostsToday: 0,
    });
  });

  it('should ask the member repo for "ACTIVE" status when computing activeUsers', async () => {
    // Arrange
    memberRepo = makeCountingRepo([10, 8, 1]);
    publicationRepo = makeCountingRepo([0, 0]);
    reactionRepo = makeCountingRepo([0]);
    groupRepo = makeCountingRepo([0]);
    const handler = new GetAdminStatsHandler(
      memberRepo as never,
      publicationRepo as never,
      reactionRepo as never,
      groupRepo as never,
    );

    // Act
    await handler.execute();

    // Assert — second call (index 1) is the active count, with the status filter
    const activeCallArg = memberRepo.count.mock.calls[1]?.[0];
    expect(activeCallArg).toMatchObject({ where: { status: 'ACTIVE' } });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { UserId } from '@csn/domain-shared';
import {
  Connection,
  ConnectionId,
  ConnectionStatusEnum,
} from '@csn/domain-social-graph';
import { InMemoryConnectionRepository } from '../repositories/in-memory-connection.repository';

describe('InMemoryConnectionRepository', () => {
  let repository: InMemoryConnectionRepository;

  beforeEach(() => {
    repository = new InMemoryConnectionRepository();
  });

  const createConnection = (
    followerId?: UserId,
    followeeId?: UserId,
  ): Connection => {
    const id = repository.nextId();
    return Connection.request(
      id,
      followerId ?? UserId.generate(),
      followeeId ?? UserId.generate(),
    );
  };

  describe('nextId()', () => {
    it('should generate a unique ConnectionId', () => {
      const id1 = repository.nextId();
      const id2 = repository.nextId();

      expect(id1.value).not.toBe(id2.value);
    });

    it('should return a valid ConnectionId', () => {
      const id = repository.nextId();

      expect(id).toBeInstanceOf(ConnectionId);
      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('save() and findById()', () => {
    it('should save and retrieve a connection', async () => {
      const connection = createConnection();

      await repository.save(connection);
      const found = await repository.findById(connection.id);

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(connection.id.value);
      expect(found!.followerId.value).toBe(connection.followerId.value);
      expect(found!.followeeId.value).toBe(connection.followeeId.value);
      expect(found!.status.value).toBe(ConnectionStatusEnum.PENDING);
    });

    it('should return null for non-existent id', async () => {
      const id = ConnectionId.generate();

      const found = await repository.findById(id);

      expect(found).toBeNull();
    });

    it('should overwrite on re-save', async () => {
      const connection = createConnection();
      await repository.save(connection);

      connection.approve();
      await repository.save(connection);

      const found = await repository.findById(connection.id);
      expect(found!.status.value).toBe(ConnectionStatusEnum.ACCEPTED);
    });
  });

  describe('exists()', () => {
    it('should return true for existing connection', async () => {
      const connection = createConnection();
      await repository.save(connection);

      const result = await repository.exists(connection.id);

      expect(result).toBe(true);
    });

    it('should return false for non-existent connection', async () => {
      const result = await repository.exists(ConnectionId.generate());

      expect(result).toBe(false);
    });
  });

  describe('delete()', () => {
    it('should remove a connection', async () => {
      const connection = createConnection();
      await repository.save(connection);

      await repository.delete(connection);

      const found = await repository.findById(connection.id);
      expect(found).toBeNull();
    });
  });

  describe('findByFollowerAndFollowee()', () => {
    it('should find connection by follower and followee', async () => {
      const followerId = UserId.generate();
      const followeeId = UserId.generate();
      const connection = createConnection(followerId, followeeId);
      await repository.save(connection);

      const found = await repository.findByFollowerAndFollowee(
        followerId,
        followeeId,
      );

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(connection.id.value);
    });

    it('should return null when no matching connection', async () => {
      const found = await repository.findByFollowerAndFollowee(
        UserId.generate(),
        UserId.generate(),
      );

      expect(found).toBeNull();
    });

    it('should not match reversed follower/followee', async () => {
      const followerId = UserId.generate();
      const followeeId = UserId.generate();
      const connection = createConnection(followerId, followeeId);
      await repository.save(connection);

      const found = await repository.findByFollowerAndFollowee(
        followeeId,
        followerId,
      );

      expect(found).toBeNull();
    });
  });

  describe('findFollowers()', () => {
    it('should find all followers for a user', async () => {
      const targetUser = UserId.generate();
      const follower1 = UserId.generate();
      const follower2 = UserId.generate();

      await repository.save(createConnection(follower1, targetUser));
      await repository.save(createConnection(follower2, targetUser));
      await repository.save(createConnection(targetUser, UserId.generate()));

      const followers = await repository.findFollowers(targetUser);

      expect(followers).toHaveLength(2);
      const followerIds = followers.map((c) => c.followerId.value);
      expect(followerIds).toContain(follower1.value);
      expect(followerIds).toContain(follower2.value);
    });

    it('should return empty array when no followers', async () => {
      const followers = await repository.findFollowers(UserId.generate());

      expect(followers).toHaveLength(0);
    });
  });

  describe('findFollowing()', () => {
    it('should find all users being followed', async () => {
      const sourceUser = UserId.generate();
      const following1 = UserId.generate();
      const following2 = UserId.generate();

      await repository.save(createConnection(sourceUser, following1));
      await repository.save(createConnection(sourceUser, following2));
      await repository.save(createConnection(UserId.generate(), sourceUser));

      const following = await repository.findFollowing(sourceUser);

      expect(following).toHaveLength(2);
      const followeeIds = following.map((c) => c.followeeId.value);
      expect(followeeIds).toContain(following1.value);
      expect(followeeIds).toContain(following2.value);
    });

    it('should return empty array when not following anyone', async () => {
      const following = await repository.findFollowing(UserId.generate());

      expect(following).toHaveLength(0);
    });
  });

  describe('countFollowers()', () => {
    it('should count followers correctly', async () => {
      const targetUser = UserId.generate();
      await repository.save(createConnection(UserId.generate(), targetUser));
      await repository.save(createConnection(UserId.generate(), targetUser));

      const count = await repository.countFollowers(targetUser);

      expect(count).toBe(2);
    });

    it('should return 0 when no followers', async () => {
      const count = await repository.countFollowers(UserId.generate());

      expect(count).toBe(0);
    });
  });

  describe('countFollowing()', () => {
    it('should count following correctly', async () => {
      const sourceUser = UserId.generate();
      await repository.save(createConnection(sourceUser, UserId.generate()));
      await repository.save(createConnection(sourceUser, UserId.generate()));
      await repository.save(createConnection(sourceUser, UserId.generate()));

      const count = await repository.countFollowing(sourceUser);

      expect(count).toBe(3);
    });

    it('should return 0 when not following anyone', async () => {
      const count = await repository.countFollowing(UserId.generate());

      expect(count).toBe(0);
    });
  });

  describe('clear()', () => {
    it('should remove all stored entities', async () => {
      await repository.save(createConnection());
      await repository.save(createConnection());

      repository.clear();

      const found = await repository.findFollowers(UserId.generate());
      expect(found).toHaveLength(0);
    });
  });
});

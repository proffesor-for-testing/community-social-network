import { describe, it, expect, beforeEach } from 'vitest';
import { UserId, Email, Timestamp } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  PublicationContent,
  PublicationStatus,
  Visibility,
  GroupId,
  FeedCursor,
} from '@csn/domain-content';
import { Profile, ProfileId, DisplayName } from '@csn/domain-profile';
import { InMemoryPublicationRepository } from '@csn/infra-content';
import { InMemoryConnectionRepository } from '@csn/infra-social-graph';
import { Connection, ConnectionId } from '@csn/domain-social-graph';
import { GetFeedHandler } from '../queries/get-feed.handler';
import { GetFeedQuery } from '../queries/get-feed.query';

interface PostOptions {
  author: UserId;
  text?: string;
  createdAt?: Date;
  groupId?: GroupId | null;
  id?: PublicationId;
}

/**
 * Builds a persisted-shaped Publication so tests control createdAt (the feed
 * orders by it) without relying on wall-clock ordering.
 */
function makePublication(options: PostOptions): Publication {
  const createdAt = Timestamp.fromDate(
    options.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
  );
  return Publication.reconstitute(
    options.id ?? PublicationId.generate(),
    options.author,
    PublicationContent.create(options.text ?? 'Hello'),
    Visibility.PUBLIC,
    PublicationStatus.PUBLISHED,
    [],
    [],
    new Map<string, number>(),
    createdAt,
    createdAt,
    1,
    options.groupId ?? null,
  );
}

function makeProfile(memberId: UserId, name: string): Profile {
  return Profile.create(
    ProfileId.generate(),
    memberId,
    DisplayName.create(name),
    Email.create(`${name.toLowerCase().replace(/\s+/g, '.')}@test.local`),
  );
}

class StubDiscussionRepo {
  public calls: string[][] = [];
  constructor(private readonly counts: Map<string, number> = new Map()) {}
  async countActiveByPublicationIds(ids: PublicationId[]): Promise<Map<string, number>> {
    this.calls.push(ids.map((i) => i.value));
    return this.counts;
  }
}

class StubProfileRepo {
  public calls: UserId[][] = [];
  constructor(private readonly profiles: Map<string, Profile>) {}
  async findByMemberIds(ids: UserId[]): Promise<Map<string, Profile>> {
    this.calls.push(ids);
    const out = new Map<string, Profile>();
    for (const id of ids) {
      const p = this.profiles.get(id.value);
      if (p) out.set(id.value, p);
    }
    return out;
  }
}

class StubViewerReactions {
  public calls: { ids: string[]; viewer?: string | null }[] = [];
  constructor(private readonly map: Map<string, string> = new Map()) {}
  async findByViewer(ids: string[], viewer?: string | null): Promise<Map<string, string>> {
    this.calls.push({ ids, viewer });
    return this.map;
  }
}

describe('GetFeedHandler', () => {
  let viewer: UserId;
  let followee: UserId;
  let stranger: UserId;
  let publications: InMemoryPublicationRepository;
  let connections: InMemoryConnectionRepository;
  let profiles: Map<string, Profile>;

  function buildHandler(overrides: {
    profileRepo?: StubProfileRepo;
    discussionRepo?: StubDiscussionRepo;
    viewerReactions?: StubViewerReactions;
  } = {}): GetFeedHandler {
    return new GetFeedHandler(
      publications as never,
      (overrides.profileRepo ?? new StubProfileRepo(profiles)) as never,
      (overrides.discussionRepo ?? new StubDiscussionRepo()) as never,
      overrides.viewerReactions as never,
      connections as never,
    );
  }

  async function follow(
    follower: UserId,
    followee_: UserId,
    approve = true,
  ): Promise<void> {
    const connection = Connection.request(
      ConnectionId.create(crypto.randomUUID()),
      follower,
      followee_,
    );
    if (approve) {
      connection.approve();
    }
    await connections.save(connection);
  }

  beforeEach(() => {
    viewer = UserId.generate();
    followee = UserId.generate();
    stranger = UserId.generate();
    publications = new InMemoryPublicationRepository();
    connections = new InMemoryConnectionRepository();
    profiles = new Map<string, Profile>([
      [viewer.value, makeProfile(viewer, 'Vera Viewer')],
      [followee.value, makeProfile(followee, 'Fred Followee')],
      [stranger.value, makeProfile(stranger, 'Sam Stranger')],
    ]);
  });

  describe('follower scoping', () => {
    it('should include posts authored by the viewer', async () => {
      // Arrange
      const own = makePublication({ author: viewer, text: 'mine' });
      await publications.save(own);

      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items.map((i) => i.id)).toEqual([own.id.value]);
    });

    it('should include posts authored by an accepted followee', async () => {
      // Arrange
      const theirs = makePublication({ author: followee, text: 'theirs' });
      await publications.save(theirs);
      await follow(viewer, followee);

      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items.map((i) => i.id)).toEqual([theirs.id.value]);
    });

    it('should exclude posts by members the viewer does not follow', async () => {
      // Arrange
      await publications.save(makePublication({ author: stranger, text: 'noise' }));

      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items).toEqual([]);
    });

    it('should exclude posts by a followee whose connection is still PENDING', async () => {
      // Arrange
      await publications.save(makePublication({ author: followee, text: 'pending' }));
      await follow(viewer, followee, false);

      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items).toEqual([]);
    });

    it('should return only the viewer own posts when they follow nobody', async () => {
      // Arrange
      const own = makePublication({ author: viewer, text: 'solo' });
      await publications.save(own);
      await publications.save(makePublication({ author: stranger, text: 'noise' }));

      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items.map((i) => i.id)).toEqual([own.id.value]);
    });

    it('should return an empty feed for a viewer with no posts and no followees', async () => {
      // Arrange
      await publications.save(makePublication({ author: stranger }));

      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items).toHaveLength(0);
    });

    it('should exclude a followee post that belongs to a group', async () => {
      // Arrange
      await follow(viewer, followee);
      await publications.save(
        makePublication({
          author: followee,
          text: 'group only',
          groupId: GroupId.generate(),
        }),
      );

      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items).toEqual([]);
    });

    it('should exclude the viewer own group post from their main feed', async () => {
      // Arrange
      await publications.save(
        makePublication({ author: viewer, groupId: GroupId.generate() }),
      );

      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items).toEqual([]);
    });
  });

  describe('ordering and cursor pagination', () => {
    beforeEach(async () => {
      // Arrange (shared): three own posts, oldest to newest
      await publications.save(
        makePublication({
          author: viewer,
          text: 'oldest',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      );
      await publications.save(
        makePublication({
          author: viewer,
          text: 'middle',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        }),
      );
      await publications.save(
        makePublication({
          author: viewer,
          text: 'newest',
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
        }),
      );
    });

    it('should return the newest post first', async () => {
      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items[0]!.content).toBe('newest');
    });

    it('should cap the page at the requested limit', async () => {
      // Act
      const result = await buildHandler().execute(
        new GetFeedQuery(viewer.value, undefined, 2),
      );

      // Assert
      expect(result.items).toHaveLength(2);
    });

    it('should report hasMore when further posts remain', async () => {
      // Act
      const result = await buildHandler().execute(
        new GetFeedQuery(viewer.value, undefined, 2),
      );

      // Assert
      expect(result.hasMore).toBe(true);
    });

    it('should return the remaining post on the page after the cursor', async () => {
      // Arrange
      const first = await buildHandler().execute(
        new GetFeedQuery(viewer.value, undefined, 2),
      );

      // Act
      const second = await buildHandler().execute(
        new GetFeedQuery(viewer.value, first.nextCursor!, 2),
      );

      // Assert
      expect(second.items.map((i) => i.content)).toEqual(['oldest']);
    });

    it('should report hasMore false on the final page', async () => {
      // Arrange
      const first = await buildHandler().execute(
        new GetFeedQuery(viewer.value, undefined, 2),
      );

      // Act
      const second = await buildHandler().execute(
        new GetFeedQuery(viewer.value, first.nextCursor!, 2),
      );

      // Assert
      expect(second.hasMore).toBe(false);
    });

    it('should return a null nextCursor when the page is the last one', async () => {
      // Act
      const result = await buildHandler().execute(
        new GetFeedQuery(viewer.value, undefined, 20),
      );

      // Assert
      expect(result.nextCursor).toBeNull();
    });

    it('should encode nextCursor from the last item createdAt and id', async () => {
      // Act
      const result = await buildHandler().execute(
        new GetFeedQuery(viewer.value, undefined, 2),
      );

      // Assert
      const last = result.items[result.items.length - 1]!;
      expect(FeedCursor.decode(result.nextCursor)!.id).toBe(last.id);
    });

    it('should treat an unparsable cursor as the start of the feed', async () => {
      // Act
      const result = await buildHandler().execute(
        new GetFeedQuery(viewer.value, 'not-a-real-cursor', 20),
      );

      // Assert
      expect(result.items).toHaveLength(3);
    });

    it('should not repeat a post across pages when two posts share a timestamp', async () => {
      // Arrange — two extra posts created in the same millisecond
      const sameInstant = new Date('2026-02-01T00:00:00.000Z');
      await publications.save(
        makePublication({ author: viewer, text: 'tie-a', createdAt: sameInstant }),
      );
      await publications.save(
        makePublication({ author: viewer, text: 'tie-b', createdAt: sameInstant }),
      );

      // Act
      const first = await buildHandler().execute(
        new GetFeedQuery(viewer.value, undefined, 1),
      );
      const second = await buildHandler().execute(
        new GetFeedQuery(viewer.value, first.nextCursor!, 1),
      );

      // Assert
      expect(second.items[0]!.id).not.toBe(first.items[0]!.id);
    });
  });

  describe('author enrichment', () => {
    beforeEach(async () => {
      await follow(viewer, followee);
      await publications.save(
        makePublication({
          author: followee,
          text: 'B',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      );
      await publications.save(
        makePublication({
          author: viewer,
          text: 'A',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        }),
      );
    });

    it('should populate authorName from the Profile aggregate for every item', async () => {
      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items.map((p) => p.authorName)).toEqual([
        'Vera Viewer',
        'Fred Followee',
      ]);
    });

    it('should fall back to "Member" when the author has no Profile row', async () => {
      // Arrange
      profiles.delete(followee.value);

      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items[1]!.authorName).toBe('Member');
    });

    it('should issue exactly one batch profile lookup for the page (no N+1)', async () => {
      // Arrange
      const profileRepo = new StubProfileRepo(profiles);

      // Act
      await buildHandler({ profileRepo }).execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(profileRepo.calls).toHaveLength(1);
    });

    it('should deduplicate author ids in the batch lookup', async () => {
      // Arrange — a second post from the same author
      await publications.save(
        makePublication({
          author: viewer,
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
        }),
      );
      const profileRepo = new StubProfileRepo(profiles);

      // Act
      await buildHandler({ profileRepo }).execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(profileRepo.calls[0]).toHaveLength(2);
    });
  });

  describe('empty page short-circuits', () => {
    it('should not call the profile repo when the page is empty', async () => {
      // Arrange
      const profileRepo = new StubProfileRepo(profiles);

      // Act
      await buildHandler({ profileRepo }).execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(profileRepo.calls).toHaveLength(0);
    });

    it('should not query comment counts for an empty page', async () => {
      // Arrange
      const discussionRepo = new StubDiscussionRepo();

      // Act
      await buildHandler({ discussionRepo }).execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(discussionRepo.calls).toHaveLength(0);
    });
  });

  describe('viewerReaction enrichment', () => {
    let ownPost: Publication;

    beforeEach(async () => {
      ownPost = makePublication({ author: viewer, text: '1' });
      await publications.save(ownPost);
    });

    it('should set viewerReaction from the viewer lookup', async () => {
      // Arrange
      const viewerReactions = new StubViewerReactions(
        new Map([[ownPost.id.value, 'LIKE']]),
      );

      // Act
      const result = await buildHandler({ viewerReactions }).execute(
        new GetFeedQuery(viewer.value),
      );

      // Assert
      expect(result.items[0]!.viewerReaction).toBe('LIKE');
    });

    it('should look up viewer reactions once for the page, scoped to the requester', async () => {
      // Arrange
      const viewerReactions = new StubViewerReactions();

      // Act
      await buildHandler({ viewerReactions }).execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(viewerReactions.calls).toEqual([
        { ids: [ownPost.id.value], viewer: viewer.value },
      ]);
    });

    it('should default viewerReaction to null when the lookup service is not wired', async () => {
      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items[0]!.viewerReaction).toBeNull();
    });
  });

  describe('commentCount enrichment', () => {
    let ownPost: Publication;

    beforeEach(async () => {
      ownPost = makePublication({ author: viewer, text: '1' });
      await publications.save(ownPost);
    });

    it('should set commentCount from the batched active-comment count', async () => {
      // Arrange
      const discussionRepo = new StubDiscussionRepo(new Map([[ownPost.id.value, 3]]));

      // Act
      const result = await buildHandler({ discussionRepo }).execute(
        new GetFeedQuery(viewer.value),
      );

      // Assert
      expect(result.items[0]!.commentCount).toBe(3);
    });

    it('should default commentCount to zero for a post with no comments', async () => {
      // Act
      const result = await buildHandler().execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(result.items[0]!.commentCount).toBe(0);
    });

    it('should count comments once for the whole page (no N+1)', async () => {
      // Arrange
      const discussionRepo = new StubDiscussionRepo();

      // Act
      await buildHandler({ discussionRepo }).execute(new GetFeedQuery(viewer.value));

      // Assert
      expect(discussionRepo.calls).toEqual([[ownPost.id.value]]);
    });
  });

  describe('missing collaborators', () => {
    it('should fail loudly when no connection repository was injected', async () => {
      // Arrange
      const handler = new GetFeedHandler(
        publications as never,
        new StubProfileRepo(profiles) as never,
        new StubDiscussionRepo() as never,
      );

      // Act / Assert
      await expect(handler.execute(new GetFeedQuery(viewer.value))).rejects.toThrow(
        /IConnectionRepository/,
      );
    });
  });
});

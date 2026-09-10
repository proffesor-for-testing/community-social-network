import { describe, it, expect, beforeEach } from 'vitest';
import { UserId, Email } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  PublicationContent,
  Visibility,
} from '@csn/domain-content';
import { Profile, ProfileId, DisplayName } from '@csn/domain-profile';
import { GetFeedHandler } from '../queries/get-feed.handler';
import { GetFeedQuery } from '../queries/get-feed.query';

function makePublication(authorId: UserId, text = 'Hello'): Publication {
  return Publication.create(
    PublicationId.generate(),
    authorId,
    PublicationContent.create(text),
    Visibility.PUBLIC,
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

class StubPublicationRepo {
  constructor(private readonly posts: Publication[]) {}
  async findAllPublished(): Promise<Publication[]> {
    return this.posts;
  }
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

describe('GetFeedHandler — author enrichment', () => {
  let alice: UserId;
  let bob: UserId;
  let posts: Publication[];
  let profiles: Map<string, Profile>;

  beforeEach(() => {
    // Arrange (shared)
    alice = UserId.generate();
    bob = UserId.generate();
    posts = [makePublication(alice, 'A'), makePublication(bob, 'B')];
    profiles = new Map<string, Profile>([
      [alice.value, makeProfile(alice, 'Alice Author')],
      [bob.value, makeProfile(bob, 'Bob Writer')],
    ]);
  });

  it('should populate authorName from the Profile aggregate for every item', async () => {
    // Arrange
    const handler = new GetFeedHandler(
      new StubPublicationRepo(posts) as never,
      new StubProfileRepo(profiles) as never,
      new StubDiscussionRepo() as never,
    );

    // Act
    const result = await handler.execute(new GetFeedQuery('viewer-1', undefined, 20));

    // Assert (single behavior: names land on DTOs)
    expect(result.items.map((p) => p.authorName)).toEqual([
      'Alice Author',
      'Bob Writer',
    ]);
  });

  it('should fall back to "Member" when the author has no Profile row', async () => {
    // Arrange — Bob has no profile entry
    profiles.delete(bob.value);
    const handler = new GetFeedHandler(
      new StubPublicationRepo(posts) as never,
      new StubProfileRepo(profiles) as never,
      new StubDiscussionRepo() as never,
    );

    // Act
    const result = await handler.execute(new GetFeedQuery('viewer-1', undefined, 20));

    // Assert
    expect(result.items[1]!.authorName).toBe('Member');
  });

  it('should issue exactly one batch profile lookup, not one per post (no N+1)', async () => {
    // Arrange — five posts, only two unique authors
    const allPosts = [
      makePublication(alice),
      makePublication(bob),
      makePublication(alice),
      makePublication(bob),
      makePublication(alice),
    ];
    const profileRepo = new StubProfileRepo(profiles);
    const handler = new GetFeedHandler(
      new StubPublicationRepo(allPosts) as never,
      profileRepo as never,
      new StubDiscussionRepo() as never,
    );

    // Act
    await handler.execute(new GetFeedQuery('viewer-1', undefined, 20));

    // Assert (boundary: single round-trip)
    expect(profileRepo.calls).toHaveLength(1);
  });

  it('should deduplicate author ids in the batch lookup', async () => {
    // Arrange — three posts from the same author
    const sameAuthorPosts = [
      makePublication(alice),
      makePublication(alice),
      makePublication(alice),
    ];
    const profileRepo = new StubProfileRepo(profiles);
    const handler = new GetFeedHandler(
      new StubPublicationRepo(sameAuthorPosts) as never,
      profileRepo as never,
      new StubDiscussionRepo() as never,
    );

    // Act
    await handler.execute(new GetFeedQuery('viewer-1', undefined, 20));

    // Assert
    expect(profileRepo.calls[0]).toHaveLength(1);
  });

  it('should not call the profile repo when the page is empty', async () => {
    // Arrange
    const profileRepo = new StubProfileRepo(profiles);
    const handler = new GetFeedHandler(
      new StubPublicationRepo([]) as never,
      profileRepo as never,
      new StubDiscussionRepo() as never,
    );

    // Act
    const result = await handler.execute(new GetFeedQuery('viewer-1', undefined, 20));

    // Assert
    expect(profileRepo.calls).toHaveLength(0);
    expect(result.items).toEqual([]);
  });

  it('should return nextCursor as a string id (not a value object) when there are more items', async () => {
    // Arrange — three posts but limit 2 ⇒ cursor should point at the 2nd post's id
    const id1 = PublicationId.generate();
    const id2 = PublicationId.generate();
    const id3 = PublicationId.generate();
    const allPosts = [
      Publication.create(id1, alice, PublicationContent.create('1'), Visibility.PUBLIC),
      Publication.create(id2, alice, PublicationContent.create('2'), Visibility.PUBLIC),
      Publication.create(id3, alice, PublicationContent.create('3'), Visibility.PUBLIC),
    ];
    const handler = new GetFeedHandler(
      new StubPublicationRepo(allPosts) as never,
      new StubProfileRepo(profiles) as never,
      new StubDiscussionRepo() as never,
    );

    // Act
    const result = await handler.execute(new GetFeedQuery('viewer-1', undefined, 2));

    // Assert
    expect(result.hasMore).toBe(true);
    expect(typeof result.nextCursor).toBe('string');
    expect(result.nextCursor).toBe(id2.value);
  });

  describe('viewerReaction enrichment', () => {
    class StubViewerReactions {
      public calls: { ids: string[]; viewer?: string | null }[] = [];
      constructor(private readonly map: Map<string, string>) {}
      async findByViewer(ids: string[], viewer?: string | null): Promise<Map<string, string>> {
        this.calls.push({ ids, viewer });
        return this.map;
      }
    }

    it('should set viewerReaction from the viewer lookup for each post', async () => {
      // Arrange
      const p1 = Publication.create(PublicationId.generate(), alice, PublicationContent.create('1'), Visibility.PUBLIC);
      const p2 = Publication.create(PublicationId.generate(), alice, PublicationContent.create('2'), Visibility.PUBLIC);
      const lookup = new StubViewerReactions(new Map([[p1.id.value, 'LIKE']]));
      const handler = new GetFeedHandler(
        new StubPublicationRepo([p1, p2]) as never,
        new StubProfileRepo(profiles) as never,
        new StubDiscussionRepo() as never,
        lookup as never,
      );

      // Act
      const result = await handler.execute(new GetFeedQuery('viewer-1'));

      // Assert
      expect(result.items.map((i) => i.viewerReaction)).toEqual(['LIKE', null]);
    });

    it('should look up viewer reactions once for the whole page, scoped to the requesting user', async () => {
      // Arrange
      const lookup = new StubViewerReactions(new Map());
      const handler = new GetFeedHandler(
        new StubPublicationRepo(posts) as never,
        new StubProfileRepo(profiles) as never,
        new StubDiscussionRepo() as never,
        lookup as never,
      );

      // Act
      await handler.execute(new GetFeedQuery('viewer-1'));

      // Assert
      expect(lookup.calls).toHaveLength(1);
      expect(lookup.calls[0]!.viewer).toBe('viewer-1');
      expect(lookup.calls[0]!.ids).toEqual(posts.map((p) => p.id.value));
    });

    it('should default viewerReaction to null when the lookup service is not wired', async () => {
      // Arrange
      const handler = new GetFeedHandler(
        new StubPublicationRepo(posts) as never,
        new StubProfileRepo(profiles) as never,
      new StubDiscussionRepo() as never,
      );

      // Act
      const result = await handler.execute(new GetFeedQuery('viewer-1'));

      // Assert
      expect(result.items.every((i) => i.viewerReaction === null)).toBe(true);
    });
  });

  describe('commentCount enrichment', () => {
    it('should set commentCount from the batched active-comment count', async () => {
      // Arrange
      const p1 = Publication.create(PublicationId.generate(), alice, PublicationContent.create('1'), Visibility.PUBLIC);
      const p2 = Publication.create(PublicationId.generate(), alice, PublicationContent.create('2'), Visibility.PUBLIC);
      const discussions = new StubDiscussionRepo(new Map([[p1.id.value, 3]]));
      const handler = new GetFeedHandler(
        new StubPublicationRepo([p1, p2]) as never,
        new StubProfileRepo(profiles) as never,
        discussions as never,
      );

      // Act
      const result = await handler.execute(new GetFeedQuery('viewer-1'));

      // Assert
      expect(result.items.map((i) => i.commentCount)).toEqual([3, 0]);
    });

    it('should count comments once for the whole page (no N+1)', async () => {
      // Arrange
      const discussions = new StubDiscussionRepo();
      const handler = new GetFeedHandler(
        new StubPublicationRepo(posts) as never,
        new StubProfileRepo(profiles) as never,
        discussions as never,
      );

      // Act
      await handler.execute(new GetFeedQuery('viewer-1'));

      // Assert
      expect(discussions.calls).toHaveLength(1);
      expect(discussions.calls[0]).toEqual(posts.map((p) => p.id.value));
    });

    it('should not query comment counts for an empty page', async () => {
      // Arrange
      const discussions = new StubDiscussionRepo();
      const handler = new GetFeedHandler(
        new StubPublicationRepo([]) as never,
        new StubProfileRepo(profiles) as never,
        discussions as never,
      );

      // Act
      await handler.execute(new GetFeedQuery('viewer-1'));

      // Assert
      expect(discussions.calls).toHaveLength(0);
    });
  });
});

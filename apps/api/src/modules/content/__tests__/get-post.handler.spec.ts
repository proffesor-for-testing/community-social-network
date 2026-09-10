import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UserId, Email } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  PublicationContent,
  Visibility,
} from '@csn/domain-content';
import { Profile, ProfileId, DisplayName } from '@csn/domain-profile';
import { GetPostHandler } from '../queries/get-post.handler';
import { GetPostQuery } from '../queries/get-post.query';

function makePublication(authorId: UserId, postId?: PublicationId): Publication {
  return Publication.create(
    postId ?? PublicationId.generate(),
    authorId,
    PublicationContent.create('body'),
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
  constructor(private readonly post: Publication | null) {}
  async findById(): Promise<Publication | null> {
    return this.post;
  }
}

class StubDiscussionRepo {
  constructor(private readonly count = 0) {}
  async findByPublicationId(): Promise<unknown[]> {
    return [];
  }
  async countActiveByPublicationIds(ids: PublicationId[]): Promise<Map<string, number>> {
    return new Map(ids.map((id) => [id.value, this.count]));
  }
}

class StubProfileRepo {
  public memberCalls: UserId[] = [];
  constructor(private readonly profile: Profile | null) {}
  async findByMemberId(id: UserId): Promise<Profile | null> {
    this.memberCalls.push(id);
    return this.profile;
  }
  async findByMemberIds(): Promise<Map<string, Profile>> {
    return new Map();
  }
}

describe('GetPostHandler — author enrichment', () => {
  let alice: UserId;
  let publication: Publication;

  beforeEach(() => {
    // Arrange (shared)
    alice = UserId.generate();
    publication = makePublication(alice);
  });

  it('should throw NotFoundException when the post does not exist', async () => {
    // Arrange
    const handler = new GetPostHandler(
      new StubPublicationRepo(null) as never,
      new StubDiscussionRepo() as never,
      new StubProfileRepo(null) as never,
    );

    // Act + Assert
    await expect(
      handler.execute(new GetPostQuery(PublicationId.generate().value)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should populate authorName from the Profile aggregate when present', async () => {
    // Arrange
    const profile = makeProfile(alice, 'Alice Author');
    const handler = new GetPostHandler(
      new StubPublicationRepo(publication) as never,
      new StubDiscussionRepo() as never,
      new StubProfileRepo(profile) as never,
    );

    // Act
    const result = await handler.execute(new GetPostQuery(publication.id.value));

    // Assert
    expect(result.authorName).toBe('Alice Author');
  });

  it('should fall back to "Member" when the author has no Profile row', async () => {
    // Arrange
    const handler = new GetPostHandler(
      new StubPublicationRepo(publication) as never,
      new StubDiscussionRepo() as never,
      new StubProfileRepo(null) as never,
    );

    // Act
    const result = await handler.execute(new GetPostQuery(publication.id.value));

    // Assert
    expect(result.authorName).toBe('Member');
  });

  it('should look up the author profile by the publication.authorId', async () => {
    // Arrange
    const profileRepo = new StubProfileRepo(makeProfile(alice, 'Alice'));
    const handler = new GetPostHandler(
      new StubPublicationRepo(publication) as never,
      new StubDiscussionRepo() as never,
      profileRepo as never,
    );

    // Act
    await handler.execute(new GetPostQuery(publication.id.value));

    // Assert
    expect(profileRepo.memberCalls.map((u) => u.value)).toEqual([alice.value]);
  });

  describe('viewerReaction enrichment', () => {
    it('should set viewerReaction for the requesting viewer', async () => {
      // Arrange
      const lookup = {
        findByViewer: async () => new Map([[publication.id.value, 'WOW']]),
      };
      const handler = new GetPostHandler(
        new StubPublicationRepo(publication) as never,
        new StubDiscussionRepo() as never,
        new StubProfileRepo(null) as never,
        lookup as never,
      );

      // Act
      const result = await handler.execute(new GetPostQuery(publication.id.value, 'viewer-1'));

      // Assert
      expect(result.viewerReaction).toBe('WOW');
    });

    it('should pass the viewer id from the query into the lookup', async () => {
      // Arrange
      const seen: unknown[] = [];
      const lookup = {
        findByViewer: async (_ids: string[], viewer?: string) => {
          seen.push(viewer);
          return new Map();
        },
      };
      const handler = new GetPostHandler(
        new StubPublicationRepo(publication) as never,
        new StubDiscussionRepo() as never,
        new StubProfileRepo(null) as never,
        lookup as never,
      );

      // Act
      await handler.execute(new GetPostQuery(publication.id.value, 'viewer-9'));

      // Assert
      expect(seen).toEqual(['viewer-9']);
    });

    it('should return viewerReaction null for an anonymous viewer', async () => {
      // Arrange
      const lookup = { findByViewer: async () => new Map() };
      const handler = new GetPostHandler(
        new StubPublicationRepo(publication) as never,
        new StubDiscussionRepo() as never,
        new StubProfileRepo(null) as never,
        lookup as never,
      );

      // Act
      const result = await handler.execute(new GetPostQuery(publication.id.value));

      // Assert
      expect(result.viewerReaction).toBeNull();
    });
  });

  describe('commentCount', () => {
    it('should report the active comment count for the post', async () => {
      // Arrange
      const handler = new GetPostHandler(
        new StubPublicationRepo(publication) as never,
        new StubDiscussionRepo(4) as never,
        new StubProfileRepo(null) as never,
      );

      // Act
      const result = await handler.execute(new GetPostQuery(publication.id.value));

      // Assert
      expect(result.commentCount).toBe(4);
    });
  });
});

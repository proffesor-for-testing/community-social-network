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
  async findByPublicationId(): Promise<unknown[]> {
    return [];
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
});

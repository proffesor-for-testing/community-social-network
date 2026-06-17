import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UserId, Email } from '@csn/domain-shared';
import {
  Discussion,
  DiscussionId,
  DiscussionContent,
  PublicationId,
} from '@csn/domain-content';
import { Profile, ProfileId, DisplayName } from '@csn/domain-profile';
import { GetCommentsHandler } from '../queries/get-comments.handler';
import { GetCommentsQuery } from '../queries/get-comments.query';

function makeDiscussion(authorId: UserId, postId: PublicationId, text = 'cmt'): Discussion {
  return Discussion.create(
    DiscussionId.generate(),
    postId,
    authorId,
    DiscussionContent.create(text),
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
  constructor(private readonly postExists = true) {}
  async exists(): Promise<boolean> {
    return this.postExists;
  }
}

class StubDiscussionRepo {
  constructor(private readonly comments: Discussion[]) {}
  async findByPublicationId(): Promise<Discussion[]> {
    return this.comments;
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

describe('GetCommentsHandler — author enrichment', () => {
  let postId: PublicationId;
  let alice: UserId;
  let bob: UserId;
  let comments: Discussion[];
  let profiles: Map<string, Profile>;

  beforeEach(() => {
    // Arrange (shared)
    postId = PublicationId.generate();
    alice = UserId.generate();
    bob = UserId.generate();
    comments = [makeDiscussion(alice, postId, 'a'), makeDiscussion(bob, postId, 'b')];
    profiles = new Map<string, Profile>([
      [alice.value, makeProfile(alice, 'Alice C')],
      [bob.value, makeProfile(bob, 'Bob C')],
    ]);
  });

  it('should throw NotFoundException when the post does not exist', async () => {
    // Arrange
    const handler = new GetCommentsHandler(
      new StubPublicationRepo(false) as never,
      new StubDiscussionRepo(comments) as never,
      new StubProfileRepo(profiles) as never,
    );

    // Act + Assert
    await expect(
      handler.execute(new GetCommentsQuery(postId.value)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should populate authorName from the Profile aggregate for every active comment', async () => {
    // Arrange
    const handler = new GetCommentsHandler(
      new StubPublicationRepo() as never,
      new StubDiscussionRepo(comments) as never,
      new StubProfileRepo(profiles) as never,
    );

    // Act
    const result = await handler.execute(new GetCommentsQuery(postId.value));

    // Assert
    expect(result.map((c) => c.authorName)).toEqual(['Alice C', 'Bob C']);
  });

  it('should fall back to "Member" when an author has no Profile row', async () => {
    // Arrange — only Alice has a profile
    profiles.delete(bob.value);
    const handler = new GetCommentsHandler(
      new StubPublicationRepo() as never,
      new StubDiscussionRepo(comments) as never,
      new StubProfileRepo(profiles) as never,
    );

    // Act
    const result = await handler.execute(new GetCommentsQuery(postId.value));

    // Assert
    expect(result[1]!.authorName).toBe('Member');
  });

  it('should issue exactly one batch profile lookup regardless of comment count (no N+1)', async () => {
    // Arrange — six comments, two unique authors
    const lots = [
      makeDiscussion(alice, postId),
      makeDiscussion(bob, postId),
      makeDiscussion(alice, postId),
      makeDiscussion(bob, postId),
      makeDiscussion(alice, postId),
      makeDiscussion(bob, postId),
    ];
    const profileRepo = new StubProfileRepo(profiles);
    const handler = new GetCommentsHandler(
      new StubPublicationRepo() as never,
      new StubDiscussionRepo(lots) as never,
      profileRepo as never,
    );

    // Act
    await handler.execute(new GetCommentsQuery(postId.value));

    // Assert
    expect(profileRepo.calls).toHaveLength(1);
  });

  it('should deduplicate author ids in the batch lookup', async () => {
    // Arrange — four comments from one author
    const sameAuthor = [
      makeDiscussion(alice, postId),
      makeDiscussion(alice, postId),
      makeDiscussion(alice, postId),
      makeDiscussion(alice, postId),
    ];
    const profileRepo = new StubProfileRepo(profiles);
    const handler = new GetCommentsHandler(
      new StubPublicationRepo() as never,
      new StubDiscussionRepo(sameAuthor) as never,
      profileRepo as never,
    );

    // Act
    await handler.execute(new GetCommentsQuery(postId.value));

    // Assert
    expect(profileRepo.calls[0]).toHaveLength(1);
  });

  it('should not call the profile repo when there are zero active comments', async () => {
    // Arrange
    const profileRepo = new StubProfileRepo(profiles);
    const handler = new GetCommentsHandler(
      new StubPublicationRepo() as never,
      new StubDiscussionRepo([]) as never,
      profileRepo as never,
    );

    // Act
    const result = await handler.execute(new GetCommentsQuery(postId.value));

    // Assert
    expect(profileRepo.calls).toHaveLength(0);
    expect(result).toEqual([]);
  });
});

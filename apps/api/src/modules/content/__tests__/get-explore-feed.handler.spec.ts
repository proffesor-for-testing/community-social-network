import { describe, it, expect, beforeEach } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  PublicationContent,
  PublicationStatus,
  Visibility,
  GroupId,
} from '@csn/domain-content';
import { InMemoryPublicationRepository } from '@csn/infra-content';
import { GetExploreFeedHandler } from '../queries/get-explore-feed.handler';
import { GetExploreFeedQuery } from '../queries/get-explore-feed.query';

function makePost(author: UserId, text: string, groupId: GroupId | null = null): Publication {
  const at = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
  return Publication.reconstitute(
    PublicationId.generate(),
    author,
    PublicationContent.create(text),
    Visibility.PUBLIC,
    PublicationStatus.PUBLISHED,
    [],
    [],
    new Map<string, number>(),
    at,
    at,
    1,
    groupId,
  );
}

class StubDiscussionRepo {
  async countActiveByPublicationIds(): Promise<Map<string, number>> {
    return new Map<string, number>();
  }
}

class StubProfileRepo {
  async findByMemberIds(): Promise<Map<string, never>> {
    return new Map();
  }
}

describe('GetExploreFeedHandler', () => {
  let publications: InMemoryPublicationRepository;
  let handler: GetExploreFeedHandler;
  let author: UserId;

  beforeEach(() => {
    publications = new InMemoryPublicationRepository();
    author = UserId.generate();
    handler = new GetExploreFeedHandler(
      publications as never,
      new StubProfileRepo() as never,
      new StubDiscussionRepo() as never,
    );
  });

  it('should return public posts from an author the viewer does not follow', async () => {
    // Arrange
    const post = makePost(author, 'discover me');
    await publications.save(post);

    // Act
    const result = await handler.execute(new GetExploreFeedQuery());

    // Assert
    expect(result.items.map((i) => i.id)).toEqual([post.id.value]);
  });

  it('should exclude group posts from Explore', async () => {
    // Arrange
    await publications.save(makePost(author, 'group only', GroupId.generate()));

    // Act
    const result = await handler.execute(new GetExploreFeedQuery());

    // Assert
    expect(result.items).toEqual([]);
  });

  it('should cap the page at the requested limit', async () => {
    // Arrange
    await publications.save(makePost(author, 'one'));
    await publications.save(makePost(author, 'two'));

    // Act
    const result = await handler.execute(new GetExploreFeedQuery(undefined, undefined, 1));

    // Assert
    expect(result.items).toHaveLength(1);
  });
});

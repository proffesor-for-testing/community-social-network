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
import { InMemoryPublicationRepository } from '../repositories/in-memory-publication.repository';

function makePost(options: {
  author: UserId;
  text?: string;
  createdAt?: string;
  groupId?: GroupId | null;
  status?: PublicationStatus;
  visibility?: Visibility;
}): Publication {
  const at = Timestamp.fromDate(
    new Date(options.createdAt ?? '2026-01-01T00:00:00.000Z'),
  );
  return Publication.reconstitute(
    PublicationId.generate(),
    options.author,
    PublicationContent.create(options.text ?? 'text'),
    options.visibility ?? Visibility.PUBLIC,
    options.status ?? PublicationStatus.PUBLISHED,
    [],
    [],
    new Map<string, number>(),
    at,
    at,
    1,
    options.groupId ?? null,
  );
}

describe('InMemoryPublicationRepository — findFeedForAuthors', () => {
  let repo: InMemoryPublicationRepository;
  let alice: UserId;
  let bob: UserId;

  beforeEach(() => {
    repo = new InMemoryPublicationRepository();
    alice = UserId.generate();
    bob = UserId.generate();
  });

  it('should return an empty page when no authors are requested', async () => {
    // Arrange
    await repo.save(makePost({ author: alice }));

    // Act
    const rows = await repo.findFeedForAuthors([], { limit: 10 });

    // Assert
    expect(rows).toEqual([]);
  });

  it('should return posts by the requested authors', async () => {
    // Arrange
    const post = makePost({ author: alice });
    await repo.save(post);

    // Act
    const rows = await repo.findFeedForAuthors([alice], { limit: 10 });

    // Assert
    expect(rows.map((r) => r.id.value)).toEqual([post.id.value]);
  });

  it('should exclude posts by authors outside the requested set', async () => {
    // Arrange
    await repo.save(makePost({ author: bob }));

    // Act
    const rows = await repo.findFeedForAuthors([alice], { limit: 10 });

    // Assert
    expect(rows).toEqual([]);
  });

  it('should exclude group posts from the personal feed', async () => {
    // Arrange
    await repo.save(makePost({ author: alice, groupId: GroupId.generate() }));

    // Act
    const rows = await repo.findFeedForAuthors([alice], { limit: 10 });

    // Assert
    expect(rows).toEqual([]);
  });

  it('should exclude posts that are not PUBLISHED', async () => {
    // Arrange
    await repo.save(
      makePost({ author: alice, status: PublicationStatus.create('ARCHIVED') }),
    );

    // Act
    const rows = await repo.findFeedForAuthors([alice], { limit: 10 });

    // Assert
    expect(rows).toEqual([]);
  });

  it('should include a non-public post from a followed author', async () => {
    // Arrange — CONNECTIONS_ONLY posts are exactly what a follower should see
    const post = makePost({
      author: alice,
      visibility: Visibility.CONNECTIONS_ONLY,
    });
    await repo.save(post);

    // Act
    const rows = await repo.findFeedForAuthors([alice], { limit: 10 });

    // Assert
    expect(rows.map((r) => r.id.value)).toEqual([post.id.value]);
  });

  it('should order results newest first', async () => {
    // Arrange
    await repo.save(
      makePost({ author: alice, text: 'old', createdAt: '2026-01-01T00:00:00Z' }),
    );
    await repo.save(
      makePost({ author: alice, text: 'new', createdAt: '2026-01-05T00:00:00Z' }),
    );

    // Act
    const rows = await repo.findFeedForAuthors([alice], { limit: 10 });

    // Assert
    expect(rows.map((r) => r.content.text)).toEqual(['new', 'old']);
  });

  it('should respect the requested limit', async () => {
    // Arrange
    await repo.save(makePost({ author: alice, createdAt: '2026-01-01T00:00:00Z' }));
    await repo.save(makePost({ author: alice, createdAt: '2026-01-02T00:00:00Z' }));

    // Act
    const rows = await repo.findFeedForAuthors([alice], { limit: 1 });

    // Assert
    expect(rows).toHaveLength(1);
  });

  it('should start after the supplied cursor position', async () => {
    // Arrange
    const newer = makePost({
      author: alice,
      text: 'new',
      createdAt: '2026-01-02T00:00:00Z',
    });
    await repo.save(newer);
    await repo.save(
      makePost({ author: alice, text: 'old', createdAt: '2026-01-01T00:00:00Z' }),
    );

    // Act
    const rows = await repo.findFeedForAuthors([alice], {
      cursor: { createdAt: newer.createdAt.value, id: newer.id.value },
      limit: 10,
    });

    // Assert
    expect(rows.map((r) => r.content.text)).toEqual(['old']);
  });

  it('should return an empty page when the cursor is past the last row', async () => {
    // Arrange
    const only = makePost({ author: alice, createdAt: '2026-01-01T00:00:00Z' });
    await repo.save(only);

    // Act
    const rows = await repo.findFeedForAuthors([alice], {
      cursor: { createdAt: only.createdAt.value, id: only.id.value },
      limit: 10,
    });

    // Assert
    expect(rows).toEqual([]);
  });

  it('should merge posts from several authors into one ordered page', async () => {
    // Arrange
    await repo.save(
      makePost({ author: alice, text: 'a', createdAt: '2026-01-01T00:00:00Z' }),
    );
    await repo.save(
      makePost({ author: bob, text: 'b', createdAt: '2026-01-02T00:00:00Z' }),
    );

    // Act
    const rows = await repo.findFeedForAuthors([alice, bob], { limit: 10 });

    // Assert
    expect(rows.map((r) => r.content.text)).toEqual(['b', 'a']);
  });
});

describe('InMemoryPublicationRepository — findByGroupId', () => {
  let repo: InMemoryPublicationRepository;
  let author: UserId;
  let group: GroupId;

  beforeEach(() => {
    repo = new InMemoryPublicationRepository();
    author = UserId.generate();
    group = GroupId.generate();
  });

  it('should return posts belonging to the group', async () => {
    // Arrange
    const post = makePost({ author, groupId: group });
    await repo.save(post);

    // Act
    const rows = await repo.findByGroupId(group, { limit: 10 });

    // Assert
    expect(rows.map((r) => r.id.value)).toEqual([post.id.value]);
  });

  it('should exclude posts belonging to a different group', async () => {
    // Arrange
    await repo.save(makePost({ author, groupId: GroupId.generate() }));

    // Act
    const rows = await repo.findByGroupId(group, { limit: 10 });

    // Assert
    expect(rows).toEqual([]);
  });

  it('should exclude posts with no group', async () => {
    // Arrange
    await repo.save(makePost({ author }));

    // Act
    const rows = await repo.findByGroupId(group, { limit: 10 });

    // Assert
    expect(rows).toEqual([]);
  });

  it('should paginate the group feed from the cursor', async () => {
    // Arrange
    const newer = makePost({
      author,
      groupId: group,
      text: 'new',
      createdAt: '2026-01-02T00:00:00Z',
    });
    await repo.save(newer);
    await repo.save(
      makePost({
        author,
        groupId: group,
        text: 'old',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    );

    // Act
    const rows = await repo.findByGroupId(group, {
      cursor: { createdAt: newer.createdAt.value, id: newer.id.value },
      limit: 10,
    });

    // Assert
    expect(rows.map((r) => r.content.text)).toEqual(['old']);
  });
});

describe('InMemoryPublicationRepository — findAllPublished', () => {
  it('should exclude group posts from the Explore read model', async () => {
    // Arrange
    const repo = new InMemoryPublicationRepository();
    const author = UserId.generate();
    await repo.save(makePost({ author, groupId: GroupId.generate() }));

    // Act
    const rows = await repo.findAllPublished();

    // Assert
    expect(rows).toEqual([]);
  });

  it('should still return personal public posts', async () => {
    // Arrange
    const repo = new InMemoryPublicationRepository();
    const author = UserId.generate();
    const post = makePost({ author });
    await repo.save(post);

    // Act
    const rows = await repo.findAllPublished();

    // Assert
    expect(rows.map((r) => r.id.value)).toEqual([post.id.value]);
  });
});

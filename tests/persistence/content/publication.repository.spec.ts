/**
 * Persistence: PostgresPublicationRepository
 *
 * Exercises the real Postgres repository (not the in-memory one) so SQL-level
 * behaviour the in-memory implementation can't catch -- reaction-count
 * derivation from publication_reactions rows, status/visibility filtering,
 * and ordering -- is actually verified against Postgres.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import { ReactionTypeEnum, VisibilityEnum, Mention } from '@csn/domain-content';
import {
  RUN_DB_TESTS,
  truncateAll,
  getPublicationRepository,
  getReactionRepository,
  createTestPost,
} from '../setup/db';
import type { PostgresPublicationRepository } from '@csn/infra-content';
import type { Repository } from 'typeorm';
import type { ReactionEntity } from '@csn/infra-content';

describe.skipIf(!RUN_DB_TESTS)('PostgresPublicationRepository', () => {
  let repository: PostgresPublicationRepository;
  let reactionRepository: Repository<ReactionEntity>;

  beforeAll(async () => {
    repository = await getPublicationRepository();
    reactionRepository = await getReactionRepository();
  });

  afterEach(async () => {
    await truncateAll();
  });

  it('round-trips a publication through save and findById', async () => {
    const authorId = randomUUID();
    const post = createTestPost(authorId, { content: 'Round trip publication content.' });

    await repository.save(post);
    const found = await repository.findById(post.id);

    expect(found?.content.text).toBe('Round trip publication content.');
  });

  it('returns null from findById for an unknown publication', async () => {
    const found = await repository.findById(repository.nextId());
    expect(found).toBeNull();
  });

  it('derives reactionCounts from publication_reactions rows on read', async () => {
    const authorId = randomUUID();
    const post = createTestPost(authorId);
    await repository.save(post);

    // Insert reaction rows directly through the ReactionEntity repository,
    // exactly as the AddReaction command handler does in production --
    // PublicationMapper.toPersistence() deliberately does not write reactions
    // (see publication.mapper.ts), so this is the only path that populates them.
    await reactionRepository.insert([
      { publicationId: post.id.value, userId: randomUUID(), type: ReactionTypeEnum.LIKE },
      { publicationId: post.id.value, userId: randomUUID(), type: ReactionTypeEnum.LIKE },
      { publicationId: post.id.value, userId: randomUUID(), type: ReactionTypeEnum.LOVE },
    ]);

    const found = await repository.findById(post.id);

    expect(Object.fromEntries(found!.reactionCounts)).toEqual({
      [ReactionTypeEnum.LIKE]: 2,
      [ReactionTypeEnum.LOVE]: 1,
    });
  });

  it('findAllPublished returns only PUBLISHED + PUBLIC publications', async () => {
    const authorId = randomUUID();

    const visiblePost = createTestPost(authorId, { content: 'Visible published public post.' });
    await repository.save(visiblePost);

    const deletedPost = createTestPost(authorId, { content: 'Deleted post, should be excluded.' });
    deletedPost.delete();
    await repository.save(deletedPost);

    const privatePost = createTestPost(authorId, {
      content: 'Private post, should be excluded.',
      visibility: VisibilityEnum.PRIVATE,
    });
    await repository.save(privatePost);

    const published = await repository.findAllPublished();

    expect(published.map((p) => p.id.value)).toEqual([visiblePost.id.value]);
  });

  it('findAllPublished orders results by createdAt descending', async () => {
    const authorId = randomUUID();

    const first = createTestPost(authorId, { content: 'First post, created earlier.' });
    await repository.save(first);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = createTestPost(authorId, { content: 'Second post, created later.' });
    await repository.save(second);

    const published = await repository.findAllPublished();

    expect(published.map((p) => p.id.value)).toEqual([second.id.value, first.id.value]);
  });

  it('findByAuthorId returns only publications for that author', async () => {
    const authorId = randomUUID();
    const otherAuthorId = randomUUID();

    const own = createTestPost(authorId, { content: 'Owned by the author under test.' });
    await repository.save(own);

    const other = createTestPost(otherAuthorId, { content: 'Owned by a different author.' });
    await repository.save(other);

    const results = await repository.findByAuthorId(UserId.create(authorId));

    expect(results.map((p) => p.id.value)).toEqual([own.id.value]);
  });

  it('replaces mentions on save (delete-then-insert) rather than accumulating them', async () => {
    const authorId = randomUUID();
    const post = createTestPost(authorId);
    post.addMentions([Mention.create(randomUUID(), 0)]);
    await repository.save(post);

    // A second save for the same publication id, this time with zero mentions
    // on the aggregate being persisted. If the repository accumulated
    // mentions instead of replacing them, the original mention row would
    // still be present afterwards.
    const replacement = createTestPost(authorId, {
      id: post.id.value,
      content: 'Replacement content with no mentions.',
    });
    await repository.save(replacement);

    const final = await repository.findById(post.id);
    expect(final?.mentions.length).toBe(0);
  });
});

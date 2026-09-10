/**
 * Persistence: PostgresDiscussionRepository
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import { Discussion, DiscussionId, PublicationId, DiscussionContent } from '@csn/domain-content';
import { RUN_DB_TESTS, truncateAll, getDiscussionRepository } from '../setup/db';
import type { PostgresDiscussionRepository } from '@csn/infra-content';

function createTestDiscussion(
  publicationId: string,
  authorId: string,
  opts: { content?: string; parentId?: string } = {},
): Discussion {
  return Discussion.create(
    DiscussionId.create(randomUUID()),
    PublicationId.create(publicationId),
    UserId.create(authorId),
    DiscussionContent.create(opts.content ?? 'A test comment with enough content.'),
    opts.parentId ? DiscussionId.create(opts.parentId) : null,
  );
}

describe.skipIf(!RUN_DB_TESTS)('PostgresDiscussionRepository', () => {
  let repository: PostgresDiscussionRepository;

  beforeAll(async () => {
    repository = await getDiscussionRepository();
  });

  afterEach(async () => {
    await truncateAll();
  });

  it('round-trips a discussion through save and findById', async () => {
    const publicationId = randomUUID();
    const authorId = randomUUID();
    const discussion = createTestDiscussion(publicationId, authorId, { content: 'Round trip comment.' });

    await repository.save(discussion);
    const found = await repository.findById(discussion.id);

    expect(found?.content.text).toBe('Round trip comment.');
  });

  it('findByPublicationId orders discussions by createdAt ascending', async () => {
    const publicationId = randomUUID();
    const authorId = randomUUID();

    const first = createTestDiscussion(publicationId, authorId, { content: 'First comment.' });
    await repository.save(first);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = createTestDiscussion(publicationId, authorId, { content: 'Second comment.' });
    await repository.save(second);

    const results = await repository.findByPublicationId(PublicationId.create(publicationId));

    expect(results.map((d) => d.id.value)).toEqual([first.id.value, second.id.value]);
  });

  it('findByPublicationId does not return discussions for other publications', async () => {
    const publicationId = randomUUID();
    const otherPublicationId = randomUUID();
    const authorId = randomUUID();

    await repository.save(createTestDiscussion(publicationId, authorId));
    await repository.save(createTestDiscussion(otherPublicationId, authorId));

    const results = await repository.findByPublicationId(PublicationId.create(publicationId));

    expect(results).toHaveLength(1);
  });

  it('countActiveByPublicationIds excludes DELETED discussions', async () => {
    const publicationId = randomUUID();
    const authorId = randomUUID();

    await repository.save(createTestDiscussion(publicationId, authorId));
    const deleted = createTestDiscussion(publicationId, authorId);
    deleted.delete();
    await repository.save(deleted);

    const counts = await repository.countActiveByPublicationIds([PublicationId.create(publicationId)]);

    expect(counts.get(publicationId)).toBe(1);
  });

  it('countActiveByPublicationIds batches counts across multiple publication ids', async () => {
    const publicationIdA = randomUUID();
    const publicationIdB = randomUUID();
    const authorId = randomUUID();

    await repository.save(createTestDiscussion(publicationIdA, authorId));
    await repository.save(createTestDiscussion(publicationIdB, authorId));
    await repository.save(createTestDiscussion(publicationIdB, authorId));

    const counts = await repository.countActiveByPublicationIds([
      PublicationId.create(publicationIdA),
      PublicationId.create(publicationIdB),
    ]);

    expect([counts.get(publicationIdA), counts.get(publicationIdB)]).toEqual([1, 2]);
  });

  it('countActiveByPublicationIds returns an empty map for empty input', async () => {
    const counts = await repository.countActiveByPublicationIds([]);
    expect(counts.size).toBe(0);
  });
});

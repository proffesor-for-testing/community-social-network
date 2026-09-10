import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserId } from '@csn/domain-shared';
import {
  Discussion,
  DiscussionId,
  PublicationId,
  DiscussionContent,
} from '@csn/domain-content';
import { InMemoryDiscussionRepository } from '../repositories/in-memory-discussion.repository';
import { PostgresDiscussionRepository } from '../repositories/postgres-discussion.repository';

function comment(pubId: PublicationId, text = 'hi'): Discussion {
  return Discussion.create(
    DiscussionId.generate(),
    pubId,
    UserId.generate(),
    DiscussionContent.create(text),
  );
}

describe('InMemoryDiscussionRepository.countActiveByPublicationIds', () => {
  let repo: InMemoryDiscussionRepository;
  let p1: PublicationId;
  let p2: PublicationId;

  beforeEach(async () => {
    // Arrange (shared)
    repo = new InMemoryDiscussionRepository();
    p1 = PublicationId.generate();
    p2 = PublicationId.generate();
    await repo.save(comment(p1));
    await repo.save(comment(p1));
    await repo.save(comment(p2));
  });

  it('should count comments per publication', async () => {
    // Act
    const counts = await repo.countActiveByPublicationIds([p1, p2]);

    // Assert
    expect([counts.get(p1.value), counts.get(p2.value)]).toEqual([2, 1]);
  });

  it('should omit publications with no comments', async () => {
    // Arrange
    const p3 = PublicationId.generate();

    // Act
    const counts = await repo.countActiveByPublicationIds([p3]);

    // Assert
    expect(counts.has(p3.value)).toBe(false);
  });

  it('should exclude soft-deleted comments', async () => {
    // Arrange
    const c = comment(p2);
    await repo.save(c);
    c.delete();
    await repo.save(c);

    // Act
    const counts = await repo.countActiveByPublicationIds([p2]);

    // Assert
    expect(counts.get(p2.value)).toBe(1);
  });

  it('should return an empty map for an empty id list', async () => {
    // Act
    const counts = await repo.countActiveByPublicationIds([]);

    // Assert
    expect(counts.size).toBe(0);
  });
});

describe('PostgresDiscussionRepository.countActiveByPublicationIds', () => {
  function makeQb(rows: { publicationId: string; count: string }[]) {
    const qb: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy']) {
      qb[m] = vi.fn().mockReturnValue(qb);
    }
    qb.getRawMany = vi.fn().mockResolvedValue(rows);
    return qb;
  }

  it('should not hit the database for an empty id list', async () => {
    // Arrange
    const qb = makeQb([]);
    const orm = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const repo = new PostgresDiscussionRepository(orm as never);

    // Act
    const counts = await repo.countActiveByPublicationIds([]);

    // Assert
    expect(counts.size).toBe(0);
    expect(orm.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('should filter to ACTIVE status', async () => {
    // Arrange
    const qb = makeQb([]);
    const orm = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const repo = new PostgresDiscussionRepository(orm as never);

    // Act
    await repo.countActiveByPublicationIds([PublicationId.generate()]);

    // Assert
    expect(qb.andWhere).toHaveBeenCalledWith('d.status = :status', { status: 'ACTIVE' });
  });

  it('should coerce the raw string count to a number per publication', async () => {
    // Arrange
    const p1 = PublicationId.generate();
    const qb = makeQb([{ publicationId: p1.value, count: '7' }]);
    const orm = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const repo = new PostgresDiscussionRepository(orm as never);

    // Act
    const counts = await repo.countActiveByPublicationIds([p1]);

    // Assert
    expect(counts.get(p1.value)).toBe(7);
  });
});

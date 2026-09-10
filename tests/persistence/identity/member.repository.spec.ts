/**
 * Persistence: PostgresMemberRepository
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { Email } from '@csn/domain-shared';
import { OptimisticLockError } from '@csn/infra-shared';
import { RUN_DB_TESTS, truncateAll, getMemberRepository, createTestMember } from '../setup/db';
import type { PostgresMemberRepository } from '@csn/infra-identity';

describe.skipIf(!RUN_DB_TESTS)('PostgresMemberRepository', () => {
  let repository: PostgresMemberRepository;

  beforeAll(async () => {
    repository = await getMemberRepository();
  });

  afterEach(async () => {
    await truncateAll();
  });

  it('round-trips a member through save and findById', async () => {
    const member = await createTestMember({ email: 'roundtrip@test.com' });

    await repository.save(member);
    const found = await repository.findById(member.id);

    expect(found?.email.value).toBe('roundtrip@test.com');
  });

  it('returns null from findById for an unknown member', async () => {
    const found = await repository.findById(repository.nextId());
    expect(found).toBeNull();
  });

  it('findByEmail finds a member by exact-case email', async () => {
    const member = await createTestMember({ email: 'exact-case@test.com' });
    await repository.save(member);

    const found = await repository.findByEmail(Email.create('exact-case@test.com'));

    expect(found?.id.value).toBe(member.id.value);
  });

  it('findByEmail is case-insensitive, matching the Email value object normalization', async () => {
    const member = await createTestMember({ email: 'MixedCase@Test.com' });
    await repository.save(member);

    const found = await repository.findByEmail(Email.create('MIXEDCASE@TEST.COM'));

    expect(found?.id.value).toBe(member.id.value);
  });

  it('returns null from findByEmail when no member has that email', async () => {
    const found = await repository.findByEmail(Email.create('nobody@test.com'));
    expect(found).toBeNull();
  });

  it('rejects saving two members with the same email (unique constraint)', async () => {
    const first = await createTestMember({ email: 'duplicate@test.com' });
    await repository.save(first);

    const second = await createTestMember({ email: 'duplicate@test.com' });

    await expect(repository.save(second)).rejects.toThrow();
  });

  // PRODUCTION BUG (documented, not fixed -- see libs/infrastructure/shared/src/repositories/base.repository.ts:66-68):
  // BaseRepository.save() computes its optimistic-lock guard from a version it
  // re-reads from the database immediately before the UPDATE, not from the
  // version the caller's aggregate was originally loaded with:
  //   const existing = await this.ormRepository.findOne({ where: idCondition, select: ['version'] });
  //   ...
  //   const previousVersion = (existing as unknown as { version: number }).version;
  //   ... qb.andWhere('"version" = :previousVersion', { previousVersion });
  // Two aggregates loaded at the same version and each mutated once (so each
  // computes the same "new" version) will both satisfy that freshly-read
  // guard in turn -- the second save silently overwrites the first instead of
  // throwing OptimisticLockError, because the WHERE clause is checked against
  // "whatever is in the database right now" rather than "the version this
  // aggregate was loaded from". This reproduces deterministically with plain
  // sequential saves (no timing/concurrency required) and is demonstrated below.
  it(
    'should throw OptimisticLockError when saving a stale aggregate after a concurrent update',
    async () => {
      const member = await createTestMember({ email: 'concurrent@test.com' });
      await repository.save(member);

      // Two independent readers load the same row at the same version.
      const staleCopy = await repository.findById(member.id);
      const winningCopy = await repository.findById(member.id);

      // The "winning" reader commits first.
      winningCopy!.recordFailedLogin();
      await repository.save(winningCopy!);

      // The stale reader now tries to save on top of data it never saw.
      staleCopy!.recordFailedLogin();
      await expect(repository.save(staleCopy!)).rejects.toBeInstanceOf(OptimisticLockError);
    },
  );
});

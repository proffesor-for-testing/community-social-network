/**
 * Persistence: PostgresProfileRepository
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import { RUN_DB_TESTS, truncateAll, getProfileRepository, createTestProfile } from '../setup/db';
import type { PostgresProfileRepository } from '@csn/infra-profile';

describe.skipIf(!RUN_DB_TESTS)('PostgresProfileRepository', () => {
  let repository: PostgresProfileRepository;

  beforeAll(async () => {
    repository = await getProfileRepository();
  });

  afterEach(async () => {
    await truncateAll();
  });

  it('round-trips a profile through save and findById', async () => {
    const memberId = randomUUID();
    const profile = createTestProfile(memberId, { displayName: 'Round Trip Person' });

    await repository.save(profile);
    const found = await repository.findById(profile.id);

    expect(found?.displayName.value).toBe('Round Trip Person');
  });

  it('findByMemberId returns the profile for that member', async () => {
    const memberId = randomUUID();
    const profile = createTestProfile(memberId);
    await repository.save(profile);

    const found = await repository.findByMemberId(UserId.create(memberId));

    expect(found?.id.value).toBe(profile.id.value);
  });

  it('returns null from findByMemberId when the member has no profile', async () => {
    const found = await repository.findByMemberId(UserId.create(randomUUID()));
    expect(found).toBeNull();
  });

  it('findByMemberIds batches lookups and omits missing member ids', async () => {
    const memberIdA = randomUUID();
    const memberIdB = randomUUID();
    const memberIdWithoutProfile = randomUUID();

    await repository.save(createTestProfile(memberIdA, { displayName: 'Member A' }));
    await repository.save(createTestProfile(memberIdB, { displayName: 'Member B' }));

    const results = await repository.findByMemberIds([
      UserId.create(memberIdA),
      UserId.create(memberIdB),
      UserId.create(memberIdWithoutProfile),
    ]);

    expect(results.size).toBe(2);
    expect(results.get(memberIdA)?.displayName.value).toBe('Member A');
    expect(results.get(memberIdB)?.displayName.value).toBe('Member B');
    expect(results.has(memberIdWithoutProfile)).toBe(false);
  });

  it('findByMemberIds returns an empty map for empty input', async () => {
    const results = await repository.findByMemberIds([]);
    expect(results.size).toBe(0);
  });
});

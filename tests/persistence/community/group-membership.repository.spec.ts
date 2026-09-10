/**
 * Persistence: PostgresGroupRepository + PostgresMembershipRepository
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import { MembershipRole } from '@csn/domain-community';
import {
  RUN_DB_TESTS,
  truncateAll,
  getGroupRepository,
  getMembershipRepository,
  createTestGroup,
} from '../setup/db';
import type { PostgresGroupRepository, PostgresMembershipRepository } from '@csn/infra-community';

describe.skipIf(!RUN_DB_TESTS)('PostgresGroupRepository + PostgresMembershipRepository', () => {
  let groupRepository: PostgresGroupRepository;
  let membershipRepository: PostgresMembershipRepository;

  beforeAll(async () => {
    groupRepository = await getGroupRepository();
    membershipRepository = await getMembershipRepository();
  });

  afterEach(async () => {
    await truncateAll();
  });

  it('round-trips a group through save and findById', async () => {
    const ownerId = randomUUID();
    const { group } = createTestGroup(ownerId, { name: 'Round Trip Group' });

    await groupRepository.save(group);
    const found = await groupRepository.findById(group.id);

    expect(found?.name.value).toBe('Round Trip Group');
  });

  it('round-trips a membership through save and findById', async () => {
    const ownerId = randomUUID();
    const { group, ownerMembership } = createTestGroup(ownerId);
    await groupRepository.save(group);

    await membershipRepository.save(ownerMembership);
    const found = await membershipRepository.findById(ownerMembership.id);

    expect(found?.role).toBe(MembershipRole.OWNER);
  });

  it('findByOwnerId returns groups owned by that member', async () => {
    const ownerId = randomUUID();
    const { group: ownGroup } = createTestGroup(ownerId, { name: 'Owned By Owner' });
    await groupRepository.save(ownGroup);

    const { group: otherGroup } = createTestGroup(randomUUID(), { name: 'Owned By Someone Else' });
    await groupRepository.save(otherGroup);

    const result = await groupRepository.findByOwnerId(UserId.create(ownerId));

    expect(result.items.map((g) => g.id.value)).toEqual([ownGroup.id.value]);
  });

  it('search finds groups by a case-insensitive name match', async () => {
    const { group } = createTestGroup(randomUUID(), { name: 'Searchable Hiking Club' });
    await groupRepository.save(group);

    const result = await groupRepository.search('hiking');

    expect(result.items.map((g) => g.id.value)).toContain(group.id.value);
  });

  it('search finds groups by a case-insensitive description match', async () => {
    const { group } = createTestGroup(randomUUID(), {
      name: 'Book Club',
      description: 'A group about reading fantasy novels',
    });
    await groupRepository.save(group);

    const result = await groupRepository.search('FANTASY');

    expect(result.items.map((g) => g.id.value)).toContain(group.id.value);
  });

  it('findByGroupId lists memberships for a group', async () => {
    const ownerId = randomUUID();
    const { group, ownerMembership } = createTestGroup(ownerId);
    await groupRepository.save(group);
    await membershipRepository.save(ownerMembership);

    const result = await membershipRepository.findByGroupId(group.id);

    expect(result.items.map((m) => m.id.value)).toEqual([ownerMembership.id.value]);
  });

  it('findByMemberId lists memberships for a member across groups', async () => {
    const ownerId = randomUUID();
    const { group, ownerMembership } = createTestGroup(ownerId);
    await groupRepository.save(group);
    await membershipRepository.save(ownerMembership);

    const result = await membershipRepository.findByMemberId(UserId.create(ownerId));

    expect(result.items.map((m) => m.id.value)).toEqual([ownerMembership.id.value]);
  });

  it('findByGroupAndMember returns the specific membership', async () => {
    const ownerId = randomUUID();
    const { group, ownerMembership } = createTestGroup(ownerId);
    await groupRepository.save(group);
    await membershipRepository.save(ownerMembership);

    const found = await membershipRepository.findByGroupAndMember(group.id, UserId.create(ownerId));

    expect(found?.id.value).toBe(ownerMembership.id.value);
  });

  it('findByGroupAndMember returns null when the member never joined the group', async () => {
    const ownerId = randomUUID();
    const { group } = createTestGroup(ownerId);
    await groupRepository.save(group);

    const found = await membershipRepository.findByGroupAndMember(
      group.id,
      UserId.create(randomUUID()),
    );

    expect(found).toBeNull();
  });
});

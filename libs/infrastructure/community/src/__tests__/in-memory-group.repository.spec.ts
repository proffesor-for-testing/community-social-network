import { describe, it, expect, beforeEach } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Group,
  GroupId,
  GroupName,
  GroupDescription,
  GroupSettings,
  GroupRule,
  GroupStatus,
} from '@csn/domain-community';
import { InMemoryGroupRepository } from '../repositories/in-memory-group.repository';

describe('InMemoryGroupRepository', () => {
  let repository: InMemoryGroupRepository;

  beforeEach(() => {
    repository = new InMemoryGroupRepository();
  });

  function createGroup(overrides?: {
    id?: GroupId;
    name?: string;
    ownerId?: UserId;
    description?: string;
  }): Group {
    const id = overrides?.id ?? repository.nextId();
    return Group.create(
      id,
      GroupName.create(overrides?.name ?? 'Test Group'),
      GroupDescription.create(overrides?.description ?? 'A test group'),
      overrides?.ownerId ?? UserId.generate(),
    );
  }

  describe('nextId', () => {
    it('should generate unique GroupIds', () => {
      const id1 = repository.nextId();
      const id2 = repository.nextId();

      expect(id1.value).not.toBe(id2.value);
      expect(id1.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('save and findById', () => {
    it('should save and retrieve a group', async () => {
      const group = createGroup();
      await repository.save(group);

      const found = await repository.findById(group.id);

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(group.id.value);
      expect(found!.name.value).toBe('Test Group');
      expect(found!.description.value).toBe('A test group');
    });

    it('should return null for non-existent id', async () => {
      const found = await repository.findById(GroupId.generate());
      expect(found).toBeNull();
    });

    it('should overwrite when saving with same id', async () => {
      const id = repository.nextId();
      const ownerId = UserId.generate();

      const group1 = Group.create(
        id,
        GroupName.create('Original'),
        GroupDescription.create('First version'),
        ownerId,
      );
      await repository.save(group1);

      // Reconstitute and modify to simulate an update
      const retrieved = await repository.findById(id);
      expect(retrieved!.name.value).toBe('Original');

      const group2 = Group.reconstitute(
        id,
        GroupName.create('Updated'),
        GroupDescription.create('Second version'),
        ownerId,
        GroupSettings.defaults(),
        [],
        GroupStatus.ACTIVE,
        0,
        Timestamp.now(),
        2,
      );
      await repository.save(group2);

      const found = await repository.findById(id);
      expect(found!.name.value).toBe('Updated');
      expect(repository.size).toBe(1);
    });
  });

  describe('exists', () => {
    it('should return true for saved group', async () => {
      const group = createGroup();
      await repository.save(group);

      const result = await repository.exists(group.id);
      expect(result).toBe(true);
    });

    it('should return false for non-existent group', async () => {
      const result = await repository.exists(GroupId.generate());
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove a group', async () => {
      const group = createGroup();
      await repository.save(group);

      await repository.delete(group);

      const found = await repository.findById(group.id);
      expect(found).toBeNull();
      expect(repository.size).toBe(0);
    });
  });

  describe('findByOwnerId', () => {
    it('should return groups owned by the user', async () => {
      const ownerId = UserId.generate();
      const group1 = createGroup({ ownerId, name: 'Group A' });
      const group2 = createGroup({ ownerId, name: 'Group B' });
      const otherGroup = createGroup({ name: 'Other Group' });

      await repository.save(group1);
      await repository.save(group2);
      await repository.save(otherGroup);

      const result = await repository.findByOwnerId(ownerId);

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items.every((g) => g.ownerId.value === ownerId.value)).toBe(
        true,
      );
    });

    it('should return empty result for owner with no groups', async () => {
      const result = await repository.findByOwnerId(UserId.generate());

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(false);
    });

    it('should paginate results', async () => {
      const ownerId = UserId.generate();
      for (let i = 0; i < 5; i++) {
        const group = createGroup({ ownerId, name: `Group ${i}` });
        await repository.save(group);
      }

      const page1 = await repository.findByOwnerId(ownerId, {
        page: 1,
        pageSize: 2,
      });
      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
      expect(page1.hasNextPage).toBe(true);
      expect(page1.hasPreviousPage).toBe(false);

      const page3 = await repository.findByOwnerId(ownerId, {
        page: 3,
        pageSize: 2,
      });
      expect(page3.items).toHaveLength(1);
      expect(page3.hasNextPage).toBe(false);
      expect(page3.hasPreviousPage).toBe(true);
    });
  });

  describe('search', () => {
    it('should find groups by name', async () => {
      const group1 = createGroup({ name: 'TypeScript Developers' });
      const group2 = createGroup({ name: 'Rust Enthusiasts' });
      const group3 = createGroup({
        name: 'Programming',
        description: 'A typescript community',
      });

      await repository.save(group1);
      await repository.save(group2);
      await repository.save(group3);

      const result = await repository.search('typescript');

      expect(result.total).toBe(2);
      expect(
        result.items.some((g) => g.name.value === 'TypeScript Developers'),
      ).toBe(true);
      expect(
        result.items.some((g) => g.name.value === 'Programming'),
      ).toBe(true);
    });

    it('should return empty result for no matches', async () => {
      const group = createGroup({ name: 'Cooking Club' });
      await repository.save(group);

      const result = await repository.search('quantum physics');
      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('should be case-insensitive', async () => {
      const group = createGroup({ name: 'NestJS Fans' });
      await repository.save(group);

      const result = await repository.search('nestjs');
      expect(result.total).toBe(1);
    });

    it('should paginate search results', async () => {
      for (let i = 0; i < 5; i++) {
        const group = createGroup({ name: `Dev Group ${i}` });
        await repository.save(group);
      }

      const result = await repository.search('Dev', { page: 1, pageSize: 3 });
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(5);
      expect(result.hasNextPage).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all stored groups', async () => {
      await repository.save(createGroup({ name: 'Group 1' }));
      await repository.save(createGroup({ name: 'Group 2' }));
      expect(repository.size).toBe(2);

      repository.clear();
      expect(repository.size).toBe(0);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FindOptionsWhere, ObjectLiteral } from 'typeorm';
import { AggregateRoot } from '@csn/domain-shared';
import { DomainEvent } from '@csn/domain-shared';
import { BaseRepository } from '../repositories/base.repository';
import { AggregateMapper } from '../mappers/aggregate-mapper.interface';
import { OptimisticLockError } from '../errors/optimistic-lock.error';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

class TestEvent extends DomainEvent {
  get eventType(): string {
    return 'TestEvent';
  }
  get aggregateType(): string {
    return 'TestAggregate';
  }
}

class TestAggregate extends AggregateRoot<string> {
  public name: string;

  private constructor(id: string, name: string) {
    super(id);
    this.name = name;
  }

  static create(id: string, name: string): TestAggregate {
    const agg = new TestAggregate(id, name);
    agg.addDomainEvent(new TestEvent(id));
    agg.incrementVersion();
    return agg;
  }

  static reconstitute(id: string, name: string, version: number): TestAggregate {
    const agg = new TestAggregate(id, name);
    agg.setVersion(version);
    return agg;
  }

  rename(newName: string): void {
    this.name = newName;
    this.addDomainEvent(new TestEvent(this.id));
    this.incrementVersion();
  }
}

interface TestEntity extends ObjectLiteral {
  id: string;
  name: string;
  version: number;
}

class TestMapper implements AggregateMapper<TestAggregate, TestEntity> {
  toDomain(raw: TestEntity): TestAggregate {
    return TestAggregate.reconstitute(raw.id, raw.name, raw.version);
  }

  toPersistence(domain: TestAggregate): TestEntity {
    return {
      id: domain.id,
      name: domain.name,
      version: domain.version,
    };
  }
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockQueryBuilder(executeResult = { affected: 1 }) {
  const qb = {
    update: vi.fn(),
    set: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    execute: vi.fn().mockResolvedValue(executeResult),
  };
  // Chain all builder methods back to itself
  qb.update.mockReturnValue(qb);
  qb.set.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  return qb;
}

function createMockOrmRepository(
  queryBuilder?: ReturnType<typeof createMockQueryBuilder>,
) {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    createQueryBuilder: vi
      .fn()
      .mockReturnValue(queryBuilder ?? createMockQueryBuilder()),
  };
}

// ---------------------------------------------------------------------------
// Concrete test repository
// ---------------------------------------------------------------------------

class TestRepository extends BaseRepository<TestAggregate, string, TestEntity> {
  private idCounter = 0;

  constructor(
    ormRepo: ReturnType<typeof createMockOrmRepository>,
    mapper?: TestMapper,
  ) {
    super(ormRepo as any, mapper ?? new TestMapper());
  }

  nextId(): string {
    this.idCounter++;
    return `test-id-${this.idCounter}`;
  }

  protected idCondition(id: string): FindOptionsWhere<TestEntity> {
    return { id } as FindOptionsWhere<TestEntity>;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseRepository', () => {
  let mockOrm: ReturnType<typeof createMockOrmRepository>;
  let mockQb: ReturnType<typeof createMockQueryBuilder>;
  let repository: TestRepository;

  beforeEach(() => {
    mockQb = createMockQueryBuilder();
    mockOrm = createMockOrmRepository(mockQb);
    repository = new TestRepository(mockOrm);
  });

  // -----------------------------------------------------------------------
  // nextId
  // -----------------------------------------------------------------------
  describe('nextId()', () => {
    it('should generate an id', () => {
      const id = repository.nextId();
      expect(id).toBe('test-id-1');
    });

    it('should generate sequential unique ids', () => {
      const id1 = repository.nextId();
      const id2 = repository.nextId();
      expect(id1).not.toBe(id2);
    });
  });

  // -----------------------------------------------------------------------
  // findById
  // -----------------------------------------------------------------------
  describe('findById()', () => {
    it('should return the domain aggregate when entity exists', async () => {
      const entity: TestEntity = { id: 'agg-1', name: 'Alice', version: 3 };
      mockOrm.findOne.mockResolvedValue(entity);

      const result = await repository.findById('agg-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('agg-1');
      expect(result!.name).toBe('Alice');
      expect(result!.version).toBe(3);
      expect(mockOrm.findOne).toHaveBeenCalledWith({
        where: { id: 'agg-1' },
      });
    });

    it('should return null when entity does not exist', async () => {
      mockOrm.findOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should pass the correct id condition to findOne', async () => {
      mockOrm.findOne.mockResolvedValue(null);

      await repository.findById('my-id');

      expect(mockOrm.findOne).toHaveBeenCalledWith({
        where: { id: 'my-id' },
      });
    });
  });

  // -----------------------------------------------------------------------
  // exists
  // -----------------------------------------------------------------------
  describe('exists()', () => {
    it('should return true when entity exists', async () => {
      mockOrm.count.mockResolvedValue(1);

      const result = await repository.exists('agg-1');

      expect(result).toBe(true);
      expect(mockOrm.count).toHaveBeenCalledWith({
        where: { id: 'agg-1' },
      });
    });

    it('should return false when entity does not exist', async () => {
      mockOrm.count.mockResolvedValue(0);

      const result = await repository.exists('nonexistent');

      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // save - new aggregate
  // -----------------------------------------------------------------------
  describe('save() with new aggregate (version <= 1)', () => {
    it('should call ormRepository.save() directly for version=1', async () => {
      const aggregate = TestAggregate.create('agg-1', 'Alice');
      expect(aggregate.version).toBe(1);

      await repository.save(aggregate);

      expect(mockOrm.save).toHaveBeenCalledOnce();
      expect(mockOrm.save).toHaveBeenCalledWith({
        id: 'agg-1',
        name: 'Alice',
        version: 1,
      });
      // Should NOT use query builder for new aggregates
      expect(mockOrm.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should call ormRepository.save() directly for version=0', async () => {
      const aggregate = TestAggregate.reconstitute('agg-2', 'Bob', 0);
      expect(aggregate.version).toBe(0);

      await repository.save(aggregate);

      expect(mockOrm.save).toHaveBeenCalledOnce();
      expect(mockOrm.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // save - existing aggregate (optimistic lock)
  // -----------------------------------------------------------------------
  describe('save() with existing aggregate (version > 1)', () => {
    it('should use version-conditioned update for version=2', async () => {
      const aggregate = TestAggregate.reconstitute('agg-1', 'Alice', 1);
      aggregate.rename('Alice Updated');
      expect(aggregate.version).toBe(2);

      await repository.save(aggregate);

      // Should use query builder, not ormRepository.save
      expect(mockOrm.save).not.toHaveBeenCalled();
      expect(mockOrm.createQueryBuilder).toHaveBeenCalledOnce();
      expect(mockQb.update).toHaveBeenCalledOnce();
      expect(mockQb.set).toHaveBeenCalledWith({
        id: 'agg-1',
        name: 'Alice Updated',
        version: 2,
      });
    });

    it('should include the id condition in the WHERE clause', async () => {
      const aggregate = TestAggregate.reconstitute('agg-1', 'Alice', 2);
      aggregate.rename('Alice v3');

      await repository.save(aggregate);

      // First andWhere: id condition
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '"id" = :id',
        { id: 'agg-1' },
      );
    });

    it('should include the version guard in the WHERE clause', async () => {
      const aggregate = TestAggregate.reconstitute('agg-1', 'Alice', 2);
      aggregate.rename('Alice v3');
      expect(aggregate.version).toBe(3);

      await repository.save(aggregate);

      // The version guard checks for previousVersion = currentVersion - 1 = 2
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '"version" = :previousVersion',
        { previousVersion: 2 },
      );
    });

    it('should succeed when affected rows is 1', async () => {
      mockQb.execute.mockResolvedValue({ affected: 1 });
      const aggregate = TestAggregate.reconstitute('agg-1', 'Alice', 3);
      aggregate.rename('Alice v4');

      await expect(repository.save(aggregate)).resolves.not.toThrow();
    });

    it('should use previousVersion = version - 1 for version=5', async () => {
      const aggregate = TestAggregate.reconstitute('agg-1', 'Alice', 4);
      aggregate.rename('Alice v5');
      expect(aggregate.version).toBe(5);

      await repository.save(aggregate);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '"version" = :previousVersion',
        { previousVersion: 4 },
      );
    });
  });

  // -----------------------------------------------------------------------
  // save - version conflict
  // -----------------------------------------------------------------------
  describe('save() with version conflict', () => {
    it('should throw OptimisticLockError when affected rows is 0', async () => {
      mockQb.execute.mockResolvedValue({ affected: 0 });
      const aggregate = TestAggregate.reconstitute('agg-1', 'Alice', 2);
      aggregate.rename('Alice v3');

      await expect(repository.save(aggregate)).rejects.toThrow(
        OptimisticLockError,
      );
    });

    it('should include aggregate name in the error', async () => {
      mockQb.execute.mockResolvedValue({ affected: 0 });
      const aggregate = TestAggregate.reconstitute('agg-1', 'Alice', 2);
      aggregate.rename('Alice v3');

      await expect(repository.save(aggregate)).rejects.toThrow(
        /TestAggregate/,
      );
    });

    it('should include aggregate id in the error', async () => {
      mockQb.execute.mockResolvedValue({ affected: 0 });
      const aggregate = TestAggregate.reconstitute('conflict-id', 'Bob', 5);
      aggregate.rename('Bob v6');

      await expect(repository.save(aggregate)).rejects.toThrow(
        /conflict-id/,
      );
    });

    it('should throw the correct full error message', async () => {
      mockQb.execute.mockResolvedValue({ affected: 0 });
      const aggregate = TestAggregate.reconstitute('agg-99', 'Charlie', 3);
      aggregate.rename('Charlie v4');

      await expect(repository.save(aggregate)).rejects.toThrow(
        'Optimistic lock conflict on TestAggregate with id agg-99. ' +
          'The entity was modified by another transaction.',
      );
    });
  });

  // -----------------------------------------------------------------------
  // save - atomic guarantee
  // -----------------------------------------------------------------------
  describe('save() atomicity', () => {
    it('should NOT call a separate findOne before update (no read-then-write)', async () => {
      const aggregate = TestAggregate.reconstitute('agg-1', 'Alice', 2);
      aggregate.rename('Alice v3');

      await repository.save(aggregate);

      // findOne should NOT have been called -- the update is atomic via WHERE
      expect(mockOrm.findOne).not.toHaveBeenCalled();
    });

    it('should call query builder methods in correct order', async () => {
      const callOrder: string[] = [];
      mockQb.update.mockImplementation(() => {
        callOrder.push('update');
        return mockQb;
      });
      mockQb.set.mockImplementation(() => {
        callOrder.push('set');
        return mockQb;
      });
      mockQb.andWhere.mockImplementation(() => {
        callOrder.push('andWhere');
        return mockQb;
      });
      mockQb.execute.mockImplementation(() => {
        callOrder.push('execute');
        return Promise.resolve({ affected: 1 });
      });

      const aggregate = TestAggregate.reconstitute('agg-1', 'Alice', 2);
      aggregate.rename('Alice v3');

      await repository.save(aggregate);

      expect(callOrder).toEqual([
        'update',
        'set',
        'andWhere', // id condition
        'andWhere', // version guard
        'execute',
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // delete
  // -----------------------------------------------------------------------
  describe('delete()', () => {
    it('should call ormRepository.delete with id condition', async () => {
      const aggregate = TestAggregate.create('agg-1', 'Alice');

      await repository.delete(aggregate);

      expect(mockOrm.delete).toHaveBeenCalledOnce();
      expect(mockOrm.delete).toHaveBeenCalledWith({ id: 'agg-1' });
    });

    it('should delete using correct id for different aggregates', async () => {
      const aggregate = TestAggregate.reconstitute('agg-42', 'Bob', 5);

      await repository.delete(aggregate);

      expect(mockOrm.delete).toHaveBeenCalledWith({ id: 'agg-42' });
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle version=1 as new (insert path)', async () => {
      const aggregate = TestAggregate.reconstitute('agg-1', 'Alice', 1);

      await repository.save(aggregate);

      expect(mockOrm.save).toHaveBeenCalledOnce();
      expect(mockOrm.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should handle aggregate with version=2 directly (update path)', async () => {
      // Reconstitute at version 2 without incrementing -- simulates an
      // aggregate loaded from the DB at version 2 that is being saved as-is
      // (e.g., after only pulling domain events but not modifying state).
      const aggregate = TestAggregate.reconstitute('agg-1', 'Alice', 2);

      await repository.save(aggregate);

      expect(mockOrm.createQueryBuilder).toHaveBeenCalledOnce();
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '"version" = :previousVersion',
        { previousVersion: 1 },
      );
    });

    it('should propagate ormRepository.save errors for new aggregates', async () => {
      mockOrm.save.mockRejectedValue(new Error('DB connection lost'));
      const aggregate = TestAggregate.create('agg-1', 'Alice');

      await expect(repository.save(aggregate)).rejects.toThrow(
        'DB connection lost',
      );
    });

    it('should propagate query builder execute errors for existing aggregates', async () => {
      mockQb.execute.mockRejectedValue(new Error('Query timeout'));
      const aggregate = TestAggregate.reconstitute('agg-1', 'Alice', 3);
      aggregate.rename('Alice v4');

      await expect(repository.save(aggregate)).rejects.toThrow(
        'Query timeout',
      );
    });

    it('should propagate ormRepository.findOne errors in findById', async () => {
      mockOrm.findOne.mockRejectedValue(new Error('Connection refused'));

      await expect(repository.findById('agg-1')).rejects.toThrow(
        'Connection refused',
      );
    });

    it('should propagate ormRepository.count errors in exists', async () => {
      mockOrm.count.mockRejectedValue(new Error('Table missing'));

      await expect(repository.exists('agg-1')).rejects.toThrow(
        'Table missing',
      );
    });

    it('should propagate ormRepository.delete errors', async () => {
      mockOrm.delete.mockRejectedValue(new Error('FK constraint'));
      const aggregate = TestAggregate.create('agg-1', 'Alice');

      await expect(repository.delete(aggregate)).rejects.toThrow(
        'FK constraint',
      );
    });
  });
});

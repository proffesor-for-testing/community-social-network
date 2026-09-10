import { Repository, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AggregateRoot } from '@csn/domain-shared';
import { AggregateMapper } from '../mappers/aggregate-mapper.interface';
import { OptimisticLockError } from '../errors/optimistic-lock.error';

/**
 * Base TypeORM repository implementation with optimistic locking support.
 * Concrete repositories extend this and provide mapper + entity metadata.
 *
 * Optimistic locking strategy:
 *   - New aggregates (version <= 1) are inserted directly.
 *   - Existing aggregates are updated with a version-conditioned WHERE clause
 *     (UPDATE ... WHERE id = ? AND version = previousVersion). If zero rows are
 *     affected, another transaction modified the aggregate and an
 *     OptimisticLockError is thrown. This is atomic -- there is no window
 *     between read and write where a concurrent update could slip through.
 */
export abstract class BaseRepository<
  TDomain extends AggregateRoot<TId>,
  TId,
  TEntity extends ObjectLiteral,
> {
  constructor(
    protected readonly ormRepository: Repository<TEntity>,
    protected readonly mapper: AggregateMapper<TDomain, TEntity>,
  ) {}

  abstract nextId(): TId;

  protected abstract idCondition(id: TId): FindOptionsWhere<TEntity>;

  async findById(id: TId): Promise<TDomain | null> {
    const entity = await this.ormRepository.findOne({
      where: this.idCondition(id),
    });
    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }

  async exists(id: TId): Promise<boolean> {
    const count = await this.ormRepository.count({
      where: this.idCondition(id),
    });
    return count > 0;
  }

  async save(aggregate: TDomain): Promise<void> {
    const entity = this.mapper.toPersistence(aggregate);
    const existing = await this.ormRepository.findOne({
      where: this.idCondition(aggregate.id),
      select: ['version'] as unknown as (keyof TEntity)[],
    });

    if (!existing) {
      // Insert: no optimistic lock check needed for first-time persistence.
      // A handler may mutate an aggregate several times before saving, so
      // aggregate.version alone is not a reliable "is new" signal.
      const insertVersion = Math.max(aggregate.version, 1);
      (entity as unknown as { version: number }).version = insertVersion;
      await this.ormRepository.save(entity);
      aggregate.markPersisted(insertVersion);
      return;
    }

    // Update: version-conditioned UPDATE for atomic optimistic locking.
    //
    // The guard MUST be the version this in-memory instance was LOADED at
    // (aggregate.persistedVersion), never the version currently stored:
    // reading the stored version right before writing would let a stale
    // instance silently overwrite a concurrent commit. persistedVersion is
    // 0 only for legacy rows persisted before version tracking; fall back to
    // the stored version for those.
    const loadedVersion = (existing as unknown as { version: number }).version;
    const previousVersion =
      aggregate.persistedVersion > 0 ? aggregate.persistedVersion : loadedVersion;
    // Always advance the stored version, even if the aggregate did not bump
    // its own, so every successful write invalidates other stale readers.
    const nextVersion = Math.max(aggregate.version, previousVersion + 1);
    (entity as unknown as { version: number }).version = nextVersion;

    const condition = this.idCondition(aggregate.id);
    const qb = this.ormRepository
      .createQueryBuilder()
      .update()
      .set(entity as unknown as QueryDeepPartialEntity<TEntity>);

    // Apply the identity condition from the FindOptionsWhere object
    const conditionEntries = Object.entries(condition as Record<string, unknown>);
    for (const [key, value] of conditionEntries) {
      qb.andWhere(`"${key}" = :${key}`, { [key]: value });
    }

    // Add version guard
    qb.andWhere('"version" = :previousVersion', { previousVersion });

    const result = await qb.execute();

    if (result.affected === 0) {
      throw new OptimisticLockError(aggregate.constructor.name, String(aggregate.id));
    }
    aggregate.markPersisted(nextVersion);
  }

  async delete(aggregate: TDomain): Promise<void> {
    await this.ormRepository.delete(
      this.idCondition(aggregate.id) as FindOptionsWhere<TEntity>,
    );
  }
}

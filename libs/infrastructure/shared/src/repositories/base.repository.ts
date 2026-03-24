import { Repository, FindOptionsWhere, ObjectLiteral } from 'typeorm';
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
    const isNew = aggregate.version <= 1;

    if (isNew) {
      // Insert: no optimistic lock check needed for first-time persistence
      await this.ormRepository.save(entity);
    } else {
      // Update: use version-conditioned UPDATE for atomic optimistic locking.
      // The entity from toPersistence carries the NEW version. We match
      // against the previous version in the DB so that a concurrent write
      // (which would have already bumped the version) causes 0 affected rows.
      const previousVersion = aggregate.version - 1;
      const condition = this.idCondition(aggregate.id);

      const qb = this.ormRepository
        .createQueryBuilder()
        .update()
        .set(entity as unknown as Record<string, unknown>);

      // Apply the identity condition from the FindOptionsWhere object
      const conditionEntries = Object.entries(
        condition as Record<string, unknown>,
      );
      for (const [key, value] of conditionEntries) {
        qb.andWhere(`"${key}" = :${key}`, { [key]: value });
      }

      // Add version guard
      qb.andWhere('"version" = :previousVersion', { previousVersion });

      const result = await qb.execute();

      if (result.affected === 0) {
        throw new OptimisticLockError(
          aggregate.constructor.name,
          String(aggregate.id),
        );
      }
    }
  }

  async delete(aggregate: TDomain): Promise<void> {
    await this.ormRepository.delete(
      this.idCondition(aggregate.id) as FindOptionsWhere<TEntity>,
    );
  }
}

import { Repository, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import { AggregateRoot } from '@csn/domain-shared';
import { AggregateMapper } from '../mappers/aggregate-mapper.interface';
import { OptimisticLockError } from '../errors/optimistic-lock.error';

/**
 * Base TypeORM repository implementation with optimistic locking support.
 * Concrete repositories extend this and provide mapper + entity metadata.
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
    const currentVersion = aggregate.version;

    // Check for optimistic lock if updating (version > 0 means it's been persisted before)
    if (currentVersion > 1) {
      const existing = await this.ormRepository.findOne({
        where: this.idCondition(aggregate.id),
      });

      if (
        existing &&
        (existing as Record<string, unknown>)['version'] !== undefined &&
        (existing as Record<string, unknown>)['version'] !== currentVersion - 1
      ) {
        throw new OptimisticLockError(
          aggregate.constructor.name,
          String(aggregate.id),
        );
      }
    }

    await this.ormRepository.save(entity);
  }

  async delete(aggregate: TDomain): Promise<void> {
    await this.ormRepository.delete(
      this.idCondition(aggregate.id) as FindOptionsWhere<TEntity>,
    );
  }
}

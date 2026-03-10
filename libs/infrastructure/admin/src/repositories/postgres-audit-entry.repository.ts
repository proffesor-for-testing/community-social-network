import { randomUUID } from 'crypto';
import { Repository, FindOptionsWhere } from 'typeorm';
import { PaginatedResult, PaginationParams, DEFAULT_PAGINATION, UserId, Timestamp } from '@csn/domain-shared';
import { AuditEntry, AuditEntryId, IAuditEntryRepository } from '@csn/domain-admin';
import { BaseRepository } from '@csn/infra-shared';
import { AuditEntryEntity } from '../entities/audit-entry.entity';
import { AuditEntryMapper } from '../mappers/audit-entry.mapper';

export class PostgresAuditEntryRepository
  extends BaseRepository<AuditEntry, AuditEntryId, AuditEntryEntity>
  implements IAuditEntryRepository
{
  constructor(ormRepository: Repository<AuditEntryEntity>) {
    super(ormRepository, new AuditEntryMapper());
  }

  nextId(): AuditEntryId {
    return AuditEntryId.create(randomUUID());
  }

  protected idCondition(
    id: AuditEntryId,
  ): FindOptionsWhere<AuditEntryEntity> {
    return { id: id.value } as FindOptionsWhere<AuditEntryEntity>;
  }

  /**
   * Override save to enforce immutability: only new entries (version <= 1) can be persisted.
   * Updates to existing entries are not allowed.
   */
  override async save(aggregate: AuditEntry): Promise<void> {
    if (aggregate.version > 1) {
      throw new Error(
        'Audit entries are immutable and cannot be updated after creation.',
      );
    }
    await super.save(aggregate);
  }

  /**
   * Override delete to enforce immutability: audit entries cannot be deleted.
   */
  override async delete(_aggregate: AuditEntry): Promise<void> {
    throw new Error(
      'Audit entries are immutable and cannot be deleted.',
    );
  }

  async findByPerformedBy(
    performedBy: UserId,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<AuditEntry>> {
    return this.findPaginated(
      { actorId: performedBy.value } as FindOptionsWhere<AuditEntryEntity>,
      pagination,
    );
  }

  async findByTargetId(
    targetId: string,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<AuditEntry>> {
    return this.findPaginated(
      { resourceId: targetId } as FindOptionsWhere<AuditEntryEntity>,
      pagination,
    );
  }

  async findByDateRange(
    from: Timestamp,
    to: Timestamp,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<AuditEntry>> {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.ormRepository
      .createQueryBuilder('audit')
      .where('audit.timestamp >= :from', { from: from.value })
      .andWhere('audit.timestamp <= :to', { to: to.value })
      .orderBy('audit.timestamp', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [entities, total] = await queryBuilder.getManyAndCount();
    const items = entities.map((entity) => this.mapper.toDomain(entity));
    const totalPages = Math.ceil(total / pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  private async findPaginated(
    where: FindOptionsWhere<AuditEntryEntity>,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<AuditEntry>> {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;

    const [entities, total] = await this.ormRepository.findAndCount({
      where,
      order: { timestamp: 'DESC' } as Record<string, 'ASC' | 'DESC'>,
      skip,
      take: pageSize,
    });

    const items = entities.map((entity) => this.mapper.toDomain(entity));
    const totalPages = Math.ceil(total / pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}

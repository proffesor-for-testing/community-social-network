import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditEntryEntity } from '@csn/infra-admin';
import { PaginatedResult } from '@csn/domain-shared';
import { GetAuditLogQuery } from './get-audit-log.query';
import { AuditLogResponseDto } from '../dto/admin-response.dto';

@Injectable()
export class GetAuditLogHandler {
  constructor(
    @Inject(getRepositoryToken(AuditEntryEntity))
    private readonly auditOrmRepository: Repository<AuditEntryEntity>,
  ) {}

  async execute(
    query: GetAuditLogQuery,
  ): Promise<PaginatedResult<AuditLogResponseDto>> {
    const { page, limit, action, actorId, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const qb = this.auditOrmRepository
      .createQueryBuilder('audit')
      .orderBy('audit.timestamp', 'DESC')
      .skip(skip)
      .take(limit);

    if (action) {
      qb.andWhere('audit.action = :action', { action });
    }

    if (actorId) {
      qb.andWhere('audit.actorId = :actorId', { actorId });
    }

    if (startDate) {
      qb.andWhere('audit.timestamp >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      qb.andWhere('audit.timestamp <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    const [entities, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    const items = entities.map((entity) => {
      const dto = new AuditLogResponseDto();
      dto.id = entity.id;
      dto.action = entity.action;
      dto.performedBy = entity.actorId;
      dto.targetId = entity.resourceId;
      dto.targetType = entity.resource;
      dto.details = entity.details ?? {};
      dto.ipAddress = entity.ipAddress;
      dto.createdAt = entity.timestamp.toISOString();
      return dto;
    });

    return {
      items,
      total,
      page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}

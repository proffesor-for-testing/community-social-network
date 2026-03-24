import { Injectable, Inject } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditEntryEntity } from '@csn/infra-admin';
import { PaginatedResult } from '@csn/domain-shared';
import { GetSecurityAlertsQuery } from './get-security-alerts.query';
import { SecurityAlertResponseDto } from '../dto/admin-response.dto';

/** Actions that are considered security-relevant alerts. */
const SECURITY_ALERT_ACTIONS = [
  'ADMIN_LOGIN_FAILED',
  'ADMIN_2FA_VERIFY_FAILED',
  'SUSPEND_USER',
  'UNSUSPEND_USER',
  'ADMIN_2FA_SETUP',
] as const;

@Injectable()
export class GetSecurityAlertsHandler {
  constructor(
    @Inject(getRepositoryToken(AuditEntryEntity))
    private readonly auditOrmRepository: Repository<AuditEntryEntity>,
  ) {}

  async execute(
    query: GetSecurityAlertsQuery,
  ): Promise<PaginatedResult<SecurityAlertResponseDto>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [entities, total] = await this.auditOrmRepository.findAndCount({
      where: { action: In([...SECURITY_ALERT_ACTIONS]) },
      order: { timestamp: 'DESC' },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    const items = entities.map((entity) => {
      const dto = new SecurityAlertResponseDto();
      dto.id = entity.id;
      dto.severity = this.deriveSeverity(entity.action);
      dto.description = this.deriveDescription(entity.action, entity.details);
      dto.action = entity.action;
      dto.actorId = entity.actorId;
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

  private deriveSeverity(action: string): string {
    switch (action) {
      case 'ADMIN_LOGIN_FAILED':
      case 'ADMIN_2FA_VERIFY_FAILED':
        return 'HIGH';
      case 'SUSPEND_USER':
      case 'UNSUSPEND_USER':
        return 'MEDIUM';
      case 'ADMIN_2FA_SETUP':
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }

  private deriveDescription(
    action: string,
    details: Record<string, unknown>,
  ): string {
    switch (action) {
      case 'ADMIN_LOGIN_FAILED':
        return `Admin login failed: ${(details.reason as string) ?? 'unknown reason'}`;
      case 'ADMIN_2FA_VERIFY_FAILED':
        return 'Two-factor authentication verification failed';
      case 'SUSPEND_USER':
        return `User suspended: ${(details.reason as string) ?? 'no reason provided'}`;
      case 'UNSUSPEND_USER':
        return 'User unsuspended and account reactivated';
      case 'ADMIN_2FA_SETUP':
        return 'Two-factor authentication was configured';
      default:
        return action;
    }
  }
}

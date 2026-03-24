import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MemberEntity } from '@csn/infra-identity';
import { PaginatedResult } from '@csn/domain-shared';
import { GetUsersQuery } from './get-users.query';
import { AdminUserResponseDto } from '../dto/admin-response.dto';

@Injectable()
export class GetUsersHandler {
  constructor(
    @Inject(getRepositoryToken(MemberEntity))
    private readonly memberOrmRepository: Repository<MemberEntity>,
  ) {}

  async execute(
    query: GetUsersQuery,
  ): Promise<PaginatedResult<AdminUserResponseDto>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [entities, total] = await this.memberOrmRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    const items = entities.map((entity) => {
      const dto = new AdminUserResponseDto();
      dto.id = entity.id;
      dto.email = entity.email;
      dto.displayName = entity.displayName;
      dto.status = entity.status;
      dto.failedLoginAttempts = entity.failedLoginAttempts;
      dto.lastLoginAt = entity.lastLoginAt
        ? entity.lastLoginAt.toISOString()
        : null;
      dto.createdAt = entity.createdAt.toISOString();
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

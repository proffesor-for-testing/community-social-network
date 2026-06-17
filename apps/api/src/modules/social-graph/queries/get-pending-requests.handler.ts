import { Inject, Injectable } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import { IConnectionRepository, ConnectionStatusEnum } from '@csn/domain-social-graph';
import { IProfileRepository } from '@csn/domain-profile';
import { GetPendingRequestsQuery } from './get-pending-requests.query';
import { PaginatedConnectionsDto } from '../dto/paginated-connections.dto';
import { enrichConnections } from './enrich-connections';

@Injectable()
export class GetPendingRequestsHandler {
  constructor(
    @Inject('IConnectionRepository')
    private readonly connectionRepo: IConnectionRepository,
    @Inject('IProfileRepository')
    private readonly profileRepo: IProfileRepository,
  ) {}

  async execute(query: GetPendingRequestsQuery): Promise<PaginatedConnectionsDto> {
    const userId = UserId.create(query.userId);
    const connections = await this.connectionRepo.findFollowers(userId);
    const pending = connections.filter(
      (c) => c.status.value === ConnectionStatusEnum.PENDING,
    );
    const items = await enrichConnections(pending, this.profileRepo);
    return PaginatedConnectionsDto.create(items, pending.length);
  }
}

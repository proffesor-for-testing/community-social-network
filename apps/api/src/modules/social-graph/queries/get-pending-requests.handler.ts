import { Inject, Injectable } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import { IConnectionRepository, ConnectionStatusEnum } from '@csn/domain-social-graph';
import { GetPendingRequestsQuery } from './get-pending-requests.query';
import { ConnectionResponseDto } from '../dto/connection-response.dto';
import { PaginatedConnectionsDto } from '../dto/paginated-connections.dto';

@Injectable()
export class GetPendingRequestsHandler {
  constructor(
    @Inject('IConnectionRepository')
    private readonly connectionRepo: IConnectionRepository,
  ) {}

  async execute(query: GetPendingRequestsQuery): Promise<PaginatedConnectionsDto> {
    const userId = UserId.create(query.userId);

    // Get connections where this user is the followee (incoming requests)
    const connections = await this.connectionRepo.findFollowers(userId);

    // Filter to only pending connections
    const pending = connections.filter(
      (c) => c.status.value === ConnectionStatusEnum.PENDING,
    );

    const items = pending.map(ConnectionResponseDto.fromDomain);
    const total = pending.length;

    return PaginatedConnectionsDto.create(items, total);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import { IConnectionRepository, ConnectionStatusEnum } from '@csn/domain-social-graph';
import { GetFollowersQuery } from './get-followers.query';
import { ConnectionResponseDto } from '../dto/connection-response.dto';
import { PaginatedConnectionsDto } from '../dto/paginated-connections.dto';

@Injectable()
export class GetFollowersHandler {
  constructor(
    @Inject('IConnectionRepository')
    private readonly connectionRepo: IConnectionRepository,
  ) {}

  async execute(query: GetFollowersQuery): Promise<PaginatedConnectionsDto> {
    const userId = UserId.create(query.userId);

    const connections = await this.connectionRepo.findFollowers(userId);

    // Filter to only accepted connections
    const accepted = connections.filter(
      (c) => c.status.value === ConnectionStatusEnum.ACCEPTED,
    );

    const items = accepted.map(ConnectionResponseDto.fromDomain);
    const total = accepted.length;

    return PaginatedConnectionsDto.create(items, total);
  }
}

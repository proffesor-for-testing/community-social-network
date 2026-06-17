import { Inject, Injectable } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import { IConnectionRepository, ConnectionStatusEnum } from '@csn/domain-social-graph';
import { IProfileRepository } from '@csn/domain-profile';
import { GetFollowersQuery } from './get-followers.query';
import { PaginatedConnectionsDto } from '../dto/paginated-connections.dto';
import { enrichConnections } from './enrich-connections';

@Injectable()
export class GetFollowersHandler {
  constructor(
    @Inject('IConnectionRepository')
    private readonly connectionRepo: IConnectionRepository,
    @Inject('IProfileRepository')
    private readonly profileRepo: IProfileRepository,
  ) {}

  async execute(query: GetFollowersQuery): Promise<PaginatedConnectionsDto> {
    const userId = UserId.create(query.userId);
    const connections = await this.connectionRepo.findFollowers(userId);
    const accepted = connections.filter(
      (c) => c.status.value === ConnectionStatusEnum.ACCEPTED,
    );
    const items = await enrichConnections(accepted, this.profileRepo);
    return PaginatedConnectionsDto.create(items, accepted.length);
  }
}

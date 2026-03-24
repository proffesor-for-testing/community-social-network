import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConnectionId, IConnectionRepository } from '@csn/domain-social-graph';
import { ApproveFollowCommand } from './approve-follow.command';
import { ConnectionResponseDto } from '../dto/connection-response.dto';

@Injectable()
export class ApproveFollowHandler {
  constructor(
    @Inject('IConnectionRepository')
    private readonly connectionRepo: IConnectionRepository,
  ) {}

  async execute(command: ApproveFollowCommand): Promise<ConnectionResponseDto> {
    const { connectionId, currentUserId } = command;

    const connId = ConnectionId.create(connectionId);
    const connection = await this.connectionRepo.findById(connId);

    if (!connection) {
      throw new NotFoundException('Connection request not found');
    }

    // Only the followee can approve a follow request
    if (connection.followeeId.value !== currentUserId) {
      throw new ForbiddenException('Only the followee can approve this request');
    }

    connection.approve();
    await this.connectionRepo.save(connection);

    return ConnectionResponseDto.fromDomain(connection);
  }
}

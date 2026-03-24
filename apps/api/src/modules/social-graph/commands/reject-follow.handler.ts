import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConnectionId, IConnectionRepository } from '@csn/domain-social-graph';
import { RejectFollowCommand } from './reject-follow.command';

@Injectable()
export class RejectFollowHandler {
  constructor(
    @Inject('IConnectionRepository')
    private readonly connectionRepo: IConnectionRepository,
  ) {}

  async execute(command: RejectFollowCommand): Promise<void> {
    const { connectionId, currentUserId } = command;

    const connId = ConnectionId.create(connectionId);
    const connection = await this.connectionRepo.findById(connId);

    if (!connection) {
      throw new NotFoundException('Connection request not found');
    }

    // Only the followee can reject a follow request
    if (connection.followeeId.value !== currentUserId) {
      throw new ForbiddenException('Only the followee can reject this request');
    }

    connection.reject();
    await this.connectionRepo.save(connection);
  }
}

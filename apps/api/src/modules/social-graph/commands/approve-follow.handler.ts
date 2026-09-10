import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConnectionId, IConnectionRepository } from '@csn/domain-social-graph';
import { AlertType } from '@csn/domain-notification';
import { ApproveFollowCommand } from './approve-follow.command';
import { ConnectionResponseDto } from '../dto/connection-response.dto';
import { AlertCreatorService } from '../../notification/services/alert-creator.service';

@Injectable()
export class ApproveFollowHandler {
  constructor(
    @Inject('IConnectionRepository')
    private readonly connectionRepo: IConnectionRepository,
    @Inject(AlertCreatorService)
    private readonly alerts: AlertCreatorService,
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

    // Best-effort: alert the follower that their request was accepted.
    await this.alerts.create({
      recipientId: connection.followerId.value,
      actorId: connection.followeeId.value,
      type: AlertType.FOLLOW,
      verb: 'accepted your follow request',
      actionUrl: `/profiles/${connection.followeeId.value}`,
      sourceId: connection.id.value,
    });

    return ConnectionResponseDto.fromDomain(connection);
  }
}

import { Inject, Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Connection,
  IConnectionRepository,
  IBlockRepository,
} from '@csn/domain-social-graph';
import { AlertType } from '@csn/domain-notification';
import { FollowMemberCommand } from './follow-member.command';
import { ConnectionResponseDto } from '../dto/connection-response.dto';
import { AlertCreatorService } from '../../notification/services/alert-creator.service';

@Injectable()
export class FollowMemberHandler {
  constructor(
    @Inject('IConnectionRepository')
    private readonly connectionRepo: IConnectionRepository,
    @Inject('IBlockRepository')
    private readonly blockRepo: IBlockRepository,
    private readonly alerts: AlertCreatorService,
  ) {}

  async execute(command: FollowMemberCommand): Promise<ConnectionResponseDto> {
    const { followerId, followeeId } = command;

    if (followerId === followeeId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    const followerUserId = UserId.create(followerId);
    const followeeUserId = UserId.create(followeeId);

    // Check if blocked
    const isBlocked = await this.blockRepo.isBlocked(followerUserId, followeeUserId);
    if (isBlocked) {
      throw new BadRequestException('Cannot follow this user');
    }

    // Check if already following or pending
    const existing = await this.connectionRepo.findByFollowerAndFollowee(
      followerUserId,
      followeeUserId,
    );
    if (existing) {
      throw new ConflictException('Follow request already exists');
    }

    const connectionId = this.connectionRepo.nextId();
    const connection = Connection.request(connectionId, followerUserId, followeeUserId);

    await this.connectionRepo.save(connection);

    // Best-effort: alert the followee that someone wants to follow them.
    await this.alerts.create({
      recipientId: followeeId,
      actorId: followerId,
      type: AlertType.FOLLOW,
      verb: 'sent you a follow request',
      actionUrl: '/connections',
      sourceId: connection.id.value,
    });

    return ConnectionResponseDto.fromDomain(connection);
  }
}

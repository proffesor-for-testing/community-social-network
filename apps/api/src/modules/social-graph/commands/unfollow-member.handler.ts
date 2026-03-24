import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import { IConnectionRepository } from '@csn/domain-social-graph';
import { UnfollowMemberCommand } from './unfollow-member.command';

@Injectable()
export class UnfollowMemberHandler {
  constructor(
    @Inject('IConnectionRepository')
    private readonly connectionRepo: IConnectionRepository,
  ) {}

  async execute(command: UnfollowMemberCommand): Promise<void> {
    const { followerId, followeeId } = command;

    const followerUserId = UserId.create(followerId);
    const followeeUserId = UserId.create(followeeId);

    const connection = await this.connectionRepo.findByFollowerAndFollowee(
      followerUserId,
      followeeUserId,
    );

    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    connection.unfollow();
    await this.connectionRepo.delete(connection);
  }
}

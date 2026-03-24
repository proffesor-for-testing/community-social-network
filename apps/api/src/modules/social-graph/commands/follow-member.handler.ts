import { Inject, Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Connection,
  IConnectionRepository,
  IBlockRepository,
} from '@csn/domain-social-graph';
import { FollowMemberCommand } from './follow-member.command';
import { ConnectionResponseDto } from '../dto/connection-response.dto';

@Injectable()
export class FollowMemberHandler {
  constructor(
    @Inject('IConnectionRepository')
    private readonly connectionRepo: IConnectionRepository,
    @Inject('IBlockRepository')
    private readonly blockRepo: IBlockRepository,
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

    return ConnectionResponseDto.fromDomain(connection);
  }
}

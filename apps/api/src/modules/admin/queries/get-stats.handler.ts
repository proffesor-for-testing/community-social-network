import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { MemberEntity } from '@csn/infra-identity';
import { PublicationEntity, ReactionEntity } from '@csn/infra-content';
import { GroupEntity } from '@csn/infra-community';

export interface AdminStatsResult {
  totalUsers: number;
  activeUsers: number;
  totalPosts: number;
  totalGroups: number;
  totalReactions: number;
  newUsersToday: number;
  newPostsToday: number;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
}

@Injectable()
export class GetAdminStatsHandler {
  constructor(
    @InjectRepository(MemberEntity)
    private readonly memberRepo: Repository<MemberEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
    @InjectRepository(ReactionEntity)
    private readonly reactionRepo: Repository<ReactionEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
  ) {}

  async execute(): Promise<AdminStatsResult> {
    const todayStart = startOfTodayUtc();
    const [
      totalUsers,
      activeUsers,
      totalPosts,
      totalGroups,
      totalReactions,
      newUsersToday,
      newPostsToday,
    ] = await Promise.all([
      this.memberRepo.count(),
      this.memberRepo.count({ where: { status: 'ACTIVE' } }),
      this.publicationRepo.count(),
      this.groupRepo.count(),
      this.reactionRepo.count(),
      this.memberRepo.count({ where: { createdAt: MoreThanOrEqual(todayStart) } }),
      this.publicationRepo.count({ where: { createdAt: MoreThanOrEqual(todayStart) } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalPosts,
      totalGroups,
      totalReactions,
      newUsersToday,
      newPostsToday,
    };
  }
}

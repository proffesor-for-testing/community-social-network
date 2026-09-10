import { Inject, Injectable } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  GroupId as CommunityGroupId,
  IMembershipRepository,
} from '@csn/domain-community';
import { MEMBERSHIP_REPOSITORY } from '@csn/infra-community';

/**
 * Read-only access-control lookup into the Community context.
 *
 * Publications are owned by Content, but "who may post into this group" is a
 * Community rule. Content consumes it through this single narrow port instead
 * of reaching into Community's aggregates, so the dependency stays one-way and
 * obvious.
 */
@Injectable()
export class GroupMembershipChecker {
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: IMembershipRepository,
  ) {}

  /**
   * True when the member currently holds a membership row for the group.
   * Leaving and being kicked both delete the row, so presence is the
   * authoritative "active member" signal.
   */
  async isActiveMember(groupId: string, memberId: string): Promise<boolean> {
    const membership = await this.membershipRepository.findByGroupAndMember(
      CommunityGroupId.create(groupId),
      UserId.create(memberId),
    );
    return membership !== null;
  }
}

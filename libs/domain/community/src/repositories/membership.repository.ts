import { IRepository, UserId, PaginatedResult, PaginationParams } from '@csn/domain-shared';
import { Membership } from '../aggregates/membership';
import { MembershipId } from '../value-objects/membership-id';
import { GroupId } from '../value-objects/group-id';

export interface IMembershipRepository extends IRepository<Membership, MembershipId> {
  findByGroupId(groupId: GroupId, pagination?: PaginationParams): Promise<PaginatedResult<Membership>>;
  findByMemberId(memberId: UserId, pagination?: PaginationParams): Promise<PaginatedResult<Membership>>;
  findByGroupAndMember(groupId: GroupId, memberId: UserId): Promise<Membership | null>;
}

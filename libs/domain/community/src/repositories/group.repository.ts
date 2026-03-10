import { IRepository, UserId, PaginatedResult, PaginationParams } from '@csn/domain-shared';
import { Group } from '../aggregates/group';
import { GroupId } from '../value-objects/group-id';

export interface IGroupRepository extends IRepository<Group, GroupId> {
  findByOwnerId(ownerId: UserId, pagination?: PaginationParams): Promise<PaginatedResult<Group>>;
  search(query: string, pagination?: PaginationParams): Promise<PaginatedResult<Group>>;
}

import { IRepository, UserId } from '@csn/domain-shared';
import { Profile } from '../aggregates/profile';
import { ProfileId } from '../value-objects/profile-id';

export interface IProfileRepository extends IRepository<Profile, ProfileId> {
  findByMemberId(memberId: UserId): Promise<Profile | null>;
}

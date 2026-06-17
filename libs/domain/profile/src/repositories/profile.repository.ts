import { IRepository, UserId } from '@csn/domain-shared';
import { Profile } from '../aggregates/profile';
import { ProfileId } from '../value-objects/profile-id';

export interface IProfileRepository extends IRepository<Profile, ProfileId> {
  findByMemberId(memberId: UserId): Promise<Profile | null>;
  /**
   * Batch lookup. Returns a Map keyed by member id (string) so callers can
   * O(1)-enrich author data without N+1 round trips. Missing ids are absent
   * from the map (never `null` entries).
   */
  findByMemberIds(memberIds: UserId[]): Promise<Map<string, Profile>>;
}

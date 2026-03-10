import { IRepository, UserId } from '@csn/domain-shared';
import { Preference } from '../aggregates/preference';
import { PreferenceId } from '../value-objects/preference-id';

export interface IPreferenceRepository extends IRepository<Preference, PreferenceId> {
  findByMemberId(memberId: UserId): Promise<Preference | null>;
}

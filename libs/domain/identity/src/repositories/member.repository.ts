import { IRepository, Email } from '@csn/domain-shared';
import { Member } from '../aggregates/member';
import { MemberId } from '../value-objects/member-id';

export interface IMemberRepository extends IRepository<Member, MemberId> {
  findByEmail(email: Email): Promise<Member | null>;
}

import { IRepository } from '@csn/domain-shared';
import { Session } from '../aggregates/session';
import { SessionId } from '../value-objects/session-id';
import { MemberId } from '../value-objects/member-id';

export interface ISessionRepository extends IRepository<Session, SessionId> {
  findActiveByMemberId(memberId: MemberId): Promise<Session[]>;
  countActiveByMemberId(memberId: MemberId): Promise<number>;
}

import { Email, Timestamp } from '@csn/domain-shared';
import {
  Member,
  MemberId,
  Credential,
  MemberStatus,
} from '@csn/domain-identity';
import { AggregateMapper } from '@csn/infra-shared';
import { MemberEntity } from '../entities/member.entity';

export class MemberMapper implements AggregateMapper<Member, MemberEntity> {
  toDomain(raw: MemberEntity): Member {
    return Member.reconstitute(
      MemberId.create(raw.id),
      Email.create(raw.email),
      Credential.create(raw.passwordHash),
      MemberStatus.create(raw.status),
      raw.displayName,
      raw.failedLoginAttempts,
      raw.lastLoginAt ? Timestamp.fromDate(raw.lastLoginAt) : null,
      Timestamp.fromDate(raw.createdAt),
      raw.version,
    );
  }

  toPersistence(domain: Member): MemberEntity {
    const entity = new MemberEntity();
    entity.id = domain.id.value;
    entity.email = domain.email.value;
    entity.passwordHash = domain.credential.value;
    entity.status = domain.status.value;
    entity.displayName = domain.displayName;
    entity.failedLoginAttempts = domain.failedLoginAttempts;
    entity.lastLoginAt = domain.lastLoginAt
      ? domain.lastLoginAt.value
      : null;
    entity.createdAt = domain.createdAt.value;
    entity.version = domain.version;
    return entity;
  }
}

import { AggregateMapper } from '@csn/infra-shared';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Membership,
  MembershipId,
  GroupId,
  MembershipRole,
} from '@csn/domain-community';
import { MembershipEntity } from '../entities/membership.entity';

export class MembershipMapper
  implements AggregateMapper<Membership, MembershipEntity>
{
  toDomain(raw: MembershipEntity): Membership {
    return Membership.reconstitute(
      MembershipId.create(raw.id),
      GroupId.create(raw.groupId),
      UserId.create(raw.memberId),
      raw.role as MembershipRole,
      Timestamp.fromDate(raw.joinedAt),
      raw.version,
    );
  }

  toPersistence(domain: Membership): MembershipEntity {
    const entity = new MembershipEntity();
    entity.id = domain.id.value;
    entity.groupId = domain.groupId.value;
    entity.memberId = domain.memberId.value;
    entity.role = domain.role as string;
    entity.joinedAt = domain.joinedAt.value;
    entity.leftAt = null;
    entity.kickedAt = null;
    entity.kickedBy = null;
    entity.version = domain.version;
    return entity;
  }
}

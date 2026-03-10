import { AggregateMapper } from '@csn/infra-shared';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Group,
  GroupId,
  GroupName,
  GroupDescription,
  GroupSettings,
  GroupRule,
  GroupStatus,
} from '@csn/domain-community';
import { GroupEntity } from '../entities/group.entity';

export class GroupMapper implements AggregateMapper<Group, GroupEntity> {
  toDomain(raw: GroupEntity): Group {
    const rules = (raw.rules ?? []).map((r) =>
      GroupRule.create(r.title, r.description),
    );

    return Group.reconstitute(
      GroupId.create(raw.id),
      GroupName.create(raw.name),
      GroupDescription.create(raw.description),
      UserId.create(raw.ownerId),
      GroupSettings.create({
        isPublic: raw.isPublic,
        requireApproval: raw.requireApproval,
        allowMemberPosts: raw.allowMemberPosts,
      }),
      rules,
      raw.status as GroupStatus,
      raw.memberCount,
      Timestamp.fromDate(raw.createdAt),
      raw.version,
    );
  }

  toPersistence(domain: Group): GroupEntity {
    const entity = new GroupEntity();
    entity.id = domain.id.value;
    entity.name = domain.name.value;
    entity.description = domain.description.value;
    entity.ownerId = domain.ownerId.value;
    entity.isPublic = domain.settings.isPublic;
    entity.requireApproval = domain.settings.requireApproval;
    entity.allowMemberPosts = domain.settings.allowMemberPosts;
    entity.rules = domain.rules.map((r) => ({
      title: r.title,
      description: r.description,
    }));
    entity.status = domain.status as string;
    entity.memberCount = domain.memberCount;
    entity.createdAt = domain.createdAt.value;
    entity.version = domain.version;
    return entity;
  }
}

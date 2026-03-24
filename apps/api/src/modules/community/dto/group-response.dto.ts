import { Group } from '@csn/domain-community';

export class GroupResponseDto {
  id!: string;
  name!: string;
  description!: string;
  ownerId!: string;
  settings!: {
    isPublic: boolean;
    requireApproval: boolean;
    allowMemberPosts: boolean;
  };
  memberCount!: number;
  status!: string;
  createdAt!: string;

  static fromDomain(group: Group): GroupResponseDto {
    const dto = new GroupResponseDto();
    dto.id = group.id.value;
    dto.name = group.name.value;
    dto.description = group.description.value;
    dto.ownerId = group.ownerId.value;
    dto.settings = {
      isPublic: group.settings.isPublic,
      requireApproval: group.settings.requireApproval,
      allowMemberPosts: group.settings.allowMemberPosts,
    };
    dto.memberCount = group.memberCount;
    dto.status = group.status;
    dto.createdAt = group.createdAt.toISO();
    return dto;
  }
}

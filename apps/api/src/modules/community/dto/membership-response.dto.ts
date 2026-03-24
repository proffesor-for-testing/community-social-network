import { Membership } from '@csn/domain-community';

export class MembershipResponseDto {
  id!: string;
  groupId!: string;
  memberId!: string;
  role!: string;
  joinedAt!: string;

  static fromDomain(membership: Membership): MembershipResponseDto {
    const dto = new MembershipResponseDto();
    dto.id = membership.id.value;
    dto.groupId = membership.groupId.value;
    dto.memberId = membership.memberId.value;
    dto.role = membership.role;
    dto.joinedAt = membership.joinedAt.toISO();
    return dto;
  }
}

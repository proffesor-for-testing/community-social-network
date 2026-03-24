import { ApiProperty } from '@nestjs/swagger';

export class MemberResponseDto {
  @ApiProperty({ description: 'Unique member identifier (UUID)', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ description: 'Member email address', example: 'user@example.com' })
  email!: string;

  @ApiProperty({ description: 'Display name', example: 'Jane Doe' })
  displayName!: string;

  @ApiProperty({ description: 'Account status', example: 'ACTIVE', enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED'] })
  status!: string;

  @ApiProperty({ description: 'Account creation timestamp', example: '2024-01-15T10:30:00.000Z' })
  createdAt!: string;

  static fromDomain(member: {
    id: { value: string };
    email: { value: string };
    displayName: string;
    status: { value: string };
    createdAt: { value: Date };
  }): MemberResponseDto {
    const dto = new MemberResponseDto();
    dto.id = member.id.value;
    dto.email = member.email.value;
    dto.displayName = member.displayName;
    dto.status = member.status.value;
    dto.createdAt = member.createdAt.value.toISOString();
    return dto;
  }
}

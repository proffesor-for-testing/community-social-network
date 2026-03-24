import { IsEnum } from 'class-validator';

export enum UpdateableRole {
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
}

export class UpdateMemberRoleDto {
  @IsEnum(UpdateableRole, {
    message: 'role must be one of: ADMIN, MODERATOR, MEMBER',
  })
  role!: UpdateableRole;
}

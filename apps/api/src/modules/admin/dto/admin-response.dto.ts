import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUserResponseDto {
  @ApiProperty({ description: 'Member UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ description: 'Member email address', example: 'user@example.com' })
  email!: string;

  @ApiProperty({ description: 'Display name', example: 'Jane Doe' })
  displayName!: string;

  @ApiProperty({
    description: 'Account status',
    example: 'ACTIVE',
    enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED'],
  })
  status!: string;

  @ApiProperty({ description: 'Failed login attempt count', example: 0 })
  failedLoginAttempts!: number;

  @ApiPropertyOptional({ description: 'Last login timestamp', example: '2024-03-15T10:30:00.000Z' })
  lastLoginAt!: string | null;

  @ApiProperty({ description: 'Account creation timestamp', example: '2024-01-15T10:30:00.000Z' })
  createdAt!: string;

  static fromDomain(member: {
    id: { value: string };
    email: { value: string };
    displayName: string;
    status: { value: string };
    failedLoginAttempts: number;
    lastLoginAt: { value: Date } | null;
    createdAt: { value: Date };
  }): AdminUserResponseDto {
    const dto = new AdminUserResponseDto();
    dto.id = member.id.value;
    dto.email = member.email.value;
    dto.displayName = member.displayName;
    dto.status = member.status.value;
    dto.failedLoginAttempts = member.failedLoginAttempts;
    dto.lastLoginAt = member.lastLoginAt
      ? member.lastLoginAt.value.toISOString()
      : null;
    dto.createdAt = member.createdAt.value.toISOString();
    return dto;
  }
}

export class AuditLogResponseDto {
  @ApiProperty({ description: 'Audit entry UUID', example: 'b1c2d3e4-f5a6-7890-bcde-fa1234567890' })
  id!: string;

  @ApiProperty({ description: 'Action performed', example: 'SUSPEND_USER' })
  action!: string;

  @ApiProperty({ description: 'UUID of the admin who performed the action', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  performedBy!: string;

  @ApiProperty({ description: 'Target resource identifier', example: 'c1d2e3f4-a5b6-7890-cdef-ab1234567890' })
  targetId!: string;

  @ApiProperty({ description: 'Target resource type', example: 'Member' })
  targetType!: string;

  @ApiProperty({ description: 'Additional details about the action' })
  details!: Record<string, unknown>;

  @ApiProperty({ description: 'IP address of the actor', example: '192.168.1.1' })
  ipAddress!: string;

  @ApiProperty({ description: 'When the action was performed', example: '2024-03-15T10:30:00.000Z' })
  createdAt!: string;

  static fromDomain(entry: {
    id: { value: string };
    action: string;
    performedBy: { value: string };
    targetId: string;
    targetType: string;
    details: Record<string, unknown>;
    ipAddress: { value: string };
    createdAt: { value: Date };
  }): AuditLogResponseDto {
    const dto = new AuditLogResponseDto();
    dto.id = entry.id.value;
    dto.action = entry.action;
    dto.performedBy = entry.performedBy.value;
    dto.targetId = entry.targetId;
    dto.targetType = entry.targetType;
    dto.details = { ...entry.details };
    dto.ipAddress = entry.ipAddress.value;
    dto.createdAt = entry.createdAt.value.toISOString();
    return dto;
  }
}

export class SecurityAlertResponseDto {
  @ApiProperty({ description: 'Alert UUID', example: 'd1e2f3a4-b5c6-7890-defg-bc1234567890' })
  id!: string;

  @ApiProperty({ description: 'Alert severity level', example: 'HIGH', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  severity!: string;

  @ApiProperty({ description: 'Description of the security alert', example: 'Multiple failed admin login attempts detected' })
  description!: string;

  @ApiProperty({ description: 'Related action', example: 'ADMIN_LOGIN_FAILED' })
  action!: string;

  @ApiProperty({ description: 'Actor who triggered the alert', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  actorId!: string;

  @ApiProperty({ description: 'IP address of the actor', example: '192.168.1.1' })
  ipAddress!: string;

  @ApiProperty({ description: 'When the alert was raised', example: '2024-03-15T10:30:00.000Z' })
  createdAt!: string;

  static fromAuditEntry(entry: {
    id: { value: string };
    action: string;
    performedBy: { value: string };
    details: Record<string, unknown>;
    ipAddress: { value: string };
    createdAt: { value: Date };
  }): SecurityAlertResponseDto {
    const dto = new SecurityAlertResponseDto();
    dto.id = entry.id.value;
    dto.severity = (entry.details.severity as string) ?? 'MEDIUM';
    dto.description = (entry.details.description as string) ?? entry.action;
    dto.action = entry.action;
    dto.actorId = entry.performedBy.value;
    dto.ipAddress = entry.ipAddress.value;
    dto.createdAt = entry.createdAt.value.toISOString();
    return dto;
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Alert } from '@csn/domain-notification';

export class NotificationResponseDto {
  @ApiProperty({ description: 'Alert ID (UUID)', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ description: 'Recipient member ID (UUID)', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  recipientId: string;

  @ApiProperty({
    description: 'Alert type',
    example: 'FOLLOW',
    enum: ['FOLLOW', 'LIKE', 'COMMENT', 'MENTION', 'GROUP_INVITE', 'GROUP_POST', 'SYSTEM'],
  })
  type: string;

  @ApiProperty({
    description: 'Alert content',
    example: { title: 'New follower', body: 'Jane started following you', actionUrl: '/profile/jane' },
  })
  content: { title: string; body: string; actionUrl?: string };

  @ApiProperty({
    description: 'Alert status',
    example: 'UNREAD',
    enum: ['UNREAD', 'READ', 'DISMISSED'],
  })
  status: string;

  @ApiProperty({ description: 'Creation timestamp (ISO 8601)', example: '2024-03-15T10:30:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({ description: 'Read timestamp (ISO 8601) or null', example: null, nullable: true })
  readAt: string | null;

  public static fromDomain(alert: Alert): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = alert.id.value;
    dto.recipientId = alert.recipientId.value;
    dto.type = alert.type;
    dto.content = {
      title: alert.content.title,
      body: alert.content.body,
      actionUrl: alert.content.actionUrl,
    };
    dto.status = alert.status;
    dto.createdAt = alert.createdAt.value.toISOString();
    dto.readAt = alert.readAt ? alert.readAt.value.toISOString() : null;
    return dto;
  }
}

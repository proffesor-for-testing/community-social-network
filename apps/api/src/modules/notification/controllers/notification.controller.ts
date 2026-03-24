import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '@csn/infra-auth';

import { NotificationQueryDto } from '../dto/notification-query.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { UnreadCountResponseDto } from '../dto/unread-count-response.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { PreferenceResponseDto } from '../dto/preference-response.dto';

import { MarkReadHandler } from '../commands/mark-read.handler';
import { MarkReadCommand } from '../commands/mark-read.command';
import { MarkAllReadHandler } from '../commands/mark-all-read.handler';
import { MarkAllReadCommand } from '../commands/mark-all-read.command';
import { UpdatePreferencesHandler } from '../commands/update-preferences.handler';
import { UpdatePreferencesCommand } from '../commands/update-preferences.command';

import { GetNotificationsHandler } from '../queries/get-notifications.handler';
import { GetNotificationsQuery } from '../queries/get-notifications.query';
import { GetUnreadCountHandler } from '../queries/get-unread-count.handler';
import { GetUnreadCountQuery } from '../queries/get-unread-count.query';
import { GetPreferencesHandler } from '../queries/get-preferences.handler';
import { GetPreferencesQuery } from '../queries/get-preferences.query';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('api/notifications')
export class NotificationController {
  constructor(
    private readonly getNotificationsHandler: GetNotificationsHandler,
    private readonly getUnreadCountHandler: GetUnreadCountHandler,
    private readonly getPreferencesHandler: GetPreferencesHandler,
    private readonly markReadHandler: MarkReadHandler,
    private readonly markAllReadHandler: MarkAllReadHandler,
    private readonly updatePreferencesHandler: UpdatePreferencesHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated notifications for the current user' })
  @ApiResponse({ status: 200, description: 'Paginated list of notifications' })
  async getNotifications(
    @CurrentUser('userId') userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    return this.getNotificationsHandler.execute(
      new GetNotificationsQuery(
        userId,
        query.cursor ?? 1,
        query.limit ?? 20,
        query.unreadOnly ?? false,
      ),
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get the count of unread notifications' })
  @ApiResponse({ status: 200, description: 'Unread notification count', type: UnreadCountResponseDto })
  async getUnreadCount(
    @CurrentUser('userId') userId: string,
  ): Promise<UnreadCountResponseDto> {
    const count = await this.getUnreadCountHandler.execute(
      new GetUnreadCountQuery(userId),
    );
    return UnreadCountResponseDto.of(count);
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @ApiResponse({ status: 204, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 403, description: 'Cannot mark another member\'s notification' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    await this.markReadHandler.execute(new MarkReadCommand(id, userId));
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'Number of notifications marked as read' })
  async markAllAsRead(
    @CurrentUser('userId') userId: string,
  ): Promise<{ markedCount: number }> {
    const markedCount = await this.markAllReadHandler.execute(
      new MarkAllReadCommand(userId),
    );
    return { markedCount };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for the current user' })
  @ApiResponse({ status: 200, description: 'Notification preferences', type: PreferenceResponseDto })
  async getPreferences(
    @CurrentUser('userId') userId: string,
  ): Promise<PreferenceResponseDto> {
    return this.getPreferencesHandler.execute(
      new GetPreferencesQuery(userId),
    );
  }

  @Put('preferences')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({ status: 204, description: 'Preferences updated' })
  @ApiResponse({ status: 400, description: 'Invalid alert type or delivery channel' })
  async updatePreferences(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<void> {
    await this.updatePreferencesHandler.execute(
      new UpdatePreferencesCommand(userId, dto.preferences),
    );
  }
}

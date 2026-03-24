// Module
export { NotificationModule } from './notification.module';

// DTOs
export { NotificationResponseDto } from './dto/notification-response.dto';
export { UnreadCountResponseDto } from './dto/unread-count-response.dto';
export { UpdatePreferencesDto } from './dto/update-preferences.dto';
export { PreferenceResponseDto } from './dto/preference-response.dto';
export { NotificationQueryDto } from './dto/notification-query.dto';

// Commands
export { CreateAlertCommand } from './commands/create-alert.command';
export { CreateAlertHandler } from './commands/create-alert.handler';
export { MarkReadCommand } from './commands/mark-read.command';
export { MarkReadHandler } from './commands/mark-read.handler';
export { MarkAllReadCommand } from './commands/mark-all-read.command';
export { MarkAllReadHandler } from './commands/mark-all-read.handler';
export { UpdatePreferencesCommand } from './commands/update-preferences.command';
export { UpdatePreferencesHandler } from './commands/update-preferences.handler';

// Queries
export { GetNotificationsQuery } from './queries/get-notifications.query';
export { GetNotificationsHandler } from './queries/get-notifications.handler';
export { GetUnreadCountQuery } from './queries/get-unread-count.query';
export { GetUnreadCountHandler } from './queries/get-unread-count.handler';
export { GetPreferencesQuery } from './queries/get-preferences.query';
export { GetPreferencesHandler } from './queries/get-preferences.handler';

// Controller
export { NotificationController } from './controllers/notification.controller';

import { Module } from '@nestjs/common';
import { NotificationInfrastructureModule } from '@csn/infra-notification';
import { ProfileInfrastructureModule } from '@csn/infra-profile';
import { NotificationController } from './controllers/notification.controller';

// Command handlers
import { CreateAlertHandler } from './commands/create-alert.handler';
import { MarkReadHandler } from './commands/mark-read.handler';
import { MarkAllReadHandler } from './commands/mark-all-read.handler';
import { UpdatePreferencesHandler } from './commands/update-preferences.handler';

// Query handlers
import { GetNotificationsHandler } from './queries/get-notifications.handler';
import { GetUnreadCountHandler } from './queries/get-unread-count.handler';
import { GetPreferencesHandler } from './queries/get-preferences.handler';

// Services
import { AlertCreatorService } from './services/alert-creator.service';

@Module({
  imports: [NotificationInfrastructureModule, ProfileInfrastructureModule],
  controllers: [NotificationController],
  providers: [
    // Commands
    CreateAlertHandler,
    MarkReadHandler,
    MarkAllReadHandler,
    UpdatePreferencesHandler,
    // Queries
    GetNotificationsHandler,
    GetUnreadCountHandler,
    GetPreferencesHandler,
    // Services
    AlertCreatorService,
  ],
  exports: [CreateAlertHandler, AlertCreatorService],
})
export class NotificationModule {}

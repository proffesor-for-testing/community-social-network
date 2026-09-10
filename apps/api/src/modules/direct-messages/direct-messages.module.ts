import { Module } from '@nestjs/common';
import { DirectMessagesInfrastructureModule } from '@csn/infra-direct-messages';
import { SocialGraphInfrastructureModule } from '@csn/infra-social-graph';
import { ProfileInfrastructureModule } from '@csn/infra-profile';
import { NotificationModule } from '../notification/notification.module';
import { ConversationController } from './controllers/conversation.controller';

// Command handlers
import { StartConversationHandler } from './commands/start-conversation.handler';
import { SendMessageHandler } from './commands/send-message.handler';
import { MarkConversationReadHandler } from './commands/mark-conversation-read.handler';

// Query handlers
import { ListConversationsHandler } from './queries/list-conversations.handler';
import { GetMessagesHandler } from './queries/get-messages.handler';

@Module({
  imports: [
    DirectMessagesInfrastructureModule,
    SocialGraphInfrastructureModule,
    ProfileInfrastructureModule,
    NotificationModule,
  ],
  controllers: [ConversationController],
  providers: [
    StartConversationHandler,
    SendMessageHandler,
    MarkConversationReadHandler,
    ListConversationsHandler,
    GetMessagesHandler,
  ],
  exports: [StartConversationHandler, SendMessageHandler],
})
export class DirectMessagesModule {}

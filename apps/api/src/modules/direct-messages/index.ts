// Module
export { DirectMessagesModule } from './direct-messages.module';

// DTOs
export { StartConversationDto } from './dto/start-conversation.dto';
export { SendMessageDto } from './dto/send-message.dto';
export { MessageQueryDto } from './dto/message-query.dto';
export {
  ConversationResponseDto,
  ConversationParticipantDto,
} from './dto/conversation-response.dto';
export { MessageResponseDto } from './dto/message-response.dto';

// Commands
export { StartConversationCommand } from './commands/start-conversation.command';
export { StartConversationHandler } from './commands/start-conversation.handler';
export { SendMessageCommand } from './commands/send-message.command';
export { SendMessageHandler } from './commands/send-message.handler';
export { MarkConversationReadCommand } from './commands/mark-conversation-read.command';
export {
  MarkConversationReadHandler,
  MarkConversationReadResult,
} from './commands/mark-conversation-read.handler';

// Queries
export { ListConversationsQuery } from './queries/list-conversations.query';
export {
  ListConversationsHandler,
  ConversationListResult,
} from './queries/list-conversations.handler';
export { GetMessagesQuery } from './queries/get-messages.query';
export { GetMessagesHandler, MessagePageResult } from './queries/get-messages.handler';

// Controller
export { ConversationController } from './controllers/conversation.controller';

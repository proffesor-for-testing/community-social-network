// Entities
export { ConversationEntity } from './entities/conversation.entity';
export { DirectMessageEntity } from './entities/direct-message.entity';

// Mappers
export { ConversationMapper } from './mappers/conversation.mapper';
export { DirectMessageMapper } from './mappers/direct-message.mapper';

// Repositories - Postgres
export { PostgresConversationRepository } from './repositories/postgres-conversation.repository';
export { PostgresDirectMessageRepository } from './repositories/postgres-direct-message.repository';

// Repositories - In-Memory (testing)
export { InMemoryConversationRepository } from './repositories/in-memory-conversation.repository';
export { InMemoryDirectMessageRepository } from './repositories/in-memory-direct-message.repository';

// Module
export {
  DirectMessagesInfrastructureModule,
  CONVERSATION_REPOSITORY_TOKEN,
  MESSAGE_REPOSITORY_TOKEN,
} from './direct-messages.infrastructure.module';

// Migrations
export { CreateDirectMessageTables1710000008000 } from './migrations/1710000008000-create-direct-message-tables';

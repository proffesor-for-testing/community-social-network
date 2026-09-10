import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationEntity } from './entities/conversation.entity';
import { DirectMessageEntity } from './entities/direct-message.entity';
import { PostgresConversationRepository } from './repositories/postgres-conversation.repository';
import { PostgresDirectMessageRepository } from './repositories/postgres-direct-message.repository';

export const CONVERSATION_REPOSITORY_TOKEN = 'IConversationRepository';
export const MESSAGE_REPOSITORY_TOKEN = 'IMessageRepository';

@Module({
  imports: [TypeOrmModule.forFeature([ConversationEntity, DirectMessageEntity])],
  providers: [
    {
      provide: CONVERSATION_REPOSITORY_TOKEN,
      useFactory: (repo: Repository<ConversationEntity>) =>
        new PostgresConversationRepository(repo),
      inject: [getRepositoryToken(ConversationEntity)],
    },
    {
      provide: MESSAGE_REPOSITORY_TOKEN,
      useFactory: (repo: Repository<DirectMessageEntity>) =>
        new PostgresDirectMessageRepository(repo),
      inject: [getRepositoryToken(DirectMessageEntity)],
    },
  ],
  exports: [CONVERSATION_REPOSITORY_TOKEN, MESSAGE_REPOSITORY_TOKEN],
})
export class DirectMessagesInfrastructureModule {}

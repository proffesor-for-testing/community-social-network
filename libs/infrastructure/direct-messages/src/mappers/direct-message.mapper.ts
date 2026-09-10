import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Message,
  MessageId,
  MessageContent,
  ConversationId,
} from '@csn/domain-direct-messages';
import { AggregateMapper } from '@csn/infra-shared';
import { DirectMessageEntity } from '../entities/direct-message.entity';

export class DirectMessageMapper
  implements AggregateMapper<Message, DirectMessageEntity>
{
  toDomain(raw: DirectMessageEntity): Message {
    return Message.reconstitute(
      MessageId.create(raw.id),
      ConversationId.create(raw.conversationId),
      UserId.create(raw.senderId),
      MessageContent.create(raw.content),
      Timestamp.fromDate(raw.createdAt),
      raw.readAt ? Timestamp.fromDate(raw.readAt) : null,
      raw.version,
    );
  }

  toPersistence(domain: Message): DirectMessageEntity {
    const entity = new DirectMessageEntity();
    entity.id = domain.id.value;
    entity.conversationId = domain.conversationId.value;
    entity.senderId = domain.senderId.value;
    entity.content = domain.content.value;
    entity.createdAt = domain.createdAt.value;
    entity.readAt = domain.readAt ? domain.readAt.value : null;
    entity.version = domain.version;
    return entity;
  }
}

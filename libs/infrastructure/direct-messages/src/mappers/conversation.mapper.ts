import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Conversation,
  ConversationId,
  ParticipantPair,
} from '@csn/domain-direct-messages';
import { AggregateMapper } from '@csn/infra-shared';
import { ConversationEntity } from '../entities/conversation.entity';

export class ConversationMapper
  implements AggregateMapper<Conversation, ConversationEntity>
{
  toDomain(raw: ConversationEntity): Conversation {
    return Conversation.reconstitute(
      ConversationId.create(raw.id),
      ParticipantPair.create(
        UserId.create(raw.participantA),
        UserId.create(raw.participantB),
      ),
      Timestamp.fromDate(raw.createdAt),
      Timestamp.fromDate(raw.updatedAt),
      raw.version,
    );
  }

  toPersistence(domain: Conversation): ConversationEntity {
    const entity = new ConversationEntity();
    entity.id = domain.id.value;
    entity.participantA = domain.participants.participantA.value;
    entity.participantB = domain.participants.participantB.value;
    entity.createdAt = domain.createdAt.value;
    entity.updatedAt = domain.updatedAt.value;
    entity.version = domain.version;
    return entity;
  }
}

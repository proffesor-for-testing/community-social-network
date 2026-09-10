import { Repository, FindOptionsWhere } from 'typeorm';
import { UserId } from '@csn/domain-shared';
import {
  Conversation,
  ConversationId,
  ParticipantPair,
  IConversationRepository,
} from '@csn/domain-direct-messages';
import { BaseRepository } from '@csn/infra-shared';
import { ConversationEntity } from '../entities/conversation.entity';
import { ConversationMapper } from '../mappers/conversation.mapper';

export class PostgresConversationRepository
  extends BaseRepository<Conversation, ConversationId, ConversationEntity>
  implements IConversationRepository
{
  constructor(ormRepository: Repository<ConversationEntity>) {
    super(ormRepository, new ConversationMapper());
  }

  nextId(): ConversationId {
    return ConversationId.generate();
  }

  protected idCondition(id: ConversationId): FindOptionsWhere<ConversationEntity> {
    return { id: id.value } as FindOptionsWhere<ConversationEntity>;
  }

  async findByParticipants(pair: ParticipantPair): Promise<Conversation | null> {
    const entity = await this.ormRepository.findOne({
      where: {
        participantA: pair.participantA.value,
        participantB: pair.participantB.value,
      } as FindOptionsWhere<ConversationEntity>,
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findOrCreate(pair: ParticipantPair): Promise<Conversation> {
    const existing = await this.findByParticipants(pair);
    if (existing) {
      return existing;
    }

    const conversation = Conversation.create(this.nextId(), pair);

    try {
      await this.save(conversation);
      return conversation;
    } catch (error) {
      // A concurrent caller won the unique (participant_a, participant_b)
      // race. Their conversation is the canonical one, so adopt it.
      const raced = await this.findByParticipants(pair);
      if (raced) {
        return raced;
      }
      throw error;
    }
  }

  async findByParticipant(userId: UserId): Promise<Conversation[]> {
    const entities = await this.ormRepository
      .createQueryBuilder('conversation')
      .where('conversation.participantA = :userId', { userId: userId.value })
      .orWhere('conversation.participantB = :userId', { userId: userId.value })
      .orderBy('conversation.updatedAt', 'DESC')
      .getMany();

    return entities.map((e) => this.mapper.toDomain(e));
  }
}

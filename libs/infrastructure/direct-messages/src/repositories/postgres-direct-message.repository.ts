import { Repository, FindOptionsWhere, In, IsNull, Not, LessThan } from 'typeorm';
import { UserId } from '@csn/domain-shared';
import {
  Message,
  MessageId,
  ConversationId,
  IMessageRepository,
  MessagePage,
} from '@csn/domain-direct-messages';
import { BaseRepository } from '@csn/infra-shared';
import { DirectMessageEntity } from '../entities/direct-message.entity';
import { DirectMessageMapper } from '../mappers/direct-message.mapper';

export class PostgresDirectMessageRepository
  extends BaseRepository<Message, MessageId, DirectMessageEntity>
  implements IMessageRepository
{
  constructor(ormRepository: Repository<DirectMessageEntity>) {
    super(ormRepository, new DirectMessageMapper());
  }

  nextId(): MessageId {
    return MessageId.generate();
  }

  protected idCondition(id: MessageId): FindOptionsWhere<DirectMessageEntity> {
    return { id: id.value } as FindOptionsWhere<DirectMessageEntity>;
  }

  async findPage(
    conversationId: ConversationId,
    before: MessageId | null,
    limit: number,
  ): Promise<MessagePage> {
    const where: FindOptionsWhere<DirectMessageEntity> = {
      conversationId: conversationId.value,
    } as FindOptionsWhere<DirectMessageEntity>;

    if (before) {
      const anchor = await this.ormRepository.findOne({
        where: { id: before.value } as FindOptionsWhere<DirectMessageEntity>,
      });
      if (!anchor) {
        // An unknown cursor means the client is out of sync; treat it as the
        // end of history rather than silently serving the newest page again.
        return { items: [], nextCursor: null, hasMore: false };
      }
      where.createdAt = LessThan(anchor.createdAt);
    }

    // Fetch newest-first so "the page before the cursor" is cheap, plus one
    // extra row to detect further history without a second count query.
    const rows = await this.ormRepository.find({
      where,
      order: { createdAt: 'DESC', id: 'DESC' } as Record<string, 'ASC' | 'DESC'>,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const oldest = pageRows[pageRows.length - 1];

    return {
      // Reverse to oldest -> newest so the thread renders top-to-bottom.
      items: pageRows.reverse().map((e) => this.mapper.toDomain(e)),
      nextCursor: hasMore && oldest ? oldest.id : null,
      hasMore,
    };
  }

  async findLastByConversationIds(
    conversationIds: ConversationId[],
  ): Promise<Map<string, Message>> {
    const result = new Map<string, Message>();
    if (conversationIds.length === 0) {
      return result;
    }

    // DISTINCT ON keeps this a single index scan instead of N round-trips.
    const rows = await this.ormRepository
      .createQueryBuilder('m')
      .distinctOn(['m.conversationId'])
      .where('m.conversationId IN (:...ids)', {
        ids: conversationIds.map((id) => id.value),
      })
      .orderBy('m.conversationId', 'ASC')
      .addOrderBy('m.createdAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .getMany();

    for (const row of rows) {
      result.set(row.conversationId, this.mapper.toDomain(row));
    }
    return result;
  }

  async countUnreadByConversationIds(
    conversationIds: ConversationId[],
    viewerId: UserId,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (conversationIds.length === 0) {
      return result;
    }

    const rows = await this.ormRepository
      .createQueryBuilder('m')
      .select('m.conversationId', 'conversationId')
      .addSelect('COUNT(*)', 'count')
      .where('m.conversationId IN (:...ids)', {
        ids: conversationIds.map((id) => id.value),
      })
      .andWhere('m.senderId != :viewerId', { viewerId: viewerId.value })
      .andWhere('m.readAt IS NULL')
      .groupBy('m.conversationId')
      .getRawMany<{ conversationId: string; count: string }>();

    for (const row of rows) {
      result.set(row.conversationId, Number(row.count));
    }
    return result;
  }

  async findUnreadForRecipient(
    conversationId: ConversationId,
    recipientId: UserId,
  ): Promise<Message[]> {
    const rows = await this.ormRepository.find({
      where: {
        conversationId: conversationId.value,
        senderId: Not(recipientId.value),
        readAt: IsNull(),
      } as FindOptionsWhere<DirectMessageEntity>,
      order: { createdAt: 'ASC' } as Record<string, 'ASC' | 'DESC'>,
    });
    return rows.map((e) => this.mapper.toDomain(e));
  }

  /** Convenience for bulk loads in tests and admin tooling. */
  async findByIds(ids: MessageId[]): Promise<Message[]> {
    if (ids.length === 0) return [];
    const rows = await this.ormRepository.find({
      where: { id: In(ids.map((i) => i.value)) } as FindOptionsWhere<DirectMessageEntity>,
    });
    return rows.map((e) => this.mapper.toDomain(e));
  }
}

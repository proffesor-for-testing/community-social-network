import { UserId } from '@csn/domain-shared';
import {
  Message,
  MessageId,
  ConversationId,
  IMessageRepository,
  MessagePage,
} from '@csn/domain-direct-messages';

export class InMemoryDirectMessageRepository implements IMessageRepository {
  private readonly store = new Map<string, Message>();
  /** Insertion order, used to break ties when two messages share a timestamp. */
  private readonly sequence = new Map<string, number>();
  private nextSequence = 0;

  nextId(): MessageId {
    return MessageId.generate();
  }

  async findById(id: MessageId): Promise<Message | null> {
    return this.store.get(id.value) ?? null;
  }

  async exists(id: MessageId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Message): Promise<void> {
    if (!this.sequence.has(aggregate.id.value)) {
      this.sequence.set(aggregate.id.value, this.nextSequence++);
    }
    this.store.set(aggregate.id.value, aggregate);
  }

  async delete(aggregate: Message): Promise<void> {
    this.store.delete(aggregate.id.value);
    this.sequence.delete(aggregate.id.value);
  }

  async findPage(
    conversationId: ConversationId,
    before: MessageId | null,
    limit: number,
  ): Promise<MessagePage> {
    // Newest first, mirroring the SQL repository's index order.
    const ordered = this.inConversation(conversationId).sort((a, b) =>
      this.compareDescending(a, b),
    );

    let window = ordered;
    if (before) {
      const anchorIndex = ordered.findIndex((m) => m.id.value === before.value);
      if (anchorIndex < 0) {
        return { items: [], nextCursor: null, hasMore: false };
      }
      window = ordered.slice(anchorIndex + 1);
    }

    const pageRows = window.slice(0, limit);
    const hasMore = window.length > limit;
    const oldest = pageRows[pageRows.length - 1];

    return {
      items: [...pageRows].reverse(),
      nextCursor: hasMore && oldest ? oldest.id.value : null,
      hasMore,
    };
  }

  async findLastByConversationIds(
    conversationIds: ConversationId[],
  ): Promise<Map<string, Message>> {
    const result = new Map<string, Message>();
    for (const conversationId of conversationIds) {
      const newest = this.inConversation(conversationId).sort((a, b) =>
        this.compareDescending(a, b),
      )[0];
      if (newest) {
        result.set(conversationId.value, newest);
      }
    }
    return result;
  }

  async countUnreadByConversationIds(
    conversationIds: ConversationId[],
    viewerId: UserId,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (const conversationId of conversationIds) {
      const count = this.inConversation(conversationId).filter((m) =>
        m.isUnreadFor(viewerId),
      ).length;
      if (count > 0) {
        result.set(conversationId.value, count);
      }
    }
    return result;
  }

  async findUnreadForRecipient(
    conversationId: ConversationId,
    recipientId: UserId,
  ): Promise<Message[]> {
    return this.inConversation(conversationId)
      .filter((m) => m.isUnreadFor(recipientId))
      .sort((a, b) => -this.compareDescending(a, b));
  }

  /** Test helper: returns the number of stored aggregates. */
  get size(): number {
    return this.store.size;
  }

  /** Test helper: clears all stored aggregates. */
  clear(): void {
    this.store.clear();
    this.sequence.clear();
    this.nextSequence = 0;
  }

  private inConversation(conversationId: ConversationId): Message[] {
    const matches: Message[] = [];
    for (const message of this.store.values()) {
      if (message.conversationId.value === conversationId.value) {
        matches.push(message);
      }
    }
    return matches;
  }

  private compareDescending(a: Message, b: Message): number {
    const byTime = b.createdAt.value.getTime() - a.createdAt.value.getTime();
    if (byTime !== 0) return byTime;
    return (
      (this.sequence.get(b.id.value) ?? 0) - (this.sequence.get(a.id.value) ?? 0)
    );
  }
}

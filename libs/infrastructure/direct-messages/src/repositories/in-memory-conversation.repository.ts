import { UserId } from '@csn/domain-shared';
import {
  Conversation,
  ConversationId,
  ParticipantPair,
  IConversationRepository,
} from '@csn/domain-direct-messages';

export class InMemoryConversationRepository implements IConversationRepository {
  private readonly store = new Map<string, Conversation>();

  nextId(): ConversationId {
    return ConversationId.generate();
  }

  async findById(id: ConversationId): Promise<Conversation | null> {
    return this.store.get(id.value) ?? null;
  }

  async exists(id: ConversationId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Conversation): Promise<void> {
    this.store.set(aggregate.id.value, aggregate);
  }

  async delete(aggregate: Conversation): Promise<void> {
    this.store.delete(aggregate.id.value);
  }

  async findByParticipants(pair: ParticipantPair): Promise<Conversation | null> {
    for (const conversation of this.store.values()) {
      if (conversation.participants.equals(pair)) {
        return conversation;
      }
    }
    return null;
  }

  async findOrCreate(pair: ParticipantPair): Promise<Conversation> {
    const existing = await this.findByParticipants(pair);
    if (existing) {
      return existing;
    }
    const conversation = Conversation.create(this.nextId(), pair);
    await this.save(conversation);
    return conversation;
  }

  async findByParticipant(userId: UserId): Promise<Conversation[]> {
    const matches: Conversation[] = [];
    for (const conversation of this.store.values()) {
      if (conversation.hasParticipant(userId)) {
        matches.push(conversation);
      }
    }
    matches.sort(
      (a, b) => b.updatedAt.value.getTime() - a.updatedAt.value.getTime(),
    );
    return matches;
  }

  /** Test helper: returns the number of stored aggregates. */
  get size(): number {
    return this.store.size;
  }

  /** Test helper: clears all stored aggregates. */
  clear(): void {
    this.store.clear();
  }
}

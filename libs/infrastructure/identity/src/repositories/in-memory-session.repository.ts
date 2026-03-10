import { Session, SessionId, MemberId, ISessionRepository } from '@csn/domain-identity';

export class InMemorySessionRepository implements ISessionRepository {
  private readonly store = new Map<string, Session>();

  nextId(): SessionId {
    return SessionId.generate();
  }

  async findById(id: SessionId): Promise<Session | null> {
    return this.store.get(id.value) ?? null;
  }

  async exists(id: SessionId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Session): Promise<void> {
    this.store.set(aggregate.id.value, aggregate);
  }

  async delete(aggregate: Session): Promise<void> {
    this.store.delete(aggregate.id.value);
  }

  async findActiveByMemberId(memberId: MemberId): Promise<Session[]> {
    const results: Session[] = [];
    for (const session of this.store.values()) {
      if (
        session.memberId.value === memberId.value &&
        !session.isRevoked &&
        !session.isExpired()
      ) {
        results.push(session);
      }
    }
    return results;
  }

  async countActiveByMemberId(memberId: MemberId): Promise<number> {
    const active = await this.findActiveByMemberId(memberId);
    return active.length;
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

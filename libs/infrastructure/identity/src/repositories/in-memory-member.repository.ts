import { Email } from '@csn/domain-shared';
import { Member, MemberId, IMemberRepository } from '@csn/domain-identity';

export class InMemoryMemberRepository implements IMemberRepository {
  private readonly store = new Map<string, Member>();

  nextId(): MemberId {
    return MemberId.generate();
  }

  async findById(id: MemberId): Promise<Member | null> {
    return this.store.get(id.value) ?? null;
  }

  async exists(id: MemberId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Member): Promise<void> {
    this.store.set(aggregate.id.value, aggregate);
  }

  async delete(aggregate: Member): Promise<void> {
    this.store.delete(aggregate.id.value);
  }

  async findByEmail(email: Email): Promise<Member | null> {
    for (const member of this.store.values()) {
      if (member.email.value === email.value) {
        return member;
      }
    }
    return null;
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

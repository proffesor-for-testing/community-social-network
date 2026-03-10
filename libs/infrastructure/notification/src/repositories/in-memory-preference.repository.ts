import { UserId } from '@csn/domain-shared';
import { Preference, PreferenceId, IPreferenceRepository } from '@csn/domain-notification';

export class InMemoryPreferenceRepository implements IPreferenceRepository {
  private readonly store = new Map<string, Preference>();

  nextId(): PreferenceId {
    return PreferenceId.generate();
  }

  async findById(id: PreferenceId): Promise<Preference | null> {
    return this.store.get(id.value) ?? null;
  }

  async exists(id: PreferenceId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Preference): Promise<void> {
    this.store.set(aggregate.id.value, aggregate);
  }

  async delete(aggregate: Preference): Promise<void> {
    this.store.delete(aggregate.id.value);
  }

  async findByMemberId(memberId: UserId): Promise<Preference | null> {
    for (const preference of this.store.values()) {
      if (preference.memberId.value === memberId.value) {
        return preference;
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

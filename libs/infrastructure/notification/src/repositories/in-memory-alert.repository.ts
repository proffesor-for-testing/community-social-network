import {
  UserId,
  PaginatedResult,
  PaginationParams,
  DEFAULT_PAGINATION,
} from '@csn/domain-shared';
import { Alert, AlertId, AlertStatus, IAlertRepository } from '@csn/domain-notification';

export class InMemoryAlertRepository implements IAlertRepository {
  private readonly store = new Map<string, Alert>();

  nextId(): AlertId {
    return AlertId.generate();
  }

  async findById(id: AlertId): Promise<Alert | null> {
    return this.store.get(id.value) ?? null;
  }

  async exists(id: AlertId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Alert): Promise<void> {
    this.store.set(aggregate.id.value, aggregate);
  }

  async delete(aggregate: Alert): Promise<void> {
    this.store.delete(aggregate.id.value);
  }

  async findByRecipientId(
    recipientId: UserId,
    pagination: PaginationParams = DEFAULT_PAGINATION,
  ): Promise<PaginatedResult<Alert>> {
    const { page, pageSize } = pagination;

    const allForRecipient: Alert[] = [];
    for (const alert of this.store.values()) {
      if (alert.recipientId.value === recipientId.value) {
        allForRecipient.push(alert);
      }
    }

    // Sort by createdAt descending
    allForRecipient.sort(
      (a, b) => b.createdAt.value.getTime() - a.createdAt.value.getTime(),
    );

    const total = allForRecipient.length;
    const totalPages = Math.ceil(total / pageSize);
    const skip = (page - 1) * pageSize;
    const items = allForRecipient.slice(skip, skip + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async countUnread(recipientId: UserId): Promise<number> {
    let count = 0;
    for (const alert of this.store.values()) {
      if (
        alert.recipientId.value === recipientId.value &&
        alert.status === AlertStatus.UNREAD
      ) {
        count++;
      }
    }
    return count;
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

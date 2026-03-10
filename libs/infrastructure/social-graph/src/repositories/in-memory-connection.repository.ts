import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import {
  Connection,
  ConnectionId,
  IConnectionRepository,
} from '@csn/domain-social-graph';
import { ConnectionMapper } from '../mappers/connection.mapper';
import { ConnectionEntity } from '../entities/connection.entity';

export class InMemoryConnectionRepository implements IConnectionRepository {
  private readonly store = new Map<string, ConnectionEntity>();
  private readonly mapper = new ConnectionMapper();

  nextId(): ConnectionId {
    return ConnectionId.create(randomUUID());
  }

  async findById(id: ConnectionId): Promise<Connection | null> {
    const entity = this.store.get(id.value);
    if (!entity) return null;
    return this.mapper.toDomain(entity);
  }

  async exists(id: ConnectionId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async save(aggregate: Connection): Promise<void> {
    const entity = this.mapper.toPersistence(aggregate);
    this.store.set(entity.id, entity);
  }

  async delete(aggregate: Connection): Promise<void> {
    this.store.delete(aggregate.id.value);
  }

  async findByFollowerAndFollowee(
    followerId: UserId,
    followeeId: UserId,
  ): Promise<Connection | null> {
    for (const entity of this.store.values()) {
      if (
        entity.followerId === followerId.value &&
        entity.followeeId === followeeId.value
      ) {
        return this.mapper.toDomain(entity);
      }
    }
    return null;
  }

  async findFollowers(userId: UserId): Promise<Connection[]> {
    const results: Connection[] = [];
    for (const entity of this.store.values()) {
      if (entity.followeeId === userId.value) {
        results.push(this.mapper.toDomain(entity));
      }
    }
    return results;
  }

  async findFollowing(userId: UserId): Promise<Connection[]> {
    const results: Connection[] = [];
    for (const entity of this.store.values()) {
      if (entity.followerId === userId.value) {
        results.push(this.mapper.toDomain(entity));
      }
    }
    return results;
  }

  async countFollowers(userId: UserId): Promise<number> {
    let count = 0;
    for (const entity of this.store.values()) {
      if (entity.followeeId === userId.value) {
        count++;
      }
    }
    return count;
  }

  async countFollowing(userId: UserId): Promise<number> {
    let count = 0;
    for (const entity of this.store.values()) {
      if (entity.followerId === userId.value) {
        count++;
      }
    }
    return count;
  }

  /** Test helper: clear all stored entities. */
  clear(): void {
    this.store.clear();
  }
}

import { AggregateRoot } from './aggregate-root';

export interface IRepository<T extends AggregateRoot<TId>, TId> {
  nextId(): TId;
  findById(id: TId): Promise<T | null>;
  exists(id: TId): Promise<boolean>;
  save(aggregate: T): Promise<void>;
  delete(aggregate: T): Promise<void>;
}

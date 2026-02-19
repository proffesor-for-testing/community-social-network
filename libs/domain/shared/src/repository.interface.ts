import { AggregateRoot } from './aggregate-root';

export interface IRepository<T extends AggregateRoot<TId>, TId> {
  findById(id: TId): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(aggregate: T): Promise<void>;
}

import { Entity } from './entity';
import { DomainEvent } from './domain-event';

export abstract class AggregateRoot<T> extends Entity<T> {
  private _domainEvents: DomainEvent[] = [];
  private _version: number = 0;
  /** Version this aggregate was loaded at (0 = never persisted). */
  private _persistedVersion: number = 0;

  protected constructor(id: T) {
    super(id);
  }

  public get version(): number {
    return this._version;
  }

  /**
   * Set the version when reconstituting an aggregate from persistence.
   */
  protected setVersion(version: number): void {
    this._version = version;
    this._persistedVersion = version;
  }

  /**
   * The version this instance was loaded from persistence at. Repositories
   * use it as the optimistic-lock guard: a concurrent writer that committed
   * after this load will have moved the stored version past it.
   */
  public get persistedVersion(): number {
    return this._persistedVersion;
  }

  /**
   * Called by repositories after a successful write so that a subsequent
   * save of the same instance guards on the version that is now stored.
   */
  public markPersisted(version: number): void {
    this._version = version;
    this._persistedVersion = version;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  protected incrementVersion(): void {
    this._version++;
  }
}

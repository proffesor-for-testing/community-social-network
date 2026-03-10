import { describe, it, expect } from 'vitest';
import { AggregateRoot } from '../aggregate-root';
import { DomainEvent } from '../domain-event';

class TestEvent extends DomainEvent {
  get eventType(): string {
    return 'TestEvent';
  }
  get aggregateType(): string {
    return 'TestAggregate';
  }
}

class TestAggregate extends AggregateRoot<string> {
  constructor(id: string) {
    super(id);
  }

  doSomething(): void {
    this.addDomainEvent(new TestEvent(this.id));
    this.incrementVersion();
  }

  doSomethingQuiet(): void {
    // adds event without incrementing version
    this.addDomainEvent(new TestEvent(this.id));
  }

  reconstitute(version: number): void {
    this.setVersion(version);
  }
}

describe('AggregateRoot', () => {
  it('should_startWithVersion0', () => {
    // Arrange & Act
    const aggregate = new TestAggregate('agg-1');

    // Assert
    expect(aggregate.version).toBe(0);
  });

  it('should_incrementVersion', () => {
    // Arrange
    const aggregate = new TestAggregate('agg-1');

    // Act
    aggregate.doSomething();

    // Assert
    expect(aggregate.version).toBe(1);
  });

  it('should_incrementVersion_multipleTimes', () => {
    // Arrange
    const aggregate = new TestAggregate('agg-1');

    // Act
    aggregate.doSomething();
    aggregate.doSomething();
    aggregate.doSomething();

    // Assert
    expect(aggregate.version).toBe(3);
  });

  it('should_collectDomainEvents', () => {
    // Arrange
    const aggregate = new TestAggregate('agg-1');

    // Act
    aggregate.doSomething();
    aggregate.doSomething();

    // Assert - events not yet pulled, so pullDomainEvents should return them
    const events = aggregate.pullDomainEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toBeInstanceOf(DomainEvent);
    expect(events[0].aggregateId).toBe('agg-1');
    expect(events[1]).toBeInstanceOf(DomainEvent);
    expect(events[1].aggregateId).toBe('agg-1');
  });

  it('should_pullAndClearDomainEvents', () => {
    // Arrange
    const aggregate = new TestAggregate('agg-1');
    aggregate.doSomething();
    aggregate.doSomething();

    // Act
    const firstPull = aggregate.pullDomainEvents();
    const secondPull = aggregate.pullDomainEvents();

    // Assert
    expect(firstPull).toHaveLength(2);
    expect(secondPull).toHaveLength(0);
  });

  it('should_returnEmptyArray_when_noEvents', () => {
    // Arrange
    const aggregate = new TestAggregate('agg-1');

    // Act
    const events = aggregate.pullDomainEvents();

    // Assert
    expect(events).toEqual([]);
    expect(events).toHaveLength(0);
  });

  it('should_setVersion_forReconstitution', () => {
    // Arrange
    const aggregate = new TestAggregate('agg-1');

    // Act
    aggregate.reconstitute(42);

    // Assert
    expect(aggregate.version).toBe(42);
  });

  it('should_continueFromReconstitutedVersion', () => {
    // Arrange
    const aggregate = new TestAggregate('agg-1');
    aggregate.reconstitute(10);

    // Act
    aggregate.doSomething();

    // Assert
    expect(aggregate.version).toBe(11);
  });

  it('should_returnCopyOfEvents_notInternalArray', () => {
    // Arrange
    const aggregate = new TestAggregate('agg-1');
    aggregate.doSomething();

    // Act
    const events = aggregate.pullDomainEvents();
    events.push(new TestEvent('fake-id'));

    // Assert - internal state should not be affected
    const eventsAfterMutation = aggregate.pullDomainEvents();
    expect(eventsAfterMutation).toHaveLength(0);
  });

  it('should_inheritEntityEquality', () => {
    // Arrange
    const agg1 = new TestAggregate('agg-1');
    const agg2 = new TestAggregate('agg-1');
    const agg3 = new TestAggregate('agg-2');

    // Act & Assert
    expect(agg1.equals(agg2)).toBe(true);
    expect(agg1.equals(agg3)).toBe(false);
  });
});

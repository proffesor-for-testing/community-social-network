import { describe, it, expect } from 'vitest';
import { DomainEvent, EventMetadata } from '../domain-event';

class TestDomainEvent extends DomainEvent {
  get eventType(): string {
    return 'UserRegistered';
  }
  get aggregateType(): string {
    return 'User';
  }
}

class AnotherDomainEvent extends DomainEvent {
  public readonly payload: string;

  constructor(aggregateId: string, payload: string, version?: number, metadata?: EventMetadata) {
    super(aggregateId, version, metadata);
    this.payload = payload;
  }

  get eventType(): string {
    return 'PostCreated';
  }
  get aggregateType(): string {
    return 'Post';
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('DomainEvent', () => {
  it('should_generateUniqueEventId', () => {
    // Arrange & Act
    const event1 = new TestDomainEvent('agg-1');
    const event2 = new TestDomainEvent('agg-1');

    // Assert
    expect(event1.eventId).toMatch(UUID_REGEX);
    expect(event2.eventId).toMatch(UUID_REGEX);
    expect(event1.eventId).not.toBe(event2.eventId);
  });

  it('should_setOccurredOn', () => {
    // Arrange
    const before = new Date();

    // Act
    const event = new TestDomainEvent('agg-1');

    // Assert
    const after = new Date();
    expect(event.occurredOn).toBeInstanceOf(Date);
    expect(event.occurredOn.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(event.occurredOn.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should_setAggregateId', () => {
    // Arrange & Act
    const event = new TestDomainEvent('my-aggregate-123');

    // Assert
    expect(event.aggregateId).toBe('my-aggregate-123');
  });

  it('should_setVersion', () => {
    // Arrange & Act
    const eventDefault = new TestDomainEvent('agg-1');
    const eventExplicit = new TestDomainEvent('agg-1', 5);

    // Assert
    expect(eventDefault.version).toBe(1);
    expect(eventExplicit.version).toBe(5);
  });

  it('should_freezeMetadata', () => {
    // Arrange
    const metadata: EventMetadata = {
      correlationId: 'corr-1',
      causationId: 'cause-1',
      userId: 'user-1',
    };

    // Act
    const event = new TestDomainEvent('agg-1', 1, metadata);

    // Assert
    expect(event.metadata.correlationId).toBe('corr-1');
    expect(event.metadata.causationId).toBe('cause-1');
    expect(event.metadata.userId).toBe('user-1');
    expect(Object.isFrozen(event.metadata)).toBe(true);

    // Attempting to mutate should throw in strict mode or silently fail
    expect(() => {
      (event.metadata as { correlationId: string }).correlationId = 'changed';
    }).toThrow();
  });

  it('should_defaultMetadata_toEmptyObject', () => {
    // Arrange & Act
    const event = new TestDomainEvent('agg-1');

    // Assert
    expect(event.metadata).toBeDefined();
    expect(event.metadata.correlationId).toBeUndefined();
    expect(event.metadata.causationId).toBeUndefined();
    expect(event.metadata.userId).toBeUndefined();
  });

  it('should_notModifyOriginalMetadata', () => {
    // Arrange
    const metadata: EventMetadata = {
      correlationId: 'corr-1',
    };

    // Act
    const event = new TestDomainEvent('agg-1', 1, metadata);
    metadata.correlationId = 'modified';

    // Assert - event should have the original value
    expect(event.metadata.correlationId).toBe('corr-1');
  });

  it('should_haveAbstractEventType', () => {
    // Arrange & Act
    const event = new TestDomainEvent('agg-1');

    // Assert
    expect(event.eventType).toBe('UserRegistered');
  });

  it('should_haveAbstractAggregateType', () => {
    // Arrange & Act
    const event = new TestDomainEvent('agg-1');

    // Assert
    expect(event.aggregateType).toBe('User');
  });

  it('should_supportDifferentEventTypes', () => {
    // Arrange & Act
    const event = new AnotherDomainEvent('post-1', 'hello world');

    // Assert
    expect(event.eventType).toBe('PostCreated');
    expect(event.aggregateType).toBe('Post');
    expect(event.payload).toBe('hello world');
  });

  it('should_serializeToJSON', () => {
    // Arrange
    const metadata: EventMetadata = {
      correlationId: 'corr-123',
      userId: 'user-456',
    };
    const event = new TestDomainEvent('agg-1', 3, metadata);

    // Act
    const json = event.toJSON();

    // Assert
    expect(json).toEqual({
      eventId: expect.stringMatching(UUID_REGEX),
      eventType: 'UserRegistered',
      aggregateType: 'User',
      occurredOn: expect.any(String),
      aggregateId: 'agg-1',
      version: 3,
      metadata: {
        correlationId: 'corr-123',
        userId: 'user-456',
      },
    });

    // Validate ISO format for occurredOn
    expect(new Date(json.occurredOn as string).toISOString()).toBe(json.occurredOn);
  });

  it('should_serializeToJSON_withDefaultMetadata', () => {
    // Arrange
    const event = new TestDomainEvent('agg-1');

    // Act
    const json = event.toJSON();

    // Assert
    expect(json.metadata).toEqual({});
    expect(json.version).toBe(1);
  });
});

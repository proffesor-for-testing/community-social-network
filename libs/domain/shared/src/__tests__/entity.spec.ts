import { describe, it, expect } from 'vitest';
import { Entity } from '../entity';

class TestEntity extends Entity<string> {
  constructor(id: string) {
    super(id);
  }
}

class NumericEntity extends Entity<number> {
  constructor(id: number) {
    super(id);
  }
}

class ValueObjectId {
  constructor(private readonly _value: string) {}
  equals(other: ValueObjectId): boolean {
    return this._value === other._value;
  }
  get value(): string {
    return this._value;
  }
}

class EntityWithVOId extends Entity<ValueObjectId> {
  constructor(id: ValueObjectId) {
    super(id);
  }
}

describe('Entity', () => {
  it('should_beEqual_when_sameId', () => {
    // Arrange
    const entity1 = new TestEntity('abc-123');
    const entity2 = new TestEntity('abc-123');

    // Act
    const result = entity1.equals(entity2);

    // Assert
    expect(result).toBe(true);
  });

  it('should_notBeEqual_when_differentId', () => {
    // Arrange
    const entity1 = new TestEntity('abc-123');
    const entity2 = new TestEntity('xyz-789');

    // Act
    const result = entity1.equals(entity2);

    // Assert
    expect(result).toBe(false);
  });

  it('should_notBeEqual_when_null', () => {
    // Arrange
    const entity = new TestEntity('abc-123');

    // Act
    const result = entity.equals(null as unknown as TestEntity);

    // Assert
    expect(result).toBe(false);
  });

  it('should_notBeEqual_when_undefined', () => {
    // Arrange
    const entity = new TestEntity('abc-123');

    // Act
    const result = entity.equals(undefined as unknown as TestEntity);

    // Assert
    expect(result).toBe(false);
  });

  it('should_beEqual_when_sameReference', () => {
    // Arrange
    const entity = new TestEntity('abc-123');

    // Act
    const result = entity.equals(entity);

    // Assert
    expect(result).toBe(true);
  });

  it('should_supportValueObjectIds', () => {
    // Arrange
    const voId1 = new ValueObjectId('user-001');
    const voId2 = new ValueObjectId('user-001');
    const voId3 = new ValueObjectId('user-999');

    const entity1 = new EntityWithVOId(voId1);
    const entity2 = new EntityWithVOId(voId2);
    const entity3 = new EntityWithVOId(voId3);

    // Act & Assert
    expect(entity1.equals(entity2)).toBe(true);
    expect(entity1.equals(entity3)).toBe(false);
  });

  it('should_exposeId_via_property', () => {
    // Arrange
    const entity = new TestEntity('my-id');

    // Act & Assert
    expect(entity.id).toBe('my-id');
  });

  it('should_supportNumericIds', () => {
    // Arrange
    const entity1 = new NumericEntity(42);
    const entity2 = new NumericEntity(42);
    const entity3 = new NumericEntity(99);

    // Act & Assert
    expect(entity1.equals(entity2)).toBe(true);
    expect(entity1.equals(entity3)).toBe(false);
  });
});

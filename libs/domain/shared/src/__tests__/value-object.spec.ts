import { describe, it, expect } from 'vitest';
import { ValueObject } from '../value-object';

class TestValueObject extends ValueObject<{ name: string; count: number }> {
  constructor(name: string, count: number) {
    super({ name, count });
  }
}

class NestedValueObject extends ValueObject<{ data: { inner: string }; tags: string[] }> {
  constructor(data: { inner: string }, tags: string[]) {
    super({ data, tags });
  }
}

class DateValueObject extends ValueObject<{ createdAt: Date; label: string }> {
  constructor(createdAt: Date, label: string) {
    super({ createdAt, label });
  }
}

describe('ValueObject', () => {
  it('should_beEqual_when_sameProps', () => {
    // Arrange
    const vo1 = new TestValueObject('alice', 10);
    const vo2 = new TestValueObject('alice', 10);

    // Act
    const result = vo1.equals(vo2);

    // Assert
    expect(result).toBe(true);
  });

  it('should_notBeEqual_when_differentProps', () => {
    // Arrange
    const vo1 = new TestValueObject('alice', 10);
    const vo2 = new TestValueObject('bob', 10);

    // Act
    const result = vo1.equals(vo2);

    // Assert
    expect(result).toBe(false);
  });

  it('should_notBeEqual_when_null', () => {
    // Arrange
    const vo1 = new TestValueObject('alice', 10);

    // Act
    const result = vo1.equals(null as unknown as TestValueObject);

    // Assert
    expect(result).toBe(false);
  });

  it('should_notBeEqual_when_undefined', () => {
    // Arrange
    const vo1 = new TestValueObject('alice', 10);

    // Act
    const result = vo1.equals(undefined as unknown as TestValueObject);

    // Assert
    expect(result).toBe(false);
  });

  it('should_beEqual_when_sameReference', () => {
    // Arrange
    const vo1 = new TestValueObject('alice', 10);

    // Act
    const result = vo1.equals(vo1);

    // Assert
    expect(result).toBe(true);
  });

  it('should_haveImmutableProps', () => {
    // Arrange
    const vo = new TestValueObject('alice', 10);

    // Act & Assert
    expect(() => {
      (vo.props as { name: string }).name = 'bob';
    }).toThrow();

    expect(vo.props.name).toBe('alice');
  });

  it('should_handleNestedObjects_inDeepEquals', () => {
    // Arrange
    const vo1 = new NestedValueObject({ inner: 'hello' }, ['a', 'b']);
    const vo2 = new NestedValueObject({ inner: 'hello' }, ['a', 'b']);
    const vo3 = new NestedValueObject({ inner: 'world' }, ['a', 'b']);

    // Act & Assert
    expect(vo1.equals(vo2)).toBe(true);
    expect(vo1.equals(vo3)).toBe(false);
  });

  it('should_handleDateComparison_inDeepEquals', () => {
    // Arrange
    const date1 = new Date('2024-01-15T12:00:00Z');
    const date2 = new Date('2024-01-15T12:00:00Z');
    const date3 = new Date('2025-06-01T00:00:00Z');

    const vo1 = new DateValueObject(date1, 'test');
    const vo2 = new DateValueObject(date2, 'test');
    const vo3 = new DateValueObject(date3, 'test');

    // Act & Assert
    expect(vo1.equals(vo2)).toBe(true);
    expect(vo1.equals(vo3)).toBe(false);
  });

  it('should_notBeEqual_when_differentNumberOfProps', () => {
    // Arrange
    const vo1 = new TestValueObject('alice', 10);
    const vo2 = new NestedValueObject({ inner: 'hello' }, ['a']);

    // Act - comparing structurally different value objects
    const result = vo1.equals(vo2 as unknown as TestValueObject);

    // Assert
    expect(result).toBe(false);
  });
});

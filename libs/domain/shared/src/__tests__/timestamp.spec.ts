import { describe, it, expect } from 'vitest';
import { Timestamp } from '../value-objects/timestamp';
import { ValidationError } from '../errors/domain-error';

describe('Timestamp', () => {
  it('should_createNow', () => {
    // Arrange
    const before = new Date();

    // Act
    const ts = Timestamp.now();

    // Assert
    const after = new Date();
    expect(ts).toBeDefined();
    expect(ts.value.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(ts.value.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should_createFromDate', () => {
    // Arrange
    const date = new Date('2024-06-15T10:30:00Z');

    // Act
    const ts = Timestamp.fromDate(date);

    // Assert
    expect(ts.value.getTime()).toBe(date.getTime());
  });

  it('should_createFromDate_withDefensiveCopy', () => {
    // Arrange
    const date = new Date('2024-06-15T10:30:00Z');
    const originalTime = date.getTime();

    // Act
    const ts = Timestamp.fromDate(date);
    date.setFullYear(2099); // mutate the original

    // Assert - timestamp should not be affected by external mutation
    expect(ts.value.getTime()).toBe(originalTime);
  });

  it('should_createFromISO', () => {
    // Arrange
    const iso = '2024-01-15T12:00:00.000Z';

    // Act
    const ts = Timestamp.fromISO(iso);

    // Assert
    expect(ts.value.toISOString()).toBe(iso);
  });

  it('should_throw_when_invalidDate', () => {
    // Arrange
    const invalidDate = new Date('invalid');

    // Act & Assert
    expect(() => Timestamp.fromDate(invalidDate)).toThrow(ValidationError);
    expect(() => Timestamp.fromDate(invalidDate)).toThrow('Invalid date provided');
  });

  it('should_throw_when_notADateInstance', () => {
    // Act & Assert
    expect(() => Timestamp.fromDate('2024-01-01' as unknown as Date)).toThrow(ValidationError);
  });

  it('should_throw_when_invalidISO', () => {
    // Arrange
    const invalidISO = 'not-a-date-string';

    // Act & Assert
    expect(() => Timestamp.fromISO(invalidISO)).toThrow(ValidationError);
    expect(() => Timestamp.fromISO(invalidISO)).toThrow('Invalid ISO date string');
  });

  it('should_throw_when_emptyISO', () => {
    // Act & Assert
    expect(() => Timestamp.fromISO('')).toThrow(ValidationError);
  });

  it('should_returnDefensiveCopy_from_getter', () => {
    // Arrange
    const ts = Timestamp.fromISO('2024-06-15T10:30:00.000Z');

    // Act
    const value1 = ts.value;
    const value2 = ts.value;

    // Assert - each call returns a new Date instance (defensive copy)
    expect(value1).not.toBe(value2);
    expect(value1.getTime()).toBe(value2.getTime());

    // mutating the returned value should not affect the timestamp
    value1.setFullYear(2099);
    expect(ts.value.getFullYear()).toBe(2024);
  });

  it('should_returnTrue_when_isBefore', () => {
    // Arrange
    const earlier = Timestamp.fromISO('2024-01-01T00:00:00Z');
    const later = Timestamp.fromISO('2024-12-31T23:59:59Z');

    // Act
    const result = earlier.isBefore(later);

    // Assert
    expect(result).toBe(true);
  });

  it('should_returnFalse_when_isNotBefore', () => {
    // Arrange
    const earlier = Timestamp.fromISO('2024-01-01T00:00:00Z');
    const later = Timestamp.fromISO('2024-12-31T23:59:59Z');

    // Act
    const result = later.isBefore(earlier);

    // Assert
    expect(result).toBe(false);
  });

  it('should_returnFalse_when_isBefore_sameTime', () => {
    // Arrange
    const ts1 = Timestamp.fromISO('2024-06-15T12:00:00Z');
    const ts2 = Timestamp.fromISO('2024-06-15T12:00:00Z');

    // Act
    const result = ts1.isBefore(ts2);

    // Assert
    expect(result).toBe(false);
  });

  it('should_returnTrue_when_isAfter', () => {
    // Arrange
    const earlier = Timestamp.fromISO('2024-01-01T00:00:00Z');
    const later = Timestamp.fromISO('2024-12-31T23:59:59Z');

    // Act
    const result = later.isAfter(earlier);

    // Assert
    expect(result).toBe(true);
  });

  it('should_returnFalse_when_isAfter_sameTime', () => {
    // Arrange
    const ts1 = Timestamp.fromISO('2024-06-15T12:00:00Z');
    const ts2 = Timestamp.fromISO('2024-06-15T12:00:00Z');

    // Act
    const result = ts1.isAfter(ts2);

    // Assert
    expect(result).toBe(false);
  });

  it('should_returnISO_via_toISO', () => {
    // Arrange
    const iso = '2024-06-15T10:30:00.000Z';
    const ts = Timestamp.fromISO(iso);

    // Act
    const result = ts.toISO();

    // Assert
    expect(result).toBe(iso);
    expect(typeof result).toBe('string');
  });

  it('should_beEqual_when_sameTimestamp', () => {
    // Arrange
    const ts1 = Timestamp.fromISO('2024-06-15T10:30:00.000Z');
    const ts2 = Timestamp.fromISO('2024-06-15T10:30:00.000Z');

    // Act & Assert
    expect(ts1.equals(ts2)).toBe(true);
  });

  it('should_notBeEqual_when_differentTimestamp', () => {
    // Arrange
    const ts1 = Timestamp.fromISO('2024-06-15T10:30:00.000Z');
    const ts2 = Timestamp.fromISO('2024-06-16T10:30:00.000Z');

    // Act & Assert
    expect(ts1.equals(ts2)).toBe(false);
  });
});

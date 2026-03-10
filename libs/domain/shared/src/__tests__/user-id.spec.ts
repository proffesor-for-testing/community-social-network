import { describe, it, expect } from 'vitest';
import { UserId } from '../value-objects/user-id';
import { ValidationError } from '../errors/domain-error';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ANOTHER_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('UserId', () => {
  it('should_create_when_validUUID', () => {
    // Arrange & Act
    const userId = UserId.create(VALID_UUID);

    // Assert
    expect(userId).toBeDefined();
    expect(userId.value).toBe(VALID_UUID);
  });

  it('should_throw_when_invalidUUID', () => {
    // Arrange
    const invalidUUIDs = [
      'not-a-uuid',
      '12345',
      '550e8400-e29b-41d4-a716',
      'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz',
      '550e8400e29b41d4a716446655440000', // no dashes
    ];

    // Act & Assert
    for (const invalid of invalidUUIDs) {
      expect(() => UserId.create(invalid)).toThrow(ValidationError);
      expect(() => UserId.create(invalid)).toThrow('UserId must be a valid UUID');
    }
  });

  it('should_throw_when_empty', () => {
    // Act & Assert
    expect(() => UserId.create('')).toThrow(ValidationError);
    expect(() => UserId.create('')).toThrow('UserId must be a valid UUID');
  });

  it('should_throw_when_null', () => {
    // Act & Assert
    expect(() => UserId.create(null as unknown as string)).toThrow(ValidationError);
  });

  it('should_throw_when_undefined', () => {
    // Act & Assert
    expect(() => UserId.create(undefined as unknown as string)).toThrow(ValidationError);
  });

  it('should_generate_validUUID', () => {
    // Act
    const userId = UserId.generate();

    // Assert
    expect(userId).toBeDefined();
    expect(userId.value).toMatch(UUID_REGEX);
  });

  it('should_generate_uniqueUUIDs', () => {
    // Act
    const userId1 = UserId.generate();
    const userId2 = UserId.generate();

    // Assert
    expect(userId1.value).not.toBe(userId2.value);
  });

  it('should_beEqual_when_sameUUID', () => {
    // Arrange
    const userId1 = UserId.create(VALID_UUID);
    const userId2 = UserId.create(VALID_UUID);

    // Act
    const result = userId1.equals(userId2);

    // Assert
    expect(result).toBe(true);
  });

  it('should_notBeEqual_when_differentUUID', () => {
    // Arrange
    const userId1 = UserId.create(VALID_UUID);
    const userId2 = UserId.create(ANOTHER_UUID);

    // Act
    const result = userId1.equals(userId2);

    // Assert
    expect(result).toBe(false);
  });

  it('should_returnValue_via_getter', () => {
    // Arrange
    const userId = UserId.create(VALID_UUID);

    // Act
    const value = userId.value;

    // Assert
    expect(value).toBe(VALID_UUID);
    expect(typeof value).toBe('string');
  });

  it('should_returnValue_via_toString', () => {
    // Arrange
    const userId = UserId.create(VALID_UUID);

    // Act
    const str = userId.toString();

    // Assert
    expect(str).toBe(VALID_UUID);
    expect(str).toBe(userId.value);
  });
});

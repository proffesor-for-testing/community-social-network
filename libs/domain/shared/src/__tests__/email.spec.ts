import { describe, it, expect } from 'vitest';
import { Email } from '../value-objects/email';
import { ValidationError } from '../errors/domain-error';

describe('Email', () => {
  it('should_create_when_validEmail', () => {
    // Arrange
    const rawEmail = 'user@example.com';

    // Act
    const email = Email.create(rawEmail);

    // Assert
    expect(email).toBeDefined();
    expect(email.value).toBe('user@example.com');
  });

  it('should_normalizeToLowercase', () => {
    // Arrange
    const rawEmail = 'User@EXAMPLE.COM';

    // Act
    const email = Email.create(rawEmail);

    // Assert
    expect(email.value).toBe('user@example.com');
  });

  it('should_trimWhitespace', () => {
    // Arrange
    const rawEmail = '  user@example.com  ';

    // Act
    const email = Email.create(rawEmail);

    // Assert
    expect(email.value).toBe('user@example.com');
  });

  it('should_throw_when_empty', () => {
    // Arrange
    const rawEmail = '';

    // Act & Assert
    expect(() => Email.create(rawEmail)).toThrow(ValidationError);
    expect(() => Email.create(rawEmail)).toThrow('Email cannot be empty');
  });

  it('should_throw_when_null', () => {
    // Act & Assert
    expect(() => Email.create(null as unknown as string)).toThrow(ValidationError);
  });

  it('should_throw_when_undefined', () => {
    // Act & Assert
    expect(() => Email.create(undefined as unknown as string)).toThrow(ValidationError);
  });

  it('should_throw_when_tooLong', () => {
    // Arrange - 256 characters total (over 255 max)
    const localPart = 'a'.repeat(244);
    const rawEmail = `${localPart}@example.com`; // 244 + 12 = 256 chars

    // Act & Assert
    expect(() => Email.create(rawEmail)).toThrow(ValidationError);
    expect(() => Email.create(rawEmail)).toThrow('must not exceed 255 characters');
  });

  it('should_accept_when_exactlyMaxLength', () => {
    // Arrange - exactly 255 characters
    const localPart = 'a'.repeat(243);
    const rawEmail = `${localPart}@example.com`; // 243 + 12 = 255 chars

    // Act
    const email = Email.create(rawEmail);

    // Assert
    expect(email.value).toHaveLength(255);
  });

  it('should_throw_when_invalidFormat_noAtSign', () => {
    // Arrange
    const rawEmail = 'userexample.com';

    // Act & Assert
    expect(() => Email.create(rawEmail)).toThrow(ValidationError);
    expect(() => Email.create(rawEmail)).toThrow('Email format is invalid');
  });

  it('should_throw_when_invalidFormat_noDomain', () => {
    // Arrange
    const rawEmail = 'user@';

    // Act & Assert
    expect(() => Email.create(rawEmail)).toThrow(ValidationError);
  });

  it('should_throw_when_invalidFormat_noLocalPart', () => {
    // Arrange
    const rawEmail = '@example.com';

    // Act & Assert
    expect(() => Email.create(rawEmail)).toThrow(ValidationError);
  });

  it('should_throw_when_invalidFormat_noTLD', () => {
    // Arrange
    const rawEmail = 'user@example';

    // Act & Assert
    expect(() => Email.create(rawEmail)).toThrow(ValidationError);
  });

  it('should_throw_when_containsSpaces', () => {
    // Arrange
    const rawEmail = 'us er@example.com';

    // Act & Assert
    expect(() => Email.create(rawEmail)).toThrow(ValidationError);
  });

  it('should_beEqual_when_sameEmail', () => {
    // Arrange
    const email1 = Email.create('user@example.com');
    const email2 = Email.create('user@example.com');

    // Act
    const result = email1.equals(email2);

    // Assert
    expect(result).toBe(true);
  });

  it('should_beEqual_when_sameCaseInsensitiveEmail', () => {
    // Arrange
    const email1 = Email.create('User@Example.COM');
    const email2 = Email.create('user@example.com');

    // Act
    const result = email1.equals(email2);

    // Assert
    expect(result).toBe(true);
  });

  it('should_notBeEqual_when_differentEmail', () => {
    // Arrange
    const email1 = Email.create('alice@example.com');
    const email2 = Email.create('bob@example.com');

    // Act
    const result = email1.equals(email2);

    // Assert
    expect(result).toBe(false);
  });

  it('should_returnValue_via_getter', () => {
    // Arrange
    const email = Email.create('test@domain.org');

    // Act
    const value = email.value;

    // Assert
    expect(value).toBe('test@domain.org');
    expect(typeof value).toBe('string');
  });

  it('should_returnValue_via_toString', () => {
    // Arrange
    const email = Email.create('test@domain.org');

    // Act
    const str = email.toString();

    // Assert
    expect(str).toBe('test@domain.org');
    expect(str).toBe(email.value);
  });
});

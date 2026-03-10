import { describe, it, expect } from 'vitest';
import {
  DomainError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from '../errors/domain-error';

describe('DomainError', () => {
  it('should_createDomainError_withCodeAndMessage', () => {
    // Arrange & Act
    const error = new DomainError('Something went wrong', 'GENERIC_ERROR');

    // Assert
    expect(error.message).toBe('Something went wrong');
    expect(error.code).toBe('GENERIC_ERROR');
    expect(error.name).toBe('DomainError');
  });

  it('should_serializeToJSON', () => {
    // Arrange
    const error = new DomainError('Bad input', 'BAD_INPUT');

    // Act
    const json = error.toJSON();

    // Assert
    expect(json).toEqual({
      code: 'BAD_INPUT',
      message: 'Bad input',
    });
  });

  it('should_beInstanceOfError', () => {
    // Arrange & Act
    const error = new DomainError('test', 'TEST');

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
  });

  it('should_haveStack', () => {
    // Arrange & Act
    const error = new DomainError('test', 'TEST');

    // Assert
    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
  });
});

describe('NotFoundError', () => {
  it('should_createNotFoundError', () => {
    // Arrange & Act
    const error = new NotFoundError('User not found');

    // Assert
    expect(error.message).toBe('User not found');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.name).toBe('NotFoundError');
  });

  it('should_beInstanceOfDomainError', () => {
    // Arrange & Act
    const error = new NotFoundError('missing');

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it('should_serializeToJSON', () => {
    // Arrange
    const error = new NotFoundError('Entity missing');

    // Act
    const json = error.toJSON();

    // Assert
    expect(json).toEqual({
      code: 'NOT_FOUND',
      message: 'Entity missing',
    });
  });
});

describe('ValidationError', () => {
  it('should_createValidationError', () => {
    // Arrange & Act
    const error = new ValidationError('Invalid email format');

    // Assert
    expect(error.message).toBe('Invalid email format');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.name).toBe('ValidationError');
  });

  it('should_beInstanceOfDomainError', () => {
    // Arrange & Act
    const error = new ValidationError('bad data');

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(ValidationError);
  });
});

describe('ConflictError', () => {
  it('should_createConflictError', () => {
    // Arrange & Act
    const error = new ConflictError('Username already taken');

    // Assert
    expect(error.message).toBe('Username already taken');
    expect(error.code).toBe('CONFLICT');
    expect(error.name).toBe('ConflictError');
  });

  it('should_beInstanceOfDomainError', () => {
    // Arrange & Act
    const error = new ConflictError('duplicate');

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(ConflictError);
  });
});

describe('UnauthorizedError', () => {
  it('should_createUnauthorizedError', () => {
    // Arrange & Act
    const error = new UnauthorizedError('Invalid credentials');

    // Assert
    expect(error.message).toBe('Invalid credentials');
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.name).toBe('UnauthorizedError');
  });

  it('should_beInstanceOfDomainError', () => {
    // Arrange & Act
    const error = new UnauthorizedError('no auth');

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(UnauthorizedError);
  });
});

describe('ForbiddenError', () => {
  it('should_createForbiddenError', () => {
    // Arrange & Act
    const error = new ForbiddenError('Access denied');

    // Assert
    expect(error.message).toBe('Access denied');
    expect(error.code).toBe('FORBIDDEN');
    expect(error.name).toBe('ForbiddenError');
  });

  it('should_beInstanceOfDomainError', () => {
    // Arrange & Act
    const error = new ForbiddenError('not allowed');

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(ForbiddenError);
  });
});

describe('Error hierarchy - cross-cutting', () => {
  it('should_catch_allSubtypes_asDomainError', () => {
    // Arrange
    const errors: DomainError[] = [
      new NotFoundError('nf'),
      new ValidationError('ve'),
      new ConflictError('ce'),
      new UnauthorizedError('ue'),
      new ForbiddenError('fe'),
    ];

    // Act & Assert
    for (const error of errors) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBeDefined();
      expect(error.message).toBeDefined();
      expect(error.toJSON()).toHaveProperty('code');
      expect(error.toJSON()).toHaveProperty('message');
    }
  });

  it('should_throwAndCatch_inTryCatch', () => {
    // Arrange & Act & Assert
    expect(() => {
      throw new ValidationError('test error');
    }).toThrow(DomainError);

    expect(() => {
      throw new NotFoundError('not found');
    }).toThrow(Error);
  });
});

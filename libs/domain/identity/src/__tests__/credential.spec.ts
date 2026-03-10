import { describe, it, expect } from 'vitest';
import { Credential } from '../value-objects/credential';
import { ValidationError } from '@csn/domain-shared';

describe('Credential', () => {
  it('should create a credential from a valid hash', () => {
    const hash = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';
    const credential = Credential.create(hash);

    expect(credential.value).toBe(hash);
  });

  it('should throw ValidationError for empty hash', () => {
    expect(() => Credential.create('')).toThrow(ValidationError);
  });

  it('should throw ValidationError for whitespace-only hash', () => {
    expect(() => Credential.create('   ')).toThrow(ValidationError);
  });

  it('should preserve the exact hash value', () => {
    const hash = '$2b$12$LJ3m4ys9Rz9vB.HxPpGKnOxvGhXw4JxK3XYz0123456789abcdef';
    const credential = Credential.create(hash);

    expect(credential.value).toBe(hash);
  });

  it('should be equal to another Credential with the same hash', () => {
    const hash = '$2b$10$somehashvalue';
    const cred1 = Credential.create(hash);
    const cred2 = Credential.create(hash);

    expect(cred1.equals(cred2)).toBe(true);
  });

  it('should not be equal to a Credential with a different hash', () => {
    const cred1 = Credential.create('$2b$10$hash1');
    const cred2 = Credential.create('$2b$10$hash2');

    expect(cred1.equals(cred2)).toBe(false);
  });
});

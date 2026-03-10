import { describe, it, expect } from 'vitest';
import { Bio } from '../value-objects/bio';

describe('Bio', () => {
  it('should create a valid bio', () => {
    const bio = Bio.create('Software engineer.');
    expect(bio.value).toBe('Software engineer.');
  });

  it('should allow empty string', () => {
    const bio = Bio.create('');
    expect(bio.value).toBe('');
  });

  it('should create empty bio via factory', () => {
    const bio = Bio.empty();
    expect(bio.value).toBe('');
  });

  it('should accept bio at maximum length (500 chars)', () => {
    const maxBio = 'A'.repeat(500);
    const bio = Bio.create(maxBio);
    expect(bio.value).toBe(maxBio);
    expect(bio.value.length).toBe(500);
  });

  it('should reject bio exceeding maximum length', () => {
    const tooLong = 'A'.repeat(501);
    expect(() => Bio.create(tooLong)).toThrow('must not exceed 500 characters');
  });

  it('should reject null', () => {
    expect(() => Bio.create(null as unknown as string)).toThrow();
  });

  it('should reject undefined', () => {
    expect(() => Bio.create(undefined as unknown as string)).toThrow();
  });

  it('should support equality', () => {
    const a = Bio.create('Hello');
    const b = Bio.create('Hello');
    const c = Bio.create('World');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('should return value from toString', () => {
    const bio = Bio.create('My bio');
    expect(bio.toString()).toBe('My bio');
  });
});

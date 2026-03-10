import { describe, it, expect } from 'vitest';
import { DisplayName } from '../value-objects/display-name';

describe('DisplayName', () => {
  it('should create a valid display name', () => {
    const name = DisplayName.create('Alice');
    expect(name.value).toBe('Alice');
  });

  it('should trim whitespace', () => {
    const name = DisplayName.create('  Alice  ');
    expect(name.value).toBe('Alice');
  });

  it('should reject names shorter than 2 characters', () => {
    expect(() => DisplayName.create('A')).toThrow();
    expect(() => DisplayName.create('A')).toThrow('at least 2 characters');
  });

  it('should reject empty string', () => {
    expect(() => DisplayName.create('')).toThrow();
  });

  it('should reject whitespace-only string that trims below minimum', () => {
    expect(() => DisplayName.create('   ')).toThrow('at least 2 characters');
  });

  it('should accept name at minimum length', () => {
    const name = DisplayName.create('Al');
    expect(name.value).toBe('Al');
  });

  it('should accept name at maximum length (50 chars)', () => {
    const longName = 'A'.repeat(50);
    const name = DisplayName.create(longName);
    expect(name.value).toBe(longName);
  });

  it('should reject name exceeding maximum length', () => {
    const tooLong = 'A'.repeat(51);
    expect(() => DisplayName.create(tooLong)).toThrow('must not exceed 50 characters');
  });

  it('should reject null', () => {
    expect(() => DisplayName.create(null as unknown as string)).toThrow();
  });

  it('should reject undefined', () => {
    expect(() => DisplayName.create(undefined as unknown as string)).toThrow();
  });

  it('should support equality', () => {
    const a = DisplayName.create('Alice');
    const b = DisplayName.create('Alice');
    const c = DisplayName.create('Bob');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('should return value from toString', () => {
    const name = DisplayName.create('Alice');
    expect(name.toString()).toBe('Alice');
  });
});

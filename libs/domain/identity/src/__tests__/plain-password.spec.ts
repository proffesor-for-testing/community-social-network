import { describe, it, expect } from 'vitest';
import { PlainPassword } from '../value-objects/plain-password';
import { ValidationError } from '@csn/domain-shared';

describe('PlainPassword', () => {
  const validPassword = 'MyStr0ng!Pass';

  it('should create a valid password', () => {
    const password = PlainPassword.create(validPassword);
    expect(password.value).toBe(validPassword);
  });

  it('should throw ValidationError for empty password', () => {
    expect(() => PlainPassword.create('')).toThrow(ValidationError);
  });

  it('should throw ValidationError for password shorter than 12 characters', () => {
    expect(() => PlainPassword.create('Ab1!short')).toThrow(ValidationError);
    expect(() => PlainPassword.create('Ab1!short')).toThrow('at least 12 characters');
  });

  it('should accept password of exactly 12 characters', () => {
    const pwd = 'Abcdefg1hi!2';
    expect(pwd.length).toBe(12);
    const password = PlainPassword.create(pwd);
    expect(password.value).toBe(pwd);
  });

  it('should throw ValidationError when missing uppercase letter', () => {
    expect(() => PlainPassword.create('mystr0ng!pass')).toThrow(ValidationError);
    expect(() => PlainPassword.create('mystr0ng!pass')).toThrow('uppercase');
  });

  it('should throw ValidationError when missing lowercase letter', () => {
    expect(() => PlainPassword.create('MYSTR0NG!PASS')).toThrow(ValidationError);
    expect(() => PlainPassword.create('MYSTR0NG!PASS')).toThrow('lowercase');
  });

  it('should throw ValidationError when missing digit', () => {
    expect(() => PlainPassword.create('MyStrong!Pass')).toThrow(ValidationError);
    expect(() => PlainPassword.create('MyStrong!Pass')).toThrow('digit');
  });

  it('should throw ValidationError when missing special character', () => {
    expect(() => PlainPassword.create('MyStr0ngPassw')).toThrow(ValidationError);
    expect(() => PlainPassword.create('MyStr0ngPassw')).toThrow('special character');
  });

  it('should accept passwords with various special characters', () => {
    const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'];
    for (const char of specialChars) {
      const pwd = `MyStr0ngPass${char}`;
      expect(() => PlainPassword.create(pwd)).not.toThrow();
    }
  });

  it('should be a value object with equality', () => {
    const p1 = PlainPassword.create(validPassword);
    const p2 = PlainPassword.create(validPassword);
    expect(p1.equals(p2)).toBe(true);
  });

  it('should not be equal to a different password', () => {
    const p1 = PlainPassword.create('MyStr0ng!Pass');
    const p2 = PlainPassword.create('An0ther!Pass2');
    expect(p1.equals(p2)).toBe(false);
  });
});

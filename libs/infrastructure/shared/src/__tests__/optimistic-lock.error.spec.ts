import { describe, it, expect } from 'vitest';
import { OptimisticLockError } from '../errors/optimistic-lock.error';

describe('OptimisticLockError', () => {
  it('should be an instance of Error', () => {
    const error = new OptimisticLockError('Member', '123');

    expect(error).toBeInstanceOf(Error);
  });

  it('should have the name "OptimisticLockError"', () => {
    const error = new OptimisticLockError('Member', '123');

    expect(error.name).toBe('OptimisticLockError');
  });

  it('should include the entity name and id in the message', () => {
    const error = new OptimisticLockError('Member', '550e8400-e29b-41d4-a716-446655440000');

    expect(error.message).toContain('Member');
    expect(error.message).toContain('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should format the message with optimistic lock conflict description', () => {
    const error = new OptimisticLockError('Profile', 'abc-123');

    expect(error.message).toBe(
      'Optimistic lock conflict on Profile with id abc-123. The entity was modified by another transaction.',
    );
  });

  it('should have a stack trace', () => {
    const error = new OptimisticLockError('Group', 'xyz');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('OptimisticLockError');
  });

  it('should work with different entity names and ids', () => {
    const error1 = new OptimisticLockError('Connection', 'conn-1');
    const error2 = new OptimisticLockError('Publication', 'pub-999');

    expect(error1.message).toContain('Connection');
    expect(error1.message).toContain('conn-1');
    expect(error2.message).toContain('Publication');
    expect(error2.message).toContain('pub-999');
  });
});

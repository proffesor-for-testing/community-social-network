import { describe, it, expect } from 'vitest';
import { MemberStatus } from '../value-objects/member-status';
import { ValidationError } from '@csn/domain-shared';

describe('MemberStatus', () => {
  describe('creation', () => {
    it('should create from a valid status string', () => {
      const status = MemberStatus.create('ACTIVE');
      expect(status.value).toBe('ACTIVE');
    });

    it('should throw ValidationError for an invalid status', () => {
      expect(() => MemberStatus.create('INVALID')).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty string', () => {
      expect(() => MemberStatus.create('')).toThrow(ValidationError);
    });

    it.each([
      'PENDING_VERIFICATION',
      'ACTIVE',
      'SUSPENDED',
      'LOCKED',
      'DEACTIVATED',
    ])('should accept valid status: %s', (statusValue) => {
      const status = MemberStatus.create(statusValue);
      expect(status.value).toBe(statusValue);
    });
  });

  describe('static factory methods', () => {
    it('should create PENDING_VERIFICATION', () => {
      expect(MemberStatus.pendingVerification().value).toBe('PENDING_VERIFICATION');
    });

    it('should create ACTIVE', () => {
      expect(MemberStatus.active().value).toBe('ACTIVE');
    });

    it('should create SUSPENDED', () => {
      expect(MemberStatus.suspended().value).toBe('SUSPENDED');
    });

    it('should create LOCKED', () => {
      expect(MemberStatus.locked().value).toBe('LOCKED');
    });

    it('should create DEACTIVATED', () => {
      expect(MemberStatus.deactivated().value).toBe('DEACTIVATED');
    });
  });

  describe('canTransitionTo', () => {
    it('should allow PENDING_VERIFICATION -> ACTIVE', () => {
      const pending = MemberStatus.pendingVerification();
      expect(pending.canTransitionTo(MemberStatus.active())).toBe(true);
    });

    it('should not allow PENDING_VERIFICATION -> SUSPENDED', () => {
      const pending = MemberStatus.pendingVerification();
      expect(pending.canTransitionTo(MemberStatus.suspended())).toBe(false);
    });

    it('should not allow PENDING_VERIFICATION -> LOCKED', () => {
      const pending = MemberStatus.pendingVerification();
      expect(pending.canTransitionTo(MemberStatus.locked())).toBe(false);
    });

    it('should not allow PENDING_VERIFICATION -> DEACTIVATED', () => {
      const pending = MemberStatus.pendingVerification();
      expect(pending.canTransitionTo(MemberStatus.deactivated())).toBe(false);
    });

    it('should allow ACTIVE -> SUSPENDED', () => {
      const active = MemberStatus.active();
      expect(active.canTransitionTo(MemberStatus.suspended())).toBe(true);
    });

    it('should allow ACTIVE -> LOCKED', () => {
      const active = MemberStatus.active();
      expect(active.canTransitionTo(MemberStatus.locked())).toBe(true);
    });

    it('should allow ACTIVE -> DEACTIVATED', () => {
      const active = MemberStatus.active();
      expect(active.canTransitionTo(MemberStatus.deactivated())).toBe(true);
    });

    it('should not allow ACTIVE -> PENDING_VERIFICATION', () => {
      const active = MemberStatus.active();
      expect(active.canTransitionTo(MemberStatus.pendingVerification())).toBe(false);
    });

    it('should allow SUSPENDED -> ACTIVE', () => {
      const suspended = MemberStatus.suspended();
      expect(suspended.canTransitionTo(MemberStatus.active())).toBe(true);
    });

    it('should allow SUSPENDED -> DEACTIVATED', () => {
      const suspended = MemberStatus.suspended();
      expect(suspended.canTransitionTo(MemberStatus.deactivated())).toBe(true);
    });

    it('should not allow SUSPENDED -> LOCKED', () => {
      const suspended = MemberStatus.suspended();
      expect(suspended.canTransitionTo(MemberStatus.locked())).toBe(false);
    });

    it('should allow LOCKED -> ACTIVE', () => {
      const locked = MemberStatus.locked();
      expect(locked.canTransitionTo(MemberStatus.active())).toBe(true);
    });

    it('should not allow LOCKED -> SUSPENDED', () => {
      const locked = MemberStatus.locked();
      expect(locked.canTransitionTo(MemberStatus.suspended())).toBe(false);
    });

    it('should not allow DEACTIVATED -> any status', () => {
      const deactivated = MemberStatus.deactivated();
      expect(deactivated.canTransitionTo(MemberStatus.active())).toBe(false);
      expect(deactivated.canTransitionTo(MemberStatus.suspended())).toBe(false);
      expect(deactivated.canTransitionTo(MemberStatus.locked())).toBe(false);
      expect(deactivated.canTransitionTo(MemberStatus.pendingVerification())).toBe(false);
    });
  });

  describe('equality', () => {
    it('should be equal when same status', () => {
      const s1 = MemberStatus.active();
      const s2 = MemberStatus.active();
      expect(s1.equals(s2)).toBe(true);
    });

    it('should not be equal when different status', () => {
      const s1 = MemberStatus.active();
      const s2 = MemberStatus.locked();
      expect(s1.equals(s2)).toBe(false);
    });
  });
});

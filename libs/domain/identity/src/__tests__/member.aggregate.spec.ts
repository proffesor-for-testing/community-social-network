import { describe, it, expect } from 'vitest';
import { Member } from '../aggregates/member';
import { MemberId } from '../value-objects/member-id';
import { Credential } from '../value-objects/credential';
import { MemberRegisteredEvent } from '../events/member-registered.event';
import { MemberAuthenticationSucceededEvent } from '../events/member-authentication-succeeded.event';
import { MemberLockedEvent } from '../events/member-locked.event';
import { MemberSuspendedEvent } from '../events/member-suspended.event';
import { MemberPromotedToAdminEvent } from '../events/member-promoted-to-admin.event';
import { MemberDemotedFromAdminEvent } from '../events/member-demoted-from-admin.event';
import {
  Email,
  ValidationError,
  SECURITY_LIMITS,
} from '@csn/domain-shared';

function createTestMember(overrides?: { status?: 'ACTIVE' | 'PENDING_VERIFICATION' }): Member {
  const member = Member.register(
    MemberId.generate(),
    Email.create('test@example.com'),
    Credential.create('$2b$10$hashedpasswordvalue'),
    'Test User',
  );

  // Clear events from registration
  member.pullDomainEvents();

  if (overrides?.status === 'ACTIVE') {
    member.activate();
    member.pullDomainEvents(); // clear activate events
  }

  return member;
}

describe('Member Aggregate', () => {
  describe('register', () => {
    it('should create a member with PENDING_VERIFICATION status', () => {
      const id = MemberId.generate();
      const email = Email.create('user@example.com');
      const credential = Credential.create('$2b$10$hashedvalue');
      const displayName = 'John Doe';

      const member = Member.register(id, email, credential, displayName);

      expect(member.id).toBe(id);
      expect(member.email.equals(email)).toBe(true);
      expect(member.credential.equals(credential)).toBe(true);
      expect(member.status.value).toBe('PENDING_VERIFICATION');
      expect(member.displayName).toBe('John Doe');
      expect(member.failedLoginAttempts).toBe(0);
      expect(member.lastLoginAt).toBeNull();
      expect(member.createdAt).toBeDefined();
    });

    it('should emit MemberRegisteredEvent', () => {
      const id = MemberId.generate();
      const email = Email.create('user@example.com');
      const credential = Credential.create('$2b$10$hashedvalue');

      const member = Member.register(id, email, credential, 'John');
      const events = member.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MemberRegisteredEvent);

      const event = events[0] as MemberRegisteredEvent;
      expect(event.aggregateId).toBe(id.value);
      expect(event.email).toBe('user@example.com');
      expect(event.displayName).toBe('John');
      expect(event.eventType).toBe('MemberRegistered');
      expect(event.aggregateType).toBe('Member');
    });

    it('should increment version to 1', () => {
      const member = Member.register(
        MemberId.generate(),
        Email.create('user@example.com'),
        Credential.create('$2b$10$hash'),
        'User',
      );

      expect(member.version).toBe(1);
    });
  });

  describe('activate', () => {
    it('should transition from PENDING_VERIFICATION to ACTIVE', () => {
      const member = createTestMember();

      member.activate();

      expect(member.status.value).toBe('ACTIVE');
    });

    it('should throw when trying to activate an already ACTIVE member', () => {
      const member = createTestMember({ status: 'ACTIVE' });

      expect(() => member.activate()).toThrow(ValidationError);
    });

    it('should increment version on activation', () => {
      const member = createTestMember();
      const versionBefore = member.version;

      member.activate();

      expect(member.version).toBe(versionBefore + 1);
    });
  });

  describe('recordSuccessfulLogin', () => {
    it('should reset failed login attempts and update lastLoginAt', () => {
      const member = createTestMember({ status: 'ACTIVE' });
      const sessionId = 'session-123';

      member.recordSuccessfulLogin(sessionId);

      expect(member.failedLoginAttempts).toBe(0);
      expect(member.lastLoginAt).not.toBeNull();
    });

    it('should emit MemberAuthenticationSucceededEvent', () => {
      const member = createTestMember({ status: 'ACTIVE' });
      const sessionId = 'session-456';

      member.recordSuccessfulLogin(sessionId);
      const events = member.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MemberAuthenticationSucceededEvent);

      const event = events[0] as MemberAuthenticationSucceededEvent;
      expect(event.sessionId).toBe(sessionId);
      expect(event.aggregateId).toBe(member.id.value);
    });

    it('should reset failed attempts after previous failures', () => {
      const member = createTestMember({ status: 'ACTIVE' });

      // Record some failures
      member.recordFailedLogin();
      member.recordFailedLogin();
      member.pullDomainEvents();
      expect(member.failedLoginAttempts).toBe(2);

      // Successful login resets
      member.recordSuccessfulLogin('session-789');
      expect(member.failedLoginAttempts).toBe(0);
    });
  });

  describe('recordFailedLogin', () => {
    it('should increment failed login attempts', () => {
      const member = createTestMember({ status: 'ACTIVE' });

      member.recordFailedLogin();

      expect(member.failedLoginAttempts).toBe(1);
    });

    it('should lock account after MAX_LOGIN_ATTEMPTS', () => {
      const member = createTestMember({ status: 'ACTIVE' });

      for (let i = 0; i < SECURITY_LIMITS.MAX_LOGIN_ATTEMPTS; i++) {
        member.recordFailedLogin();
      }

      expect(member.status.value).toBe('LOCKED');
      expect(member.failedLoginAttempts).toBe(SECURITY_LIMITS.MAX_LOGIN_ATTEMPTS);
    });

    it('should emit MemberLockedEvent when account is locked', () => {
      const member = createTestMember({ status: 'ACTIVE' });

      for (let i = 0; i < SECURITY_LIMITS.MAX_LOGIN_ATTEMPTS; i++) {
        member.recordFailedLogin();
      }

      const events = member.pullDomainEvents();
      const lockEvents = events.filter((e) => e instanceof MemberLockedEvent);

      expect(lockEvents).toHaveLength(1);
      const lockEvent = lockEvents[0] as MemberLockedEvent;
      expect(lockEvent.reason).toBe('Too many failed login attempts');
      expect(lockEvent.failedAttempts).toBe(SECURITY_LIMITS.MAX_LOGIN_ATTEMPTS);
    });

    it('should not emit MemberLockedEvent before reaching max attempts', () => {
      const member = createTestMember({ status: 'ACTIVE' });

      for (let i = 0; i < SECURITY_LIMITS.MAX_LOGIN_ATTEMPTS - 1; i++) {
        member.recordFailedLogin();
      }

      const events = member.pullDomainEvents();
      const lockEvents = events.filter((e) => e instanceof MemberLockedEvent);

      expect(lockEvents).toHaveLength(0);
      expect(member.status.value).toBe('ACTIVE');
    });

    it('should increment version on each failed login', () => {
      const member = createTestMember({ status: 'ACTIVE' });
      const versionBefore = member.version;

      member.recordFailedLogin();

      expect(member.version).toBe(versionBefore + 1);
    });
  });

  describe('suspend', () => {
    it('should transition ACTIVE to SUSPENDED and emit event', () => {
      const member = createTestMember({ status: 'ACTIVE' });

      member.suspend('Violated terms', 'admin-001');

      expect(member.status.value).toBe('SUSPENDED');

      const events = member.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MemberSuspendedEvent);

      const event = events[0] as MemberSuspendedEvent;
      expect(event.reason).toBe('Violated terms');
      expect(event.suspendedBy).toBe('admin-001');
    });

    it('should throw when trying to suspend a PENDING_VERIFICATION member', () => {
      const member = createTestMember();

      expect(() => member.suspend('reason', 'admin')).toThrow(ValidationError);
    });

    it('should throw when trying to suspend a DEACTIVATED member', () => {
      const member = createTestMember({ status: 'ACTIVE' });
      member.deactivate();
      member.pullDomainEvents();

      expect(() => member.suspend('reason', 'admin')).toThrow(ValidationError);
    });
  });

  describe('unlock', () => {
    it('should transition LOCKED to ACTIVE and reset failed attempts', () => {
      const member = createTestMember({ status: 'ACTIVE' });

      // Lock the member
      for (let i = 0; i < SECURITY_LIMITS.MAX_LOGIN_ATTEMPTS; i++) {
        member.recordFailedLogin();
      }
      member.pullDomainEvents();
      expect(member.status.value).toBe('LOCKED');

      // Unlock
      member.unlock();

      expect(member.status.value).toBe('ACTIVE');
      expect(member.failedLoginAttempts).toBe(0);
    });

    it('should throw when trying to unlock an ACTIVE member', () => {
      const member = createTestMember({ status: 'ACTIVE' });

      // ACTIVE -> ACTIVE is not a valid transition (canTransitionTo returns false for same status)
      expect(() => member.unlock()).toThrow(ValidationError);
    });
  });

  describe('deactivate', () => {
    it('should transition ACTIVE to DEACTIVATED', () => {
      const member = createTestMember({ status: 'ACTIVE' });

      member.deactivate();

      expect(member.status.value).toBe('DEACTIVATED');
    });

    it('should throw when trying to deactivate a PENDING_VERIFICATION member', () => {
      const member = createTestMember();

      expect(() => member.deactivate()).toThrow(ValidationError);
    });

    it('should throw when trying to deactivate an already DEACTIVATED member', () => {
      const member = createTestMember({ status: 'ACTIVE' });
      member.deactivate();

      expect(() => member.deactivate()).toThrow(ValidationError);
    });

    it('should allow deactivation from SUSPENDED', () => {
      const member = createTestMember({ status: 'ACTIVE' });
      member.suspend('reason', 'admin');
      member.pullDomainEvents();

      member.deactivate();

      expect(member.status.value).toBe('DEACTIVATED');
    });
  });

  describe('promoteToAdmin', () => {
    it('should default a newly registered member to non-admin', () => {
      // Arrange & Act
      const member = createTestMember();

      // Assert
      expect(member.isAdmin).toBe(false);
    });

    it('should mark the member as admin', () => {
      // Arrange
      const member = createTestMember();

      // Act
      member.promoteToAdmin('actor-1');

      // Assert
      expect(member.isAdmin).toBe(true);
    });

    it('should emit a MemberPromotedToAdmin event', () => {
      // Arrange
      const member = createTestMember();

      // Act
      member.promoteToAdmin('actor-1');

      // Assert
      expect(member.pullDomainEvents()[0]).toBeInstanceOf(
        MemberPromotedToAdminEvent,
      );
    });

    it('should record who performed the promotion', () => {
      // Arrange
      const member = createTestMember();

      // Act
      member.promoteToAdmin('actor-1');

      // Assert
      const event = member.pullDomainEvents()[0] as MemberPromotedToAdminEvent;
      expect(event.promotedBy).toBe('actor-1');
    });

    it('should attribute the promotion to the system when no actor is given', () => {
      // Arrange
      const member = createTestMember();

      // Act
      member.promoteToAdmin();

      // Assert
      const event = member.pullDomainEvents()[0] as MemberPromotedToAdminEvent;
      expect(event.promotedBy).toBe('system');
    });

    it('should emit no event when the member is already an admin', () => {
      // Arrange
      const member = createTestMember();
      member.promoteToAdmin('actor-1');
      member.pullDomainEvents();

      // Act
      member.promoteToAdmin('actor-2');

      // Assert
      expect(member.pullDomainEvents()).toHaveLength(0);
    });

    it('should not bump the version when the member is already an admin', () => {
      // Arrange
      const member = createTestMember();
      member.promoteToAdmin('actor-1');
      const versionAfterFirstPromotion = member.version;

      // Act
      member.promoteToAdmin('actor-2');

      // Assert
      expect(member.version).toBe(versionAfterFirstPromotion);
    });
  });

  describe('demoteFromAdmin', () => {
    it('should clear the admin flag', () => {
      // Arrange
      const member = createTestMember();
      member.promoteToAdmin('actor-1');

      // Act
      member.demoteFromAdmin('actor-1');

      // Assert
      expect(member.isAdmin).toBe(false);
    });

    it('should emit a MemberDemotedFromAdmin event', () => {
      // Arrange
      const member = createTestMember();
      member.promoteToAdmin('actor-1');
      member.pullDomainEvents();

      // Act
      member.demoteFromAdmin('actor-1');

      // Assert
      expect(member.pullDomainEvents()[0]).toBeInstanceOf(
        MemberDemotedFromAdminEvent,
      );
    });

    it('should record who performed the demotion', () => {
      // Arrange
      const member = createTestMember();
      member.promoteToAdmin('actor-1');
      member.pullDomainEvents();

      // Act
      member.demoteFromAdmin('actor-1');

      // Assert
      const event = member.pullDomainEvents()[0] as MemberDemotedFromAdminEvent;
      expect(event.demotedBy).toBe('actor-1');
    });

    it('should reject an admin demoting themselves', () => {
      // Arrange
      const member = createTestMember();
      member.promoteToAdmin('actor-1');

      // Act & Assert
      expect(() => member.demoteFromAdmin(member.id.value)).toThrow(
        ValidationError,
      );
    });

    it('should leave the admin flag intact when self-demotion is rejected', () => {
      // Arrange
      const member = createTestMember();
      member.promoteToAdmin('actor-1');

      // Act
      try {
        member.demoteFromAdmin(member.id.value);
      } catch {
        // expected
      }

      // Assert
      expect(member.isAdmin).toBe(true);
    });

    it('should emit no event when the member is not an admin', () => {
      // Arrange
      const member = createTestMember();

      // Act
      member.demoteFromAdmin('actor-1');

      // Assert
      expect(member.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('reconstitute', () => {
    it('should recreate a member from persistence data without events', () => {
      const id = MemberId.generate();
      const email = Email.create('stored@example.com');
      const credential = Credential.create('$2b$10$storedhash');
      const member = Member.reconstitute(
        id,
        email,
        credential,
        { value: 'ACTIVE' } as any, // We need a MemberStatus here
        'Stored User',
        0,
        null,
        { value: new Date() } as any, // We need a Timestamp here
        5,
      );

      // No events should have been emitted
      const events = member.pullDomainEvents();
      expect(events).toHaveLength(0);
    });

    it('should default isAdmin to false when the flag is omitted', () => {
      // Arrange & Act
      const member = Member.reconstitute(
        MemberId.generate(),
        Email.create('stored@example.com'),
        Credential.create('$2b$10$storedhash'),
        { value: 'ACTIVE' } as any,
        'Stored User',
        0,
        null,
        { value: new Date() } as any,
        5,
      );

      // Assert
      expect(member.isAdmin).toBe(false);
    });

    it('should restore a persisted admin flag without emitting events', () => {
      // Arrange & Act
      const member = Member.reconstitute(
        MemberId.generate(),
        Email.create('stored-admin@example.com'),
        Credential.create('$2b$10$storedhash'),
        { value: 'ACTIVE' } as any,
        'Stored Admin',
        0,
        null,
        { value: new Date() } as any,
        5,
        true,
      );

      // Assert
      expect(member.isAdmin).toBe(true);
    });
  });

  describe('domain event metadata', () => {
    it('should set correct aggregateType on all events', () => {
      const member = Member.register(
        MemberId.generate(),
        Email.create('meta@example.com'),
        Credential.create('$2b$10$hash'),
        'Meta User',
      );

      const events = member.pullDomainEvents();
      for (const event of events) {
        expect(event.aggregateType).toBe('Member');
      }
    });
  });
});

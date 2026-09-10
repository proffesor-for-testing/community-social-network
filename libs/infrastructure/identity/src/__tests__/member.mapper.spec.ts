import { describe, it, expect } from 'vitest';
import { Email, Timestamp } from '@csn/domain-shared';
import {
  Member,
  MemberId,
  Credential,
  MemberStatus,
} from '@csn/domain-identity';
import { MemberMapper } from '../mappers/member.mapper';
import { MemberEntity } from '../entities/member.entity';

describe('MemberMapper', () => {
  const mapper = new MemberMapper();

  function createDomainMember(): Member {
    return Member.reconstitute(
      MemberId.create('550e8400-e29b-41d4-a716-446655440000'),
      Email.create('alice@example.com'),
      Credential.create('$2b$10$hashedpassword'),
      MemberStatus.active(),
      'Alice',
      0,
      Timestamp.fromDate(new Date('2025-06-15T10:00:00Z')),
      Timestamp.fromDate(new Date('2025-01-01T00:00:00Z')),
      3,
    );
  }

  function createEntity(): MemberEntity {
    const entity = new MemberEntity();
    entity.id = '550e8400-e29b-41d4-a716-446655440000';
    entity.email = 'alice@example.com';
    entity.passwordHash = '$2b$10$hashedpassword';
    entity.status = 'ACTIVE';
    entity.displayName = 'Alice';
    entity.failedLoginAttempts = 0;
    entity.lastLoginAt = new Date('2025-06-15T10:00:00Z');
    entity.createdAt = new Date('2025-01-01T00:00:00Z');
    entity.isAdmin = false;
    entity.version = 3;
    return entity;
  }

  describe('toPersistence', () => {
    it('should map domain Member to MemberEntity', () => {
      const member = createDomainMember();
      const entity = mapper.toPersistence(member);

      expect(entity.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(entity.email).toBe('alice@example.com');
      expect(entity.passwordHash).toBe('$2b$10$hashedpassword');
      expect(entity.status).toBe('ACTIVE');
      expect(entity.displayName).toBe('Alice');
      expect(entity.failedLoginAttempts).toBe(0);
      expect(entity.lastLoginAt).toEqual(new Date('2025-06-15T10:00:00Z'));
      expect(entity.createdAt).toEqual(new Date('2025-01-01T00:00:00Z'));
      expect(entity.version).toBe(3);
    });

    it('should map null lastLoginAt correctly', () => {
      const member = Member.reconstitute(
        MemberId.create('550e8400-e29b-41d4-a716-446655440000'),
        Email.create('bob@example.com'),
        Credential.create('$2b$10$hash'),
        MemberStatus.pendingVerification(),
        'Bob',
        0,
        null,
        Timestamp.fromDate(new Date('2025-01-01T00:00:00Z')),
        1,
      );

      const entity = mapper.toPersistence(member);
      expect(entity.lastLoginAt).toBeNull();
    });
  });

  describe('toDomain', () => {
    it('should map MemberEntity to domain Member', () => {
      const entity = createEntity();
      const member = mapper.toDomain(entity);

      expect(member.id.value).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(member.email.value).toBe('alice@example.com');
      expect(member.credential.value).toBe('$2b$10$hashedpassword');
      expect(member.status.value).toBe('ACTIVE');
      expect(member.displayName).toBe('Alice');
      expect(member.failedLoginAttempts).toBe(0);
      expect(member.lastLoginAt).not.toBeNull();
      expect(member.lastLoginAt!.value).toEqual(
        new Date('2025-06-15T10:00:00Z'),
      );
      expect(member.createdAt.value).toEqual(
        new Date('2025-01-01T00:00:00Z'),
      );
      expect(member.version).toBe(3);
    });

    it('should handle null lastLoginAt from entity', () => {
      const entity = createEntity();
      entity.lastLoginAt = null;

      const member = mapper.toDomain(entity);
      expect(member.lastLoginAt).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('toPersistence -> toDomain should produce equivalent aggregate', () => {
      const original = createDomainMember();
      const entity = mapper.toPersistence(original);
      const restored = mapper.toDomain(entity);

      expect(restored.id.value).toBe(original.id.value);
      expect(restored.email.value).toBe(original.email.value);
      expect(restored.credential.value).toBe(original.credential.value);
      expect(restored.status.value).toBe(original.status.value);
      expect(restored.displayName).toBe(original.displayName);
      expect(restored.failedLoginAttempts).toBe(original.failedLoginAttempts);
      expect(restored.lastLoginAt!.value.getTime()).toBe(
        original.lastLoginAt!.value.getTime(),
      );
      expect(restored.createdAt.value.getTime()).toBe(
        original.createdAt.value.getTime(),
      );
      expect(restored.version).toBe(original.version);
    });

    it('toDomain -> toPersistence should produce equivalent entity', () => {
      const original = createEntity();
      const domain = mapper.toDomain(original);
      const restored = mapper.toPersistence(domain);

      expect(restored.id).toBe(original.id);
      expect(restored.email).toBe(original.email);
      expect(restored.passwordHash).toBe(original.passwordHash);
      expect(restored.status).toBe(original.status);
      expect(restored.displayName).toBe(original.displayName);
      expect(restored.failedLoginAttempts).toBe(original.failedLoginAttempts);
      expect(restored.lastLoginAt!.getTime()).toBe(
        original.lastLoginAt!.getTime(),
      );
      expect(restored.createdAt.getTime()).toBe(original.createdAt.getTime());
      expect(restored.version).toBe(original.version);
    });

    it('round-trip with null lastLoginAt preserves null', () => {
      const member = Member.reconstitute(
        MemberId.create('550e8400-e29b-41d4-a716-446655440000'),
        Email.create('test@example.com'),
        Credential.create('$2b$10$hash'),
        MemberStatus.pendingVerification(),
        'Test',
        2,
        null,
        Timestamp.fromDate(new Date('2025-01-01T00:00:00Z')),
        1,
      );

      const entity = mapper.toPersistence(member);
      const restored = mapper.toDomain(entity);

      expect(restored.lastLoginAt).toBeNull();
    });
  });

  describe('is_admin round-trip', () => {
    it('should persist a non-admin member with isAdmin false', () => {
      // Arrange
      const member = createDomainMember();

      // Act
      const entity = mapper.toPersistence(member);

      // Assert
      expect(entity.isAdmin).toBe(false);
    });

    it('should persist an admin member with isAdmin true', () => {
      // Arrange
      const member = createDomainMember();
      member.promoteToAdmin('actor-1');

      // Act
      const entity = mapper.toPersistence(member);

      // Assert
      expect(entity.isAdmin).toBe(true);
    });

    it('should read the admin flag back into the aggregate', () => {
      // Arrange
      const entity = createEntity();
      entity.isAdmin = true;

      // Act
      const member = mapper.toDomain(entity);

      // Assert
      expect(member.isAdmin).toBe(true);
    });

    it('should treat a missing is_admin column value as non-admin', () => {
      // Arrange
      const entity = createEntity();
      entity.isAdmin = undefined as unknown as boolean;

      // Act
      const member = mapper.toDomain(entity);

      // Assert
      expect(member.isAdmin).toBe(false);
    });
  });
});

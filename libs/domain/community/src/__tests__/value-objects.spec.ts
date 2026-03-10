import { describe, it, expect } from 'vitest';
import { ValidationError, CONTENT_LIMITS } from '@csn/domain-shared';
import { GroupId } from '../value-objects/group-id';
import { GroupName } from '../value-objects/group-name';
import { GroupDescription } from '../value-objects/group-description';
import { GroupSettings } from '../value-objects/group-settings';
import { GroupRule } from '../value-objects/group-rule';
import { GroupStatus } from '../value-objects/group-status';
import { MembershipId } from '../value-objects/membership-id';
import {
  MembershipRole,
  getRoleLevel,
  isHigherRole,
  isLowerRole,
} from '../value-objects/membership-role';
import { Permission, isPermissionGrantedTo } from '../value-objects/permission';

describe('GroupId', () => {
  it('should create from valid UUID', () => {
    const id = GroupId.create('550e8400-e29b-41d4-a716-446655440000');
    expect(id.value).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should generate a new UUID', () => {
    const id = GroupId.generate();
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('should throw on invalid UUID', () => {
    expect(() => GroupId.create('not-a-uuid')).toThrow(ValidationError);
    expect(() => GroupId.create('')).toThrow(ValidationError);
  });

  it('should support equality', () => {
    const id1 = GroupId.create('550e8400-e29b-41d4-a716-446655440000');
    const id2 = GroupId.create('550e8400-e29b-41d4-a716-446655440000');
    expect(id1.equals(id2)).toBe(true);
  });

  it('should support toString', () => {
    const id = GroupId.create('550e8400-e29b-41d4-a716-446655440000');
    expect(id.toString()).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('GroupName', () => {
  it('should create from valid string', () => {
    const name = GroupName.create('My Group');
    expect(name.value).toBe('My Group');
  });

  it('should trim whitespace', () => {
    const name = GroupName.create('  My Group  ');
    expect(name.value).toBe('My Group');
  });

  it('should throw on empty string', () => {
    expect(() => GroupName.create('')).toThrow(ValidationError);
    expect(() => GroupName.create('   ')).toThrow(ValidationError);
  });

  it('should throw when exceeding max length', () => {
    const longName = 'A'.repeat(CONTENT_LIMITS.MAX_GROUP_NAME_LENGTH + 1);
    expect(() => GroupName.create(longName)).toThrow(ValidationError);
  });

  it('should accept string at max length', () => {
    const maxName = 'A'.repeat(CONTENT_LIMITS.MAX_GROUP_NAME_LENGTH);
    const name = GroupName.create(maxName);
    expect(name.value).toBe(maxName);
  });
});

describe('GroupDescription', () => {
  it('should create from valid string', () => {
    const desc = GroupDescription.create('A description');
    expect(desc.value).toBe('A description');
  });

  it('should allow empty string', () => {
    const desc = GroupDescription.create('');
    expect(desc.value).toBe('');
  });

  it('should create empty via static method', () => {
    const desc = GroupDescription.empty();
    expect(desc.value).toBe('');
  });

  it('should trim whitespace', () => {
    const desc = GroupDescription.create('  Trimmed  ');
    expect(desc.value).toBe('Trimmed');
  });

  it('should throw when exceeding max length', () => {
    const longDesc = 'A'.repeat(CONTENT_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH + 1);
    expect(() => GroupDescription.create(longDesc)).toThrow(ValidationError);
  });
});

describe('GroupSettings', () => {
  it('should create with provided values', () => {
    const settings = GroupSettings.create({
      isPublic: false,
      requireApproval: true,
      allowMemberPosts: false,
    });
    expect(settings.isPublic).toBe(false);
    expect(settings.requireApproval).toBe(true);
    expect(settings.allowMemberPosts).toBe(false);
  });

  it('should create defaults', () => {
    const settings = GroupSettings.defaults();
    expect(settings.isPublic).toBe(true);
    expect(settings.requireApproval).toBe(false);
    expect(settings.allowMemberPosts).toBe(true);
  });

  it('should support equality', () => {
    const s1 = GroupSettings.create({
      isPublic: true,
      requireApproval: false,
      allowMemberPosts: true,
    });
    const s2 = GroupSettings.defaults();
    expect(s1.equals(s2)).toBe(true);
  });
});

describe('GroupRule', () => {
  it('should create with title and description', () => {
    const rule = GroupRule.create('No Spam', 'Do not post spam content');
    expect(rule.title).toBe('No Spam');
    expect(rule.description).toBe('Do not post spam content');
  });

  it('should trim whitespace', () => {
    const rule = GroupRule.create('  Title  ', '  Desc  ');
    expect(rule.title).toBe('Title');
    expect(rule.description).toBe('Desc');
  });

  it('should throw on empty title', () => {
    expect(() => GroupRule.create('', 'desc')).toThrow(ValidationError);
    expect(() => GroupRule.create('   ', 'desc')).toThrow(ValidationError);
  });

  it('should throw on title exceeding 100 chars', () => {
    const longTitle = 'A'.repeat(101);
    expect(() => GroupRule.create(longTitle, 'desc')).toThrow(ValidationError);
  });

  it('should allow empty description', () => {
    const rule = GroupRule.create('Title', '');
    expect(rule.description).toBe('');
  });
});

describe('GroupStatus', () => {
  it('should have expected values', () => {
    expect(GroupStatus.ACTIVE).toBe('ACTIVE');
    expect(GroupStatus.ARCHIVED).toBe('ARCHIVED');
    expect(GroupStatus.SUSPENDED).toBe('SUSPENDED');
  });
});

describe('MembershipId', () => {
  it('should create from valid UUID', () => {
    const id = MembershipId.create('550e8400-e29b-41d4-a716-446655440000');
    expect(id.value).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should generate a new UUID', () => {
    const id = MembershipId.generate();
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('should throw on invalid UUID', () => {
    expect(() => MembershipId.create('invalid')).toThrow(ValidationError);
  });
});

describe('MembershipRole', () => {
  it('should have correct hierarchy levels', () => {
    expect(getRoleLevel(MembershipRole.OWNER)).toBe(4);
    expect(getRoleLevel(MembershipRole.ADMIN)).toBe(3);
    expect(getRoleLevel(MembershipRole.MODERATOR)).toBe(2);
    expect(getRoleLevel(MembershipRole.MEMBER)).toBe(1);
  });

  it('isHigherRole should compare correctly', () => {
    expect(isHigherRole(MembershipRole.OWNER, MembershipRole.ADMIN)).toBe(true);
    expect(isHigherRole(MembershipRole.ADMIN, MembershipRole.OWNER)).toBe(false);
    expect(isHigherRole(MembershipRole.ADMIN, MembershipRole.ADMIN)).toBe(false);
    expect(isHigherRole(MembershipRole.MODERATOR, MembershipRole.MEMBER)).toBe(true);
  });

  it('isLowerRole should compare correctly', () => {
    expect(isLowerRole(MembershipRole.MEMBER, MembershipRole.MODERATOR)).toBe(true);
    expect(isLowerRole(MembershipRole.ADMIN, MembershipRole.MEMBER)).toBe(false);
    expect(isLowerRole(MembershipRole.ADMIN, MembershipRole.ADMIN)).toBe(false);
  });
});

describe('Permission', () => {
  it('should have expected values', () => {
    expect(Permission.MANAGE_MEMBERS).toBe('MANAGE_MEMBERS');
    expect(Permission.MANAGE_SETTINGS).toBe('MANAGE_SETTINGS');
    expect(Permission.MANAGE_RULES).toBe('MANAGE_RULES');
    expect(Permission.DELETE_POSTS).toBe('DELETE_POSTS');
    expect(Permission.PIN_POSTS).toBe('PIN_POSTS');
  });

  it('should grant all permissions to OWNER', () => {
    expect(isPermissionGrantedTo(Permission.MANAGE_MEMBERS, MembershipRole.OWNER)).toBe(true);
    expect(isPermissionGrantedTo(Permission.MANAGE_SETTINGS, MembershipRole.OWNER)).toBe(true);
    expect(isPermissionGrantedTo(Permission.MANAGE_RULES, MembershipRole.OWNER)).toBe(true);
    expect(isPermissionGrantedTo(Permission.DELETE_POSTS, MembershipRole.OWNER)).toBe(true);
    expect(isPermissionGrantedTo(Permission.PIN_POSTS, MembershipRole.OWNER)).toBe(true);
  });

  it('should grant all permissions to ADMIN', () => {
    expect(isPermissionGrantedTo(Permission.MANAGE_MEMBERS, MembershipRole.ADMIN)).toBe(true);
    expect(isPermissionGrantedTo(Permission.MANAGE_SETTINGS, MembershipRole.ADMIN)).toBe(true);
  });

  it('should grant moderation permissions to MODERATOR', () => {
    expect(isPermissionGrantedTo(Permission.MANAGE_RULES, MembershipRole.MODERATOR)).toBe(true);
    expect(isPermissionGrantedTo(Permission.DELETE_POSTS, MembershipRole.MODERATOR)).toBe(true);
    expect(isPermissionGrantedTo(Permission.PIN_POSTS, MembershipRole.MODERATOR)).toBe(true);
  });

  it('should deny management permissions to MODERATOR', () => {
    expect(isPermissionGrantedTo(Permission.MANAGE_MEMBERS, MembershipRole.MODERATOR)).toBe(false);
    expect(isPermissionGrantedTo(Permission.MANAGE_SETTINGS, MembershipRole.MODERATOR)).toBe(false);
  });

  it('should deny all permissions to MEMBER', () => {
    expect(isPermissionGrantedTo(Permission.MANAGE_MEMBERS, MembershipRole.MEMBER)).toBe(false);
    expect(isPermissionGrantedTo(Permission.MANAGE_SETTINGS, MembershipRole.MEMBER)).toBe(false);
    expect(isPermissionGrantedTo(Permission.MANAGE_RULES, MembershipRole.MEMBER)).toBe(false);
    expect(isPermissionGrantedTo(Permission.DELETE_POSTS, MembershipRole.MEMBER)).toBe(false);
    expect(isPermissionGrantedTo(Permission.PIN_POSTS, MembershipRole.MEMBER)).toBe(false);
  });
});

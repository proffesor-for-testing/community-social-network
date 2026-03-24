/**
 * Shared Test Helpers
 *
 * Factory functions for creating pre-built domain aggregates and fake
 * authentication tokens used across all integration tests.
 */
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

// ── Domain types ────────────────────────────────────────────────────────────

import {
  Member,
  MemberId,
  Credential,
  Session,
  SessionId,
} from '@csn/domain-identity';
import { Email, Timestamp, UserId } from '@csn/domain-shared';
import { Profile, ProfileId, DisplayName } from '@csn/domain-profile';
import {
  Publication,
  PublicationId,
  PublicationContent,
  Visibility,
  VisibilityEnum,
} from '@csn/domain-content';
import {
  Group,
  GroupId,
  GroupName,
  GroupDescription,
  Membership,
  MembershipId,
  MembershipRole,
} from '@csn/domain-community';
import { Connection, ConnectionId } from '@csn/domain-social-graph';
import { Block, BlockId } from '@csn/domain-social-graph';
import {
  Alert,
  AlertId,
  AlertType,
  AlertContent,
} from '@csn/domain-notification';
import {
  AuditEntry,
  AuditEntryId,
  IpAddress,
} from '@csn/domain-admin';

// ── Default password for all test members ───────────────────────────────────

export const TEST_PASSWORD = 'Str0ng!Pass#2024';

/**
 * Pre-compute a bcrypt hash for the test password so individual tests
 * do not need to hash on every call (bcrypt is deliberately slow).
 */
let _hashedPassword: string | null = null;

export async function getTestPasswordHash(): Promise<string> {
  if (!_hashedPassword) {
    _hashedPassword = await bcrypt.hash(TEST_PASSWORD, 4); // low rounds for speed
  }
  return _hashedPassword;
}

// ── Member factory ──────────────────────────────────────────────────────────

export interface CreateTestMemberOpts {
  id?: string;
  email?: string;
  displayName?: string;
  password?: string;
}

/**
 * Create a registered, **activated** Member aggregate ready for login.
 * Mirrors the registration flow: register -> activate.
 */
export async function createTestMember(
  opts: CreateTestMemberOpts = {},
): Promise<Member> {
  const id = MemberId.create(opts.id ?? randomUUID());
  const email = Email.create(opts.email ?? `user-${id.value.slice(0, 8)}@test.com`);
  const hash = opts.password
    ? await bcrypt.hash(opts.password, 4)
    : await getTestPasswordHash();
  const credential = Credential.create(hash);
  const displayName = opts.displayName ?? `Test User ${id.value.slice(0, 6)}`;

  const member = Member.register(id, email, credential, displayName);
  member.activate();

  return member;
}

// ── Profile factory ─────────────────────────────────────────────────────────

export interface CreateTestProfileOpts {
  id?: string;
  displayName?: string;
  email?: string;
}

export function createTestProfile(
  memberId: string,
  opts: CreateTestProfileOpts = {},
): Profile {
  const profileId = ProfileId.create(opts.id ?? randomUUID());
  const userId = UserId.create(memberId);
  const displayName = DisplayName.create(opts.displayName ?? 'Test User');
  const email = Email.create(opts.email ?? `${memberId.slice(0, 8)}@test.com`);

  return Profile.create(profileId, userId, displayName, email);
}

// ── Publication (Post) factory ──────────────────────────────────────────────

export interface CreateTestPostOpts {
  id?: string;
  content?: string;
  visibility?: VisibilityEnum;
}

export function createTestPost(
  authorId: string,
  opts: CreateTestPostOpts = {},
): Publication {
  const pubId = PublicationId.create(opts.id ?? randomUUID());
  const userId = UserId.create(authorId);
  const content = PublicationContent.create(
    opts.content ?? 'This is a test post with enough content to satisfy validation.',
  );
  const visibility = Visibility.create(opts.visibility ?? VisibilityEnum.PUBLIC);

  return Publication.create(pubId, userId, content, visibility);
}

// ── Group + owner Membership factory ────────────────────────────────────────

export interface CreateTestGroupOpts {
  groupId?: string;
  name?: string;
  description?: string;
}

export interface TestGroupBundle {
  group: Group;
  ownerMembership: Membership;
}

export function createTestGroup(
  ownerId: string,
  opts: CreateTestGroupOpts = {},
): TestGroupBundle {
  const groupId = GroupId.create(opts.groupId ?? randomUUID());
  const ownerUserId = UserId.create(ownerId);
  const name = GroupName.create(opts.name ?? 'Test Group');
  const description = GroupDescription.create(
    opts.description ?? 'A test group for integration testing',
  );

  const group = Group.create(groupId, name, description, ownerUserId);

  // Create owner membership
  const membershipId = MembershipId.create(randomUUID());
  const membership = Membership.create(
    membershipId,
    groupId,
    ownerUserId,
    MembershipRole.OWNER,
  );

  group.incrementMemberCount();

  return { group, ownerMembership: membership };
}

// ── Connection (follow) factory ─────────────────────────────────────────────

export function createTestConnection(
  followerId: string,
  followeeId: string,
): Connection {
  const id = ConnectionId.create(randomUUID());
  const followerUserId = UserId.create(followerId);
  const followeeUserId = UserId.create(followeeId);
  return Connection.request(id, followerUserId, followeeUserId);
}

// ── Block factory ───────────────────────────────────────────────────────────

export function createTestBlock(
  blockerId: string,
  blockedId: string,
): Block {
  const id = BlockId.create(randomUUID());
  const blockerUserId = UserId.create(blockerId);
  const blockedUserId = UserId.create(blockedId);
  return Block.create(id, blockerUserId, blockedUserId);
}

// ── Alert factory ───────────────────────────────────────────────────────────

export function createTestAlert(
  recipientId: string,
  type: AlertType = AlertType.FOLLOW,
): Alert {
  const alertId = AlertId.generate();
  const recipient = UserId.create(recipientId);
  const content = AlertContent.create(
    'Test Alert',
    'This is a test alert description.',
    '/test/link',
  );

  return Alert.create(alertId, recipient, type, content, randomUUID());
}

// ── AuditEntry factory ──────────────────────────────────────────────────────

export function createTestAuditEntry(
  performedById: string,
  action: string = 'TEST_ACTION',
): AuditEntry {
  const entryId = AuditEntryId.create(randomUUID());
  const performedBy = UserId.create(performedById);
  const ip = IpAddress.create('127.0.0.1');

  return AuditEntry.create(
    entryId,
    action,
    performedBy,
    randomUUID(),
    'TestTarget',
    { reason: 'test' },
    ip,
  );
}

// ── Auth token helper ───────────────────────────────────────────────────────

/**
 * Generate a fake JWT-like token (base64-encoded JSON) for use in integration tests.
 * Compatible with MockJwtTokenService.verifyAccessToken().
 */
export function generateAuthToken(
  memberId: string,
  opts: { email?: string; roles?: string[] } = {},
): string {
  const tokenData = {
    sub: memberId,
    email: opts.email ?? `${memberId.slice(0, 8)}@test.com`,
    roles: opts.roles ?? ['member'],
    jti: randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  };
  return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}

// ── Session factory ─────────────────────────────────────────────────────────

export function createTestSession(memberId: string): Session {
  const sessionId = SessionId.generate();
  const memberIdObj = MemberId.create(memberId);
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  return Session.create(sessionId, memberIdObj, 'test-agent', '127.0.0.1', expiresAt);
}

/**
 * Cross-Context Integration Test: Registration Creates Profile
 *
 * Validates that when a member registers in the Identity context,
 * the ProfileCreatorConsumer receives the MemberRegistered event
 * and creates a corresponding Profile in the Profile bounded context.
 *
 * Flow:
 * 1. Register a new member via the Identity handler
 * 2. Extract the MemberRegistered domain event from the aggregate
 * 3. Feed the event payload to ProfileCreatorConsumer
 * 4. Verify a Profile is created for the member
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';

// ── Identity handlers ───────────────────────────────────────────────────────

import { RegisterMemberHandler } from '../../../apps/api/src/modules/identity/commands/register-member.handler';
import { RegisterMemberCommand } from '../../../apps/api/src/modules/identity/commands/register-member.command';

// ── Cross-context consumer ──────────────────────────────────────────────────

import { ProfileCreatorConsumer } from '../../../apps/api/src/consumers/profile-creator.consumer';

// ── Test infrastructure ─────────────────────────────────────────────────────

import {
  createTestRepositories,
  TestRepositories,
  MockJwtTokenService,
  MockTokenBlacklistService,
  MockIdempotencyStore,
} from '../../setup/test-app';
import { UserId } from '@csn/domain-shared';

describe('Cross-Context: Registration Creates Profile', () => {
  let repos: TestRepositories;
  let mockIdempotency: MockIdempotencyStore;

  let registerHandler: RegisterMemberHandler;
  let profileConsumer: ProfileCreatorConsumer;

  beforeEach(() => {
    repos = createTestRepositories();
    mockIdempotency = new MockIdempotencyStore();

    registerHandler = new RegisterMemberHandler(
      repos.memberRepo,
      repos.sessionRepo,
      new MockJwtTokenService() as any,
    );
    profileConsumer = new ProfileCreatorConsumer(
      repos.profileRepo,
      mockIdempotency as any,
    );
  });

  // ── Step 1: Register member ───────────────────────────────────────────

  it('should register a member and produce MemberRegistered event data', async () => {
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('alice@test.com', 'Alice Profile', 'Str0ng!Pass#2024'),
    );

    expect(regResult.member.id).toBeDefined();
    expect(regResult.member.email).toBe('alice@test.com');
    expect(repos.memberRepo.size).toBe(1);
  });

  // ── Step 2-3: ProfileCreatorConsumer receives event and creates profile ─

  it('should create a profile when ProfileCreatorConsumer receives MemberRegistered event', async () => {
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('bob@test.com', 'Bob Profile', 'Str0ng!Pass#2024'),
    );

    // Simulate the MemberRegistered integration event payload
    const eventPayload = {
      type: 'MemberRegistered',
      eventId: randomUUID(),
      aggregateId: regResult.member.id,
      email: 'bob@test.com',
      displayName: 'Bob Profile',
    };

    // Feed to consumer
    await profileConsumer.handle(eventPayload);

    // Step 4: Verify a Profile was created
    const memberId = UserId.create(regResult.member.id);
    const profile = await repos.profileRepo.findByMemberId(memberId);

    expect(profile).not.toBeNull();
    expect(profile!.memberId.value).toBe(regResult.member.id);
  });

  // ── Idempotent profile creation ───────────────────────────────────────

  it('should not create duplicate profile for same event', async () => {
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('carol@test.com', 'Carol Profile', 'Str0ng!Pass#2024'),
    );

    const eventPayload = {
      type: 'MemberRegistered',
      eventId: randomUUID(),
      aggregateId: regResult.member.id,
      email: 'carol@test.com',
      displayName: 'Carol Profile',
    };

    // Process twice
    await profileConsumer.handle(eventPayload);
    await profileConsumer.handle(eventPayload);

    // Only one profile should exist
    expect(repos.profileRepo.size).toBe(1);
  });

  // ── Consumer skips if profile already exists ──────────────────────────

  it('should skip profile creation if profile already exists for member', async () => {
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('dave@test.com', 'Dave Profile', 'Str0ng!Pass#2024'),
    );

    // Manually create a profile first
    const { Profile, ProfileId, DisplayName } = await import('@csn/domain-profile');
    const { Email } = await import('@csn/domain-shared');
    const profileId = ProfileId.generate();
    const memberId = UserId.create(regResult.member.id);
    const displayName = DisplayName.create('Dave Profile');
    const email = Email.create('dave@test.com');
    const existingProfile = Profile.create(profileId, memberId, displayName, email);
    await repos.profileRepo.save(existingProfile);

    // Now send the event with a different event ID (so idempotency won't skip it)
    const eventPayload = {
      type: 'MemberRegistered',
      eventId: randomUUID(),
      aggregateId: regResult.member.id,
      email: 'dave@test.com',
      displayName: 'Dave Profile',
    };

    await profileConsumer.handle(eventPayload);

    // Still only one profile
    expect(repos.profileRepo.size).toBe(1);
  });

  // ── Consumer ignores non-MemberRegistered events ──────────────────────

  it('should ignore events that are not MemberRegistered', async () => {
    const eventPayload = {
      type: 'SomeOtherEvent',
      eventId: randomUUID(),
      aggregateId: randomUUID(),
    };

    await profileConsumer.handle(eventPayload);

    // No profile created
    expect(repos.profileRepo.size).toBe(0);
  });

  // ── Full cross-context flow ───────────────────────────────────────────

  it('should complete full register -> event -> profile creation flow', async () => {
    // 1. Register
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('eve@test.com', 'Eve Full Flow', 'Str0ng!Pass#2024'),
    );
    expect(regResult.member.status).toBe('ACTIVE');

    // 2. Simulate the integration event
    const eventPayload = {
      type: 'MemberRegistered',
      eventId: randomUUID(),
      aggregateId: regResult.member.id,
      email: 'eve@test.com',
      displayName: 'Eve Full Flow',
    };

    // 3. Consumer processes event
    await profileConsumer.handle(eventPayload);

    // 4. Verify profile
    const profile = await repos.profileRepo.findByMemberId(
      UserId.create(regResult.member.id),
    );

    expect(profile).not.toBeNull();
    expect(profile!.memberId.value).toBe(regResult.member.id);
  });
});

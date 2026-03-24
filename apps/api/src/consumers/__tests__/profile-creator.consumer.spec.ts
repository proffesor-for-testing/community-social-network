import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileCreatorConsumer } from '../profile-creator.consumer';
import { IProfileRepository, Profile, ProfileId, DisplayName } from '@csn/domain-profile';
import { UserId, Email, Timestamp } from '@csn/domain-shared';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockProfileRepository(): IProfileRepository {
  return {
    nextId: vi.fn().mockReturnValue(ProfileId.generate()),
    findById: vi.fn().mockResolvedValue(null),
    exists: vi.fn().mockResolvedValue(false),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    findByMemberId: vi.fn().mockResolvedValue(null),
  };
}

function createMockIdempotencyStore() {
  return {
    isProcessed: vi.fn().mockResolvedValue(false),
    markProcessed: vi.fn().mockResolvedValue(undefined),
    ensureIdempotent: vi.fn().mockImplementation(
      async (_eventId: string, handler: () => Promise<void>) => {
        await handler();
        return true;
      },
    ),
    onModuleDestroy: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileCreatorConsumer', () => {
  let consumer: ProfileCreatorConsumer;
  let profileRepository: ReturnType<typeof createMockProfileRepository>;
  let idempotencyStore: ReturnType<typeof createMockIdempotencyStore>;

  beforeEach(() => {
    profileRepository = createMockProfileRepository();
    idempotencyStore = createMockIdempotencyStore();
    consumer = new ProfileCreatorConsumer(
      profileRepository as unknown as IProfileRepository,
      idempotencyStore as any,
    );
  });

  describe('handle - MemberRegistered', () => {
    const validPayload = {
      type: 'MemberRegistered',
      eventId: 'evt-reg-001',
      aggregateId: '11111111-1111-1111-1111-111111111111',
      email: 'alice@example.com',
      displayName: 'Alice Johnson',
    };

    it('should create a profile for a newly registered member', async () => {
      await consumer.handle(validPayload);

      expect(idempotencyStore.ensureIdempotent).toHaveBeenCalledWith(
        'profile:create:evt-reg-001',
        expect.any(Function),
      );

      expect(profileRepository.findByMemberId).toHaveBeenCalledTimes(1);
      expect(profileRepository.save).toHaveBeenCalledTimes(1);

      const savedProfile = (profileRepository.save as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedProfile).toBeInstanceOf(Profile);
      expect(savedProfile.memberId.value).toBe('11111111-1111-1111-1111-111111111111');
      expect(savedProfile.displayName.value).toBe('Alice Johnson');
    });

    it('should skip profile creation if profile already exists for member', async () => {
      const existingProfile = Profile.create(
        ProfileId.generate(),
        UserId.create('11111111-1111-1111-1111-111111111111'),
        DisplayName.create('Alice Johnson'),
        Email.create('alice@example.com'),
      );
      (profileRepository.findByMemberId as ReturnType<typeof vi.fn>).mockResolvedValue(existingProfile);

      await consumer.handle(validPayload);

      expect(profileRepository.findByMemberId).toHaveBeenCalledTimes(1);
      expect(profileRepository.save).not.toHaveBeenCalled();
    });

    it('should use idempotency store to prevent duplicate processing', async () => {
      idempotencyStore.ensureIdempotent.mockImplementation(
        async (_eventId: string, _handler: () => Promise<void>) => {
          // Simulates the event already being processed
          return false;
        },
      );

      await consumer.handle(validPayload);

      expect(idempotencyStore.ensureIdempotent).toHaveBeenCalledWith(
        'profile:create:evt-reg-001',
        expect.any(Function),
      );
      expect(profileRepository.save).not.toHaveBeenCalled();
    });

    it('should propagate errors from profile creation', async () => {
      const dbError = new Error('Database connection failed');
      (profileRepository.save as ReturnType<typeof vi.fn>).mockRejectedValue(dbError);

      // ensureIdempotent re-throws errors from the handler
      idempotencyStore.ensureIdempotent.mockImplementation(
        async (_eventId: string, handler: () => Promise<void>) => {
          await handler();
          return true;
        },
      );

      await expect(consumer.handle(validPayload)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('handle - unexpected event types', () => {
    it('should ignore non-MemberRegistered events', async () => {
      const payload = {
        type: 'SomeOtherEvent',
        eventId: 'evt-other',
        aggregateId: 'id-001',
      };

      await expect(consumer.handle(payload)).resolves.toBeUndefined();
      expect(profileRepository.save).not.toHaveBeenCalled();
    });
  });
});

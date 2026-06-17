import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserId, Email } from '@csn/domain-shared';
import {
  Alert,
  AlertType,
  AlertId,
} from '@csn/domain-notification';
import { Profile, ProfileId, DisplayName } from '@csn/domain-profile';
import { AlertCreatorService } from '../services/alert-creator.service';

function makeProfile(memberId: UserId, name: string): Profile {
  return Profile.create(
    ProfileId.generate(),
    memberId,
    DisplayName.create(name),
    Email.create(`${name.toLowerCase().replace(/\s+/g, '.')}@test.local`),
  );
}

const VALID_ALERT_UUID = '12345678-1234-4123-8123-123456789012';

function makeAlertRepo() {
  return {
    nextId: vi.fn(() => AlertId.create(VALID_ALERT_UUID)),
    save: vi.fn(async () => undefined),
  };
}

function makeProfileRepo(profileToReturn: Profile | null) {
  return {
    findByMemberId: vi.fn(async () => profileToReturn),
    findByMemberIds: vi.fn(async () => new Map()),
  };
}

describe('AlertCreatorService', () => {
  let recipientId: string;
  let actorId: string;
  let actorProfile: Profile;

  beforeEach(() => {
    recipientId = UserId.generate().value;
    actorId = UserId.generate().value;
    actorProfile = makeProfile(UserId.create(actorId), 'Alice Actor');
  });

  it('should save an Alert whose title starts with the actor display name', async () => {
    // Arrange
    const alertRepo = makeAlertRepo();
    const profileRepo = makeProfileRepo(actorProfile);
    const service = new AlertCreatorService(alertRepo as never, profileRepo as never);

    // Act
    await service.create({
      recipientId,
      actorId,
      type: AlertType.FOLLOW,
      verb: 'sent you a follow request',
      sourceId: 'src-1',
    });

    // Assert
    expect(alertRepo.save).toHaveBeenCalledTimes(1);
    const saved = alertRepo.save.mock.calls[0]![0] as Alert;
    expect(saved.content.title).toBe('Alice Actor sent you a follow request');
  });

  it('should fall back to "Someone" when the actor has no Profile row', async () => {
    // Arrange
    const alertRepo = makeAlertRepo();
    const profileRepo = makeProfileRepo(null);
    const service = new AlertCreatorService(alertRepo as never, profileRepo as never);

    // Act
    await service.create({
      recipientId,
      actorId,
      type: AlertType.FOLLOW,
      verb: 'started following you',
      sourceId: 'src-2',
    });

    // Assert
    const saved = alertRepo.save.mock.calls[0]![0] as Alert;
    expect(saved.content.title).toBe('Someone started following you');
  });

  it('should not save an Alert when actor is the recipient (self-notify guard)', async () => {
    // Arrange
    const alertRepo = makeAlertRepo();
    const profileRepo = makeProfileRepo(actorProfile);
    const service = new AlertCreatorService(alertRepo as never, profileRepo as never);

    // Act
    await service.create({
      recipientId: actorId,
      actorId,
      type: AlertType.FOLLOW,
      verb: 'pinged themselves',
      sourceId: 'src-3',
    });

    // Assert
    expect(alertRepo.save).not.toHaveBeenCalled();
  });

  it('should target the alert at the recipient id (not the actor)', async () => {
    // Arrange
    const alertRepo = makeAlertRepo();
    const profileRepo = makeProfileRepo(actorProfile);
    const service = new AlertCreatorService(alertRepo as never, profileRepo as never);

    // Act
    await service.create({
      recipientId,
      actorId,
      type: AlertType.FOLLOW,
      verb: 'sent you a follow request',
      sourceId: 'src-1',
    });

    // Assert
    const saved = alertRepo.save.mock.calls[0]![0] as Alert;
    expect(saved.recipientId.value).toBe(recipientId);
  });

  it('should swallow repository errors so the primary command still succeeds', async () => {
    // Arrange
    const alertRepo = makeAlertRepo();
    alertRepo.save.mockRejectedValueOnce(new Error('db down'));
    const profileRepo = makeProfileRepo(actorProfile);
    const service = new AlertCreatorService(alertRepo as never, profileRepo as never);

    // Act + Assert
    await expect(
      service.create({
        recipientId,
        actorId,
        type: AlertType.FOLLOW,
        verb: 'sent you a follow request',
        sourceId: 'src-err',
      }),
    ).resolves.toBeUndefined();
  });

  it('should attach the provided actionUrl to the alert content', async () => {
    // Arrange
    const alertRepo = makeAlertRepo();
    const profileRepo = makeProfileRepo(actorProfile);
    const service = new AlertCreatorService(alertRepo as never, profileRepo as never);

    // Act
    await service.create({
      recipientId,
      actorId,
      type: AlertType.FOLLOW,
      verb: 'accepted your follow request',
      actionUrl: '/profiles/abc',
      sourceId: 'src-acc',
    });

    // Assert
    const saved = alertRepo.save.mock.calls[0]![0] as Alert;
    expect(saved.content.actionUrl).toBe('/profiles/abc');
  });
});

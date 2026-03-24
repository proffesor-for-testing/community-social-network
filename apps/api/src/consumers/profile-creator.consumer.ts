import { Injectable, Logger, Inject } from '@nestjs/common';
import { IdempotencyStore } from '@csn/infra-messaging';
import {
  Profile,
  ProfileId,
  DisplayName,
  IProfileRepository,
} from '@csn/domain-profile';
import { UserId, Email } from '@csn/domain-shared';
import { EventConsumerHandler } from '@csn/infra-shared';

// ---------------------------------------------------------------------------
// Payload type
// ---------------------------------------------------------------------------

export interface MemberRegisteredPayload {
  eventId: string;
  aggregateId: string;
  email: string;
  displayName: string;
}

// ---------------------------------------------------------------------------
// Consumer
// ---------------------------------------------------------------------------

/**
 * Cross-context event consumer that auto-creates a Profile aggregate
 * in the Profile bounded context when a new Member registers in the
 * Identity bounded context.
 *
 * This ensures every registered member has a corresponding profile
 * without coupling the Identity context to the Profile context.
 *
 * Idempotent: checks both IdempotencyStore and whether a profile
 * already exists for the given memberId.
 */
@Injectable()
export class ProfileCreatorConsumer implements EventConsumerHandler {
  private readonly logger = new Logger(ProfileCreatorConsumer.name);

  constructor(
    @Inject('IProfileRepository')
    private readonly profileRepository: IProfileRepository,
    private readonly idempotencyStore: IdempotencyStore,
  ) {}

  async handle(event: unknown): Promise<void> {
    const payload = event as Record<string, unknown>;
    const eventType = payload['type'] as string | undefined;

    if (eventType !== 'MemberRegistered') {
      this.logger.warn(
        `ProfileCreatorConsumer received unexpected event type: ${eventType}`,
      );
      return;
    }

    return this.onMemberRegistered(payload as unknown as MemberRegisteredPayload);
  }

  private async onMemberRegistered(
    payload: MemberRegisteredPayload,
  ): Promise<void> {
    await this.idempotencyStore.ensureIdempotent(
      `profile:create:${payload.eventId}`,
      async () => {
        const memberId = UserId.create(payload.aggregateId);

        // Double-check: skip if a profile already exists for this member.
        const existingProfile = await this.profileRepository.findByMemberId(memberId);
        if (existingProfile) {
          this.logger.log(
            `Profile already exists for member ${payload.aggregateId}, skipping creation`,
          );
          return;
        }

        const profileId = ProfileId.generate();
        const displayName = DisplayName.create(payload.displayName);
        const email = Email.create(payload.email);

        const profile = Profile.create(profileId, memberId, displayName, email);
        await this.profileRepository.save(profile);

        this.logger.log(
          `Created profile ${profileId.value} for new member ${payload.aggregateId} (${payload.email})`,
        );
      },
    );
  }
}

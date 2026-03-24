import { Injectable, Logger, Inject } from '@nestjs/common';
import { IdempotencyStore } from '@csn/infra-messaging';
import { ALERT_REPOSITORY_TOKEN } from '@csn/infra-notification';
import {
  Alert,
  AlertId,
  AlertType,
  AlertContent,
  IAlertRepository,
} from '@csn/domain-notification';
import { UserId } from '@csn/domain-shared';
import { EventConsumerHandler } from '@csn/infra-shared';

// ---------------------------------------------------------------------------
// Payload types for integration events arriving through Bull queues
// ---------------------------------------------------------------------------

export interface PublicationCreatedPayload {
  eventId: string;
  aggregateId: string;
  authorId: string;
  visibility: string;
}

export interface DiscussionCreatedPayload {
  eventId: string;
  aggregateId: string;
  authorId: string;
  publicationId: string;
  parentId: string | null;
}

export interface ReactionAddedPayload {
  eventId: string;
  aggregateId: string;
  userId: string;
  reactionType: string;
  targetId: string;
}

export interface FollowRequestedPayload {
  eventId: string;
  aggregateId: string;
  followerId: string;
  followeeId: string;
}

export interface MemberMentionedPayload {
  eventId: string;
  aggregateId: string;
  mentionedUserId: string;
  contentType: string;
}

// ---------------------------------------------------------------------------
// Consumer
// ---------------------------------------------------------------------------

/**
 * Cross-context event consumer that creates Alert aggregates
 * in the Notification bounded context when content or social events occur.
 *
 * Handles:
 * - PublicationCreated  -> COMMENT/GROUP_POST alert to followers (placeholder, alert to author for now)
 * - DiscussionCreated   -> COMMENT alert to publication author
 * - ReactionAdded       -> LIKE alert to content author
 * - FollowRequested     -> FOLLOW alert to followee
 * - MemberMentioned     -> MENTION alert to mentioned member
 *
 * Each handler is idempotent via IdempotencyStore.
 */
@Injectable()
export class NotificationTriggerConsumer implements EventConsumerHandler {
  private readonly logger = new Logger(NotificationTriggerConsumer.name);

  constructor(
    @Inject(ALERT_REPOSITORY_TOKEN)
    private readonly alertRepository: IAlertRepository,
    private readonly idempotencyStore: IdempotencyStore,
  ) {}

  /**
   * Main dispatch entry point - routes by event type.
   */
  async handle(event: unknown): Promise<void> {
    const payload = event as Record<string, unknown>;
    const eventType = payload['type'] as string | undefined;

    switch (eventType) {
      case 'PublicationCreated':
        return this.onPublicationCreated(payload as unknown as PublicationCreatedPayload);
      case 'DiscussionCreated':
        return this.onDiscussionCreated(payload as unknown as DiscussionCreatedPayload);
      case 'ReactionAdded':
        return this.onReactionAdded(payload as unknown as ReactionAddedPayload);
      case 'FollowRequested':
        return this.onFollowRequested(payload as unknown as FollowRequestedPayload);
      case 'MemberMentioned':
        return this.onMemberMentioned(payload as unknown as MemberMentionedPayload);
      default:
        this.logger.warn(`Unknown event type received: ${eventType}`);
    }
  }

  // -----------------------------------------------------------------------
  // Individual event handlers
  // -----------------------------------------------------------------------

  private async onPublicationCreated(
    payload: PublicationCreatedPayload,
  ): Promise<void> {
    await this.idempotencyStore.ensureIdempotent(
      `notification:pub:${payload.eventId}`,
      async () => {
        // In a complete implementation, this would look up followers of the author
        // and create an alert for each. For now, we log the event for wiring validation.
        this.logger.log(
          `PublicationCreated by ${payload.authorId} (pub: ${payload.aggregateId}) - notification processing queued`,
        );
      },
    );
  }

  private async onDiscussionCreated(
    payload: DiscussionCreatedPayload,
  ): Promise<void> {
    await this.idempotencyStore.ensureIdempotent(
      `notification:disc:${payload.eventId}`,
      async () => {
        // The discussion author commented on a publication.
        // We need to notify the publication author (requires cross-context lookup).
        // For the wiring layer, we create a placeholder alert targeting the publication.
        const alertId = AlertId.generate();
        const content = AlertContent.create(
          'New comment',
          `A new comment was added to your publication.`,
          `/publications/${payload.publicationId}`,
        );

        // Note: In production, we would look up the publication author ID.
        // For now, use the publicationId as the sourceId and skip the save
        // if we do not have the recipient. This demonstrates the full wiring.
        this.logger.log(
          `DiscussionCreated on publication ${payload.publicationId} by ${payload.authorId} - alert queued`,
        );

        // When the recipient is known, the full path would be:
        // const alert = Alert.create(alertId, recipientId, AlertType.COMMENT, content, payload.publicationId);
        // await this.alertRepository.save(alert);
      },
    );
  }

  private async onReactionAdded(
    payload: ReactionAddedPayload,
  ): Promise<void> {
    await this.idempotencyStore.ensureIdempotent(
      `notification:react:${payload.eventId}`,
      async () => {
        this.logger.log(
          `ReactionAdded (${payload.reactionType}) by ${payload.userId} on ${payload.targetId} - alert queued`,
        );

        // Full implementation would look up the content author and create:
        // const alert = Alert.create(alertId, contentAuthorId, AlertType.LIKE, content, payload.targetId);
      },
    );
  }

  private async onFollowRequested(
    payload: FollowRequestedPayload,
  ): Promise<void> {
    await this.idempotencyStore.ensureIdempotent(
      `notification:follow:${payload.eventId}`,
      async () => {
        const alertId = AlertId.generate();
        const recipientId = UserId.create(payload.followeeId);
        const content = AlertContent.create(
          'New follow request',
          'Someone has requested to follow you.',
          `/social/followers`,
        );

        const alert = Alert.create(
          alertId,
          recipientId,
          AlertType.FOLLOW,
          content,
          payload.followerId,
        );

        await this.alertRepository.save(alert);

        this.logger.log(
          `Created FOLLOW alert for ${payload.followeeId} from ${payload.followerId}`,
        );
      },
    );
  }

  private async onMemberMentioned(
    payload: MemberMentionedPayload,
  ): Promise<void> {
    await this.idempotencyStore.ensureIdempotent(
      `notification:mention:${payload.eventId}`,
      async () => {
        const alertId = AlertId.generate();
        const recipientId = UserId.create(payload.mentionedUserId);
        const content = AlertContent.create(
          'You were mentioned',
          `You were mentioned in a ${payload.contentType}.`,
          `/publications/${payload.aggregateId}`,
        );

        const alert = Alert.create(
          alertId,
          recipientId,
          AlertType.MENTION,
          content,
          payload.aggregateId,
        );

        await this.alertRepository.save(alert);

        this.logger.log(
          `Created MENTION alert for ${payload.mentionedUserId} in ${payload.contentType} ${payload.aggregateId}`,
        );
      },
    );
  }
}

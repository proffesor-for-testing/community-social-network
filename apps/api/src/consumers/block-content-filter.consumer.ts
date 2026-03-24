import { Injectable, Logger } from '@nestjs/common';
import { IdempotencyStore } from '@csn/infra-messaging';
import { EventConsumerHandler } from '@csn/infra-shared';

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

export interface MemberBlockedPayload {
  eventId: string;
  aggregateId: string;
  blockerId: string;
  blockedId: string;
}

export interface MemberUnblockedPayload {
  eventId: string;
  aggregateId: string;
  blockerId: string;
  blockedId: string;
}

// ---------------------------------------------------------------------------
// Consumer
// ---------------------------------------------------------------------------

/**
 * Cross-context event consumer that adjusts content feed filtering
 * when a member blocks or unblocks another member.
 *
 * Handles:
 * - MemberBlocked   -> Add the blocked member to the blocker's content filter
 * - MemberUnblocked -> Remove the previously blocked member from the filter
 *
 * In a full implementation, this consumer would:
 * 1. Update a Redis set `blocked:{blockerId}` with the blocked member IDs
 * 2. The feed query service checks this set to filter out content
 * 3. Optionally, remove cached feed entries containing the blocked member's content
 *
 * Each handler is idempotent via IdempotencyStore.
 */
@Injectable()
export class BlockContentFilterConsumer implements EventConsumerHandler {
  private readonly logger = new Logger(BlockContentFilterConsumer.name);

  constructor(
    private readonly idempotencyStore: IdempotencyStore,
  ) {}

  async handle(event: unknown): Promise<void> {
    const payload = event as Record<string, unknown>;
    const eventType = payload['type'] as string | undefined;

    switch (eventType) {
      case 'MemberBlocked':
        return this.onMemberBlocked(payload as unknown as MemberBlockedPayload);
      case 'MemberUnblocked':
        return this.onMemberUnblocked(payload as unknown as MemberUnblockedPayload);
      default:
        this.logger.warn(
          `BlockContentFilterConsumer received unknown event type: ${eventType}`,
        );
    }
  }

  private async onMemberBlocked(
    payload: MemberBlockedPayload,
  ): Promise<void> {
    await this.idempotencyStore.ensureIdempotent(
      `block:filter:${payload.eventId}`,
      async () => {
        // In production: SADD blocked:{blockerId} {blockedId}
        // Also invalidate cached feed for blockerId
        this.logger.log(
          `Content filter: member ${payload.blockedId} blocked by ${payload.blockerId} - filtering content from feed`,
        );
      },
    );
  }

  private async onMemberUnblocked(
    payload: MemberUnblockedPayload,
  ): Promise<void> {
    await this.idempotencyStore.ensureIdempotent(
      `unblock:filter:${payload.eventId}`,
      async () => {
        // In production: SREM blocked:{blockerId} {blockedId}
        // Also invalidate cached feed for blockerId
        this.logger.log(
          `Content filter: member ${payload.blockedId} unblocked by ${payload.blockerId} - restoring content in feed`,
        );
      },
    );
  }
}

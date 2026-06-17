import { Inject, Injectable } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  Alert,
  AlertContent,
  AlertType,
  IAlertRepository,
} from '@csn/domain-notification';
import { IProfileRepository } from '@csn/domain-profile';
import { ALERT_REPOSITORY_TOKEN } from '@csn/infra-notification';

export interface CreateAlertInput {
  recipientId: string;
  actorId: string;
  type: AlertType;
  /** Verb fragment used to build the title: "{actorName} {verb}" — e.g. "started following you". */
  verb: string;
  body?: string;
  actionUrl?: string;
  /** Required by the Alert aggregate. Use the originating entity's id
   *  (connection id, comment id, etc.) so alerts can be back-traced. */
  sourceId: string;
}

/**
 * Side-effect helper that command handlers call after persisting their
 * aggregate. Looks up the actor's display name (so notifications read like
 * "Alice started following you" not "<uuid> started…") and writes an Alert
 * to the recipient. Best-effort: throws are caught and swallowed so the
 * primary action (follow / comment / react) is never blocked by an alert
 * failure.
 */
@Injectable()
export class AlertCreatorService {
  constructor(
    @Inject(ALERT_REPOSITORY_TOKEN)
    private readonly alertRepo: IAlertRepository,
    @Inject('IProfileRepository')
    private readonly profileRepo: IProfileRepository,
  ) {}

  async create(input: CreateAlertInput): Promise<void> {
    if (input.recipientId === input.actorId) {
      return; // never notify yourself
    }
    try {
      const actorProfile = await this.profileRepo.findByMemberId(
        UserId.create(input.actorId),
      );
      const actorName = actorProfile?.displayName.value ?? 'Someone';
      const title = `${actorName} ${input.verb}`;
      // Alert.content requires a non-empty body. Reuse the title when the
      // caller didn't pass a richer one so the user sees something coherent.
      const body = input.body?.trim() ? input.body : title;
      const content = AlertContent.create(title, body, input.actionUrl);
      const alert = Alert.create(
        this.alertRepo.nextId(),
        UserId.create(input.recipientId),
        input.type,
        content,
        input.sourceId,
      );
      await this.alertRepo.save(alert);
    } catch {
      // Best-effort: never let an alert write break the primary command.
    }
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { IAlertRepository } from '@csn/domain-notification';
import { UserId } from '@csn/domain-shared';
import { ALERT_REPOSITORY_TOKEN } from '@csn/infra-notification';
import { MarkAllReadCommand } from './mark-all-read.command';

@Injectable()
export class MarkAllReadHandler {
  constructor(
    @Inject(ALERT_REPOSITORY_TOKEN)
    private readonly alertRepository: IAlertRepository,
  ) {}

  async execute(command: MarkAllReadCommand): Promise<number> {
    const memberId = UserId.create(command.memberId);

    // Fetch all unread alerts for the member
    // Use a large page size to get all unread alerts
    const result = await this.alertRepository.findByRecipientId(memberId, {
      page: 1,
      pageSize: 1000,
    });

    let markedCount = 0;
    for (const alert of result.items) {
      if (alert.isUnread()) {
        alert.markAsRead();
        await this.alertRepository.save(alert);
        markedCount++;
      }
    }

    return markedCount;
  }
}

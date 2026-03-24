import { Inject, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AlertId, IAlertRepository } from '@csn/domain-notification';
import { ALERT_REPOSITORY_TOKEN } from '@csn/infra-notification';
import { MarkReadCommand } from './mark-read.command';

@Injectable()
export class MarkReadHandler {
  constructor(
    @Inject(ALERT_REPOSITORY_TOKEN)
    private readonly alertRepository: IAlertRepository,
  ) {}

  async execute(command: MarkReadCommand): Promise<void> {
    const alertId = AlertId.create(command.alertId);
    const alert = await this.alertRepository.findById(alertId);

    if (!alert) {
      throw new NotFoundException('Notification not found');
    }

    if (alert.recipientId.value !== command.memberId) {
      throw new ForbiddenException('Cannot mark another member\'s notification as read');
    }

    alert.markAsRead();
    await this.alertRepository.save(alert);
  }
}

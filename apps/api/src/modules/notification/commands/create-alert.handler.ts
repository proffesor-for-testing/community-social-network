import { Inject, Injectable } from '@nestjs/common';
import {
  Alert,
  AlertId,
  AlertContent,
  IAlertRepository,
} from '@csn/domain-notification';
import { UserId } from '@csn/domain-shared';
import { ALERT_REPOSITORY_TOKEN } from '@csn/infra-notification';
import { CreateAlertCommand } from './create-alert.command';

@Injectable()
export class CreateAlertHandler {
  constructor(
    @Inject(ALERT_REPOSITORY_TOKEN)
    private readonly alertRepository: IAlertRepository,
  ) {}

  async execute(command: CreateAlertCommand): Promise<string> {
    const alertId = this.alertRepository.nextId();
    const recipientId = UserId.create(command.recipientId);
    const content = AlertContent.create(
      command.title,
      command.body,
      command.actionUrl,
    );

    const alert = Alert.create(
      alertId,
      recipientId,
      command.type,
      content,
      command.sourceId,
    );

    await this.alertRepository.save(alert);

    return alertId.value;
  }
}

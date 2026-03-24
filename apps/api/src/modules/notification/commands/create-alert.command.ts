import { AlertType } from '@csn/domain-notification';

export class CreateAlertCommand {
  constructor(
    public readonly recipientId: string,
    public readonly type: AlertType,
    public readonly title: string,
    public readonly body: string,
    public readonly sourceId: string,
    public readonly actionUrl?: string,
  ) {}
}

import { Inject, Injectable } from '@nestjs/common';
import { IAlertRepository } from '@csn/domain-notification';
import { UserId } from '@csn/domain-shared';
import { ALERT_REPOSITORY_TOKEN } from '@csn/infra-notification';
import { GetUnreadCountQuery } from './get-unread-count.query';

@Injectable()
export class GetUnreadCountHandler {
  constructor(
    @Inject(ALERT_REPOSITORY_TOKEN)
    private readonly alertRepository: IAlertRepository,
  ) {}

  async execute(query: GetUnreadCountQuery): Promise<number> {
    const memberId = UserId.create(query.memberId);
    return this.alertRepository.countUnread(memberId);
  }
}

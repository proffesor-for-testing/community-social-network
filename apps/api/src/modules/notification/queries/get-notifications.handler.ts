import { Inject, Injectable } from '@nestjs/common';
import { IAlertRepository } from '@csn/domain-notification';
import { UserId, PaginatedResult } from '@csn/domain-shared';
import { ALERT_REPOSITORY_TOKEN } from '@csn/infra-notification';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { GetNotificationsQuery } from './get-notifications.query';

export interface PaginatedNotificationsResult {
  items: NotificationResponseDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

@Injectable()
export class GetNotificationsHandler {
  constructor(
    @Inject(ALERT_REPOSITORY_TOKEN)
    private readonly alertRepository: IAlertRepository,
  ) {}

  async execute(query: GetNotificationsQuery): Promise<PaginatedNotificationsResult> {
    const memberId = UserId.create(query.memberId);

    const result = await this.alertRepository.findByRecipientId(memberId, {
      page: query.page,
      pageSize: query.pageSize,
    });

    let items = result.items;
    if (query.unreadOnly) {
      items = items.filter((alert) => alert.isUnread());
    }

    return {
      items: items.map(NotificationResponseDto.fromDomain),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPreviousPage: result.hasPreviousPage,
    };
  }
}

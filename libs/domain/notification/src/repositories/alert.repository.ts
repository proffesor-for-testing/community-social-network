import { IRepository, UserId, PaginatedResult, PaginationParams } from '@csn/domain-shared';
import { Alert } from '../aggregates/alert';
import { AlertId } from '../value-objects/alert-id';

export interface IAlertRepository extends IRepository<Alert, AlertId> {
  findByRecipientId(
    recipientId: UserId,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Alert>>;
  countUnread(recipientId: UserId): Promise<number>;
}

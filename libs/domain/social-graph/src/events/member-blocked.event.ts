import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class MemberBlockedEvent extends DomainEvent {
  public readonly blockerId: string;
  public readonly blockedId: string;

  constructor(
    aggregateId: string,
    blockerId: string,
    blockedId: string,
    version?: number,
    metadata?: EventMetadata,
  ) {
    super(aggregateId, version, metadata);
    this.blockerId = blockerId;
    this.blockedId = blockedId;
  }

  get eventType(): string {
    return 'MemberBlocked';
  }

  get aggregateType(): string {
    return 'Block';
  }
}

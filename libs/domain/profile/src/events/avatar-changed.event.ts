import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class AvatarChangedEvent extends DomainEvent {
  public readonly avatarId: string | null;

  constructor(
    aggregateId: string,
    avatarId: string | null,
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.avatarId = avatarId;
  }

  get eventType(): string {
    return 'AvatarChanged';
  }

  get aggregateType(): string {
    return 'Profile';
  }
}

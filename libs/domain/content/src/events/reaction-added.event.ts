import { DomainEvent, EventMetadata } from '@csn/domain-shared';

export class ReactionAddedEvent extends DomainEvent {
  public readonly userId: string;
  public readonly reactionType: string;
  public readonly targetId: string;

  constructor(
    aggregateId: string,
    userId: string,
    reactionType: string,
    targetId: string,
    metadata?: EventMetadata,
  ) {
    super(aggregateId, 1, metadata);
    this.userId = userId;
    this.reactionType = reactionType;
    this.targetId = targetId;
  }

  get eventType(): string {
    return 'ReactionAdded';
  }

  get aggregateType(): string {
    return 'Publication';
  }
}

import { ReactionTypeEnum } from '@csn/domain-content';

export class AddReactionCommand {
  constructor(
    public readonly targetId: string,
    public readonly targetType: 'post' | 'comment',
    public readonly userId: string,
    public readonly reactionType: ReactionTypeEnum,
  ) {}
}

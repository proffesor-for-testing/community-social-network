import { VisibilityEnum } from '@csn/domain-content';

export class CreatePostCommand {
  constructor(
    public readonly authorId: string,
    public readonly content: string,
    public readonly visibility: VisibilityEnum,
  ) {}
}

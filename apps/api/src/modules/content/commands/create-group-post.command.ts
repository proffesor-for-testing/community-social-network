import { VisibilityEnum } from '@csn/domain-content';

export class CreateGroupPostCommand {
  constructor(
    public readonly groupId: string,
    public readonly authorId: string,
    public readonly content: string,
    public readonly visibility: VisibilityEnum = VisibilityEnum.GROUP_ONLY,
  ) {}
}

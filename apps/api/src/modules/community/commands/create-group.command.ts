export class CreateGroupCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly description: string,
    public readonly settings?: {
      isPublic?: boolean;
      requireApproval?: boolean;
      allowMemberPosts?: boolean;
    },
  ) {}
}

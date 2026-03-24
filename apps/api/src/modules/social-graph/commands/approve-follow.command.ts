export class ApproveFollowCommand {
  constructor(
    public readonly connectionId: string,
    public readonly currentUserId: string,
  ) {}
}

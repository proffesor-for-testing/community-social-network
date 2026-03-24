export class RejectFollowCommand {
  constructor(
    public readonly connectionId: string,
    public readonly currentUserId: string,
  ) {}
}

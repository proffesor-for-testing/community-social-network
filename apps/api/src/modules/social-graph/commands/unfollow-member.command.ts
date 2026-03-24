export class UnfollowMemberCommand {
  constructor(
    public readonly followerId: string,
    public readonly followeeId: string,
  ) {}
}

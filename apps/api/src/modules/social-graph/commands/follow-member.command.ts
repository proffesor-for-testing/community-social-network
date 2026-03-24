export class FollowMemberCommand {
  constructor(
    public readonly followerId: string,
    public readonly followeeId: string,
  ) {}
}

export class KickMemberCommand {
  constructor(
    public readonly actorId: string,
    public readonly groupId: string,
    public readonly targetMemberId: string,
    public readonly reason?: string,
  ) {}
}

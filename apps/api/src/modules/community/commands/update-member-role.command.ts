export class UpdateMemberRoleCommand {
  constructor(
    public readonly actorId: string,
    public readonly groupId: string,
    public readonly targetMemberId: string,
    public readonly newRole: string,
  ) {}
}

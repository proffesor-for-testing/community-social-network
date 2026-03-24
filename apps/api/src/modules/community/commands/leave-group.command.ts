export class LeaveGroupCommand {
  constructor(
    public readonly userId: string,
    public readonly groupId: string,
  ) {}
}

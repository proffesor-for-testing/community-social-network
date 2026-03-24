export class JoinGroupCommand {
  constructor(
    public readonly userId: string,
    public readonly groupId: string,
  ) {}
}

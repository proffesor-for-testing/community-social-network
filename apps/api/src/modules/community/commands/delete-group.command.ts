export class DeleteGroupCommand {
  constructor(
    public readonly userId: string,
    public readonly groupId: string,
  ) {}
}

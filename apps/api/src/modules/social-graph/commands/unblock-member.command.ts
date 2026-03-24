export class UnblockMemberCommand {
  constructor(
    public readonly blockerId: string,
    public readonly blockedId: string,
  ) {}
}

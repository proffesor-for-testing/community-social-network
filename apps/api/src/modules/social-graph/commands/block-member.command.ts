export class BlockMemberCommand {
  constructor(
    public readonly blockerId: string,
    public readonly blockedId: string,
  ) {}
}

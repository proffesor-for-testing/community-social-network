export class StartConversationCommand {
  constructor(
    public readonly initiatorId: string,
    public readonly recipientId: string,
  ) {}
}

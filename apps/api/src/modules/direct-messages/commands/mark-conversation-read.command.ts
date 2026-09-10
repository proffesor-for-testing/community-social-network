export class MarkConversationReadCommand {
  constructor(
    public readonly conversationId: string,
    public readonly viewerId: string,
  ) {}
}

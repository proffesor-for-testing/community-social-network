export class GetMessagesQuery {
  constructor(
    public readonly conversationId: string,
    public readonly viewerId: string,
    public readonly cursor: string | null = null,
    public readonly limit: number = 30,
  ) {}
}

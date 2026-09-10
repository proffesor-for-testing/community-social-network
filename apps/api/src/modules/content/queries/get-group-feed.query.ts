export class GetGroupFeedQuery {
  constructor(
    public readonly groupId: string,
    public readonly viewerId: string,
    public readonly cursor?: string,
    public readonly limit: number = 20,
  ) {}
}

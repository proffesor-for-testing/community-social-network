export class GetExploreFeedQuery {
  constructor(
    public readonly viewerId?: string,
    public readonly cursor?: string,
    public readonly limit: number = 20,
  ) {}
}

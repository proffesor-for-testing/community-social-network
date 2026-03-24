export class GetFeedQuery {
  constructor(
    public readonly userId: string,
    public readonly cursor?: string,
    public readonly limit: number = 20,
  ) {}
}

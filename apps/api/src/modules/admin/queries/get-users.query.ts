export class GetUsersQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
  ) {}
}

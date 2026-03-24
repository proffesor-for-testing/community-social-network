export class GetSecurityAlertsQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
  ) {}
}

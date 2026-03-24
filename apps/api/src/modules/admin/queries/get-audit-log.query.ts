export class GetAuditLogQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
    public readonly action?: string,
    public readonly actorId?: string,
    public readonly startDate?: string,
    public readonly endDate?: string,
  ) {}
}

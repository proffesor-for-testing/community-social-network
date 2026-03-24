export class GetNotificationsQuery {
  constructor(
    public readonly memberId: string,
    public readonly page: number = 1,
    public readonly pageSize: number = 20,
    public readonly unreadOnly: boolean = false,
  ) {}
}

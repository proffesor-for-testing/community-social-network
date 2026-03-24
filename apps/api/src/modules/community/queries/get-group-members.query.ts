export class GetGroupMembersQuery {
  constructor(
    public readonly groupId: string,
    public readonly page: number = 1,
    public readonly pageSize: number = 20,
  ) {}
}

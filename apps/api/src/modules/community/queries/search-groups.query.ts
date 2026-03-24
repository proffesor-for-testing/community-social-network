export class SearchGroupsQuery {
  constructor(
    public readonly searchQuery: string = '',
    public readonly page: number = 1,
    public readonly pageSize: number = 20,
  ) {}
}

export class GetCurrentMemberQuery {
  constructor(
    public readonly memberId: string,
    /** Roles carried by the access token (e.g. ['admin','member']). */
    public readonly roles: readonly string[] = [],
  ) {}
}

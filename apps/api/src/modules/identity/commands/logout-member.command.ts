export class LogoutMemberCommand {
  constructor(
    public readonly userId: string,
    public readonly accessTokenJti: string,
  ) {}
}

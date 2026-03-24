export class LoginMemberCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}

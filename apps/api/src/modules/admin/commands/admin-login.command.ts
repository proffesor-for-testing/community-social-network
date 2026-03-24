export class AdminLoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly ipAddress: string,
  ) {}
}

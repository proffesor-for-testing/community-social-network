export class Setup2faCommand {
  constructor(
    public readonly adminId: string,
    public readonly verificationCode: string,
    public readonly ipAddress: string,
  ) {}
}

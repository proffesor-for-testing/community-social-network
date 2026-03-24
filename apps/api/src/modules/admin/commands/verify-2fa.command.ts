export class Verify2faCommand {
  constructor(
    public readonly adminId: string,
    public readonly code: string,
    public readonly ipAddress: string,
  ) {}
}

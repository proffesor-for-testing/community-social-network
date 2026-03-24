export class SuspendUserCommand {
  constructor(
    public readonly adminId: string,
    public readonly targetUserId: string,
    public readonly reason: string,
    public readonly ipAddress: string,
  ) {}
}

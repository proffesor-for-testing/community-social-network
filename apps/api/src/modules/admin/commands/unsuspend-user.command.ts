export class UnsuspendUserCommand {
  constructor(
    public readonly adminId: string,
    public readonly targetUserId: string,
    public readonly ipAddress: string,
  ) {}
}

export class UpdateProfileCommand {
  constructor(
    public readonly profileId: string,
    public readonly requesterId: string,
    public readonly displayName?: string,
    public readonly bio?: string,
    public readonly city?: string,
    public readonly country?: string,
  ) {}
}

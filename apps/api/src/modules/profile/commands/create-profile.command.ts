export class CreateProfileCommand {
  constructor(
    public readonly memberId: string,
    public readonly displayName: string,
    public readonly email: string,
  ) {}
}

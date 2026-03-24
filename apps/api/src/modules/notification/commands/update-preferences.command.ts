export class UpdatePreferencesCommand {
  constructor(
    public readonly memberId: string,
    public readonly preferences: Record<string, string[]>,
  ) {}
}

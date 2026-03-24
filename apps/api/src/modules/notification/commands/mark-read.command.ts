export class MarkReadCommand {
  constructor(
    public readonly alertId: string,
    public readonly memberId: string,
  ) {}
}

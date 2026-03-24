export class UpdatePostCommand {
  constructor(
    public readonly postId: string,
    public readonly requesterId: string,
    public readonly content?: string,
  ) {}
}

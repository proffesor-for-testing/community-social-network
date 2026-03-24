export class CreateCommentCommand {
  constructor(
    public readonly postId: string,
    public readonly authorId: string,
    public readonly content: string,
    public readonly parentCommentId?: string,
  ) {}
}

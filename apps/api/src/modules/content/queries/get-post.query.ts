export class GetPostQuery {
  constructor(
    public readonly postId: string,
    /** Optional: the authenticated viewer, used to resolve viewerReaction. */
    public readonly viewerId?: string,
  ) {}
}

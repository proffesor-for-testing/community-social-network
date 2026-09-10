import { IRepository, UserId } from '@csn/domain-shared';
import { Publication } from '../aggregates/publication';
import { PublicationId } from '../value-objects/publication-id';
import { GroupId } from '../value-objects/group-id';
import { FeedCursorPosition } from '../value-objects/feed-cursor';

/** Keyset-pagination options for the feed reads. */
export interface FeedPageOptions {
  /** Position of the last item of the previous page, or null for the first page. */
  cursor?: FeedCursorPosition | null;
  /** Maximum number of rows to return. */
  limit: number;
}

export interface IPublicationRepository
  extends IRepository<Publication, PublicationId> {
  findByAuthorId(authorId: UserId): Promise<Publication[]>;

  /**
   * Every PUBLIC + PUBLISHED publication that is not a group post.
   * Used by the Explore / trending read model.
   */
  findAllPublished(): Promise<Publication[]>;

  /**
   * The personal feed slice: PUBLISHED publications written by any of
   * `authorIds`, excluding group posts, newest first, keyset-paginated.
   * Returns an empty array when `authorIds` is empty.
   */
  findFeedForAuthors(
    authorIds: UserId[],
    options: FeedPageOptions,
  ): Promise<Publication[]>;

  /**
   * PUBLISHED publications posted into a single group, newest first,
   * keyset-paginated.
   */
  findByGroupId(
    groupId: GroupId,
    options: FeedPageOptions,
  ): Promise<Publication[]>;
}

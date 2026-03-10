import { AggregateRoot, UserId, Timestamp } from '@csn/domain-shared';
import { DiscussionId } from '../value-objects/discussion-id';
import { PublicationId } from '../value-objects/publication-id';
import { DiscussionContent } from '../value-objects/discussion-content';
import { DiscussionStatus } from '../value-objects/discussion-status';
import { DiscussionCreatedEvent } from '../events/discussion-created.event';

export class Discussion extends AggregateRoot<DiscussionId> {
  private _publicationId: PublicationId;
  private _authorId: UserId;
  private _content: DiscussionContent;
  private _parentId: DiscussionId | null;
  private _status: DiscussionStatus;
  private _createdAt: Timestamp;

  private constructor(
    id: DiscussionId,
    publicationId: PublicationId,
    authorId: UserId,
    content: DiscussionContent,
    parentId: DiscussionId | null,
    status: DiscussionStatus,
    createdAt: Timestamp,
  ) {
    super(id);
    this._publicationId = publicationId;
    this._authorId = authorId;
    this._content = content;
    this._parentId = parentId;
    this._status = status;
    this._createdAt = createdAt;
  }

  public static create(
    id: DiscussionId,
    publicationId: PublicationId,
    authorId: UserId,
    content: DiscussionContent,
    parentId?: DiscussionId | null,
  ): Discussion {
    const discussion = new Discussion(
      id,
      publicationId,
      authorId,
      content,
      parentId ?? null,
      DiscussionStatus.ACTIVE,
      Timestamp.now(),
    );

    discussion.addDomainEvent(
      new DiscussionCreatedEvent(
        id.value,
        authorId.value,
        publicationId.value,
        parentId?.value ?? null,
      ),
    );

    return discussion;
  }

  /**
   * Reconstitute a Discussion from persistence without emitting events.
   */
  public static reconstitute(
    id: DiscussionId,
    publicationId: PublicationId,
    authorId: UserId,
    content: DiscussionContent,
    parentId: DiscussionId | null,
    status: DiscussionStatus,
    createdAt: Timestamp,
    version: number,
  ): Discussion {
    const discussion = new Discussion(
      id,
      publicationId,
      authorId,
      content,
      parentId,
      status,
      createdAt,
    );
    discussion['setVersion'](version);
    return discussion;
  }

  public get publicationId(): PublicationId {
    return this._publicationId;
  }

  public get authorId(): UserId {
    return this._authorId;
  }

  public get content(): DiscussionContent {
    return this._content;
  }

  public get parentId(): DiscussionId | null {
    return this._parentId;
  }

  public get status(): DiscussionStatus {
    return this._status;
  }

  public get createdAt(): Timestamp {
    return this._createdAt;
  }

  public hide(): void {
    this._status = DiscussionStatus.HIDDEN;
    this.incrementVersion();
  }

  public delete(): void {
    this._status = DiscussionStatus.DELETED;
    this.incrementVersion();
  }

  public isReply(): boolean {
    return this._parentId !== null;
  }
}

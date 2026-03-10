import { AggregateRoot, UserId, Timestamp, CONTENT_LIMITS } from '@csn/domain-shared';
import { PublicationId } from '../value-objects/publication-id';
import { PublicationContent } from '../value-objects/publication-content';
import { Visibility, VisibilityEnum } from '../value-objects/visibility';
import { PublicationStatus } from '../value-objects/publication-status';
import { ReactionType } from '../value-objects/reaction-type';
import { Mention } from '../value-objects/mention';
import { PublicationCreatedEvent } from '../events/publication-created.event';
import { PublicationEditedEvent } from '../events/publication-edited.event';
import { PublicationDeletedEvent } from '../events/publication-deleted.event';
import { MemberMentionedEvent } from '../events/member-mentioned.event';
import { ReactionAddedEvent } from '../events/reaction-added.event';
import { CannotEditError } from '../errors/cannot-edit.error';
import { MaxMentionsExceededError } from '../errors/max-mentions-exceeded.error';

export class Publication extends AggregateRoot<PublicationId> {
  private _authorId: UserId;
  private _content: PublicationContent;
  private _visibility: Visibility;
  private _status: PublicationStatus;
  private _mentions: Mention[];
  private _mediaIds: string[];
  private _reactionCounts: Map<string, number>;
  private _createdAt: Timestamp;
  private _updatedAt: Timestamp;

  private constructor(
    id: PublicationId,
    authorId: UserId,
    content: PublicationContent,
    visibility: Visibility,
    status: PublicationStatus,
    mentions: Mention[],
    mediaIds: string[],
    reactionCounts: Map<string, number>,
    createdAt: Timestamp,
    updatedAt: Timestamp,
  ) {
    super(id);
    this._authorId = authorId;
    this._content = content;
    this._visibility = visibility;
    this._status = status;
    this._mentions = mentions;
    this._mediaIds = mediaIds;
    this._reactionCounts = reactionCounts;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  public static create(
    id: PublicationId,
    authorId: UserId,
    content: PublicationContent,
    visibility: Visibility,
  ): Publication {
    const now = Timestamp.now();
    const publication = new Publication(
      id,
      authorId,
      content,
      visibility,
      PublicationStatus.PUBLISHED,
      [],
      [],
      new Map<string, number>(),
      now,
      now,
    );

    publication.addDomainEvent(
      new PublicationCreatedEvent(
        id.value,
        authorId.value,
        visibility.value,
      ),
    );

    return publication;
  }

  /**
   * Reconstitute a Publication from persistence without emitting events.
   */
  public static reconstitute(
    id: PublicationId,
    authorId: UserId,
    content: PublicationContent,
    visibility: Visibility,
    status: PublicationStatus,
    mentions: Mention[],
    mediaIds: string[],
    reactionCounts: Map<string, number>,
    createdAt: Timestamp,
    updatedAt: Timestamp,
    version: number,
  ): Publication {
    const publication = new Publication(
      id,
      authorId,
      content,
      visibility,
      status,
      mentions,
      mediaIds,
      reactionCounts,
      createdAt,
      updatedAt,
    );
    publication['setVersion'](version);
    return publication;
  }

  public get authorId(): UserId {
    return this._authorId;
  }

  public get content(): PublicationContent {
    return this._content;
  }

  public get visibility(): Visibility {
    return this._visibility;
  }

  public get status(): PublicationStatus {
    return this._status;
  }

  public get mentions(): ReadonlyArray<Mention> {
    return [...this._mentions];
  }

  public get mediaIds(): ReadonlyArray<string> {
    return [...this._mediaIds];
  }

  public get reactionCounts(): ReadonlyMap<string, number> {
    return new Map(this._reactionCounts);
  }

  public get createdAt(): Timestamp {
    return this._createdAt;
  }

  public get updatedAt(): Timestamp {
    return this._updatedAt;
  }

  public edit(content: PublicationContent): void {
    if (!this._status.isPublished()) {
      throw new CannotEditError(
        `publication is in ${this._status.value} status`,
      );
    }
    this._content = content;
    this._updatedAt = Timestamp.now();
    this.incrementVersion();
    this.addDomainEvent(
      new PublicationEditedEvent(this.id.value, ['content']),
    );
  }

  public delete(): void {
    this._status = this._status.transitionTo(PublicationStatus.DELETED);
    this._updatedAt = Timestamp.now();
    this.incrementVersion();
    this.addDomainEvent(new PublicationDeletedEvent(this.id.value));
  }

  public archive(): void {
    this._status = this._status.transitionTo(PublicationStatus.ARCHIVED);
    this._updatedAt = Timestamp.now();
    this.incrementVersion();
  }

  public addMentions(mentions: Mention[]): void {
    const totalCount = this._mentions.length + mentions.length;
    if (totalCount > CONTENT_LIMITS.MAX_MENTIONS_PER_CONTENT) {
      throw new MaxMentionsExceededError();
    }
    this._mentions = [...this._mentions, ...mentions];
    this._updatedAt = Timestamp.now();
    this.incrementVersion();

    for (const mention of mentions) {
      this.addDomainEvent(
        new MemberMentionedEvent(
          this.id.value,
          mention.userId,
          'publication',
        ),
      );
    }
  }

  public addReaction(userId: string, type: ReactionType): void {
    const key = type.value;
    const current = this._reactionCounts.get(key) ?? 0;
    this._reactionCounts.set(key, current + 1);
    this.incrementVersion();
    this.addDomainEvent(
      new ReactionAddedEvent(this.id.value, userId, key, this.id.value),
    );
  }

  public removeReaction(userId: string, type: ReactionType): void {
    const key = type.value;
    const current = this._reactionCounts.get(key) ?? 0;
    if (current > 0) {
      this._reactionCounts.set(key, current - 1);
      this.incrementVersion();
    }
  }

  public isVisibleTo(
    requesterId: UserId,
    isConnection: boolean,
    isGroupMember: boolean,
  ): boolean {
    // Author can always see their own publication
    if (this._authorId.equals(requesterId)) {
      return true;
    }

    // Deleted publications are not visible
    if (this._status.isDeleted()) {
      return false;
    }

    switch (this._visibility.value) {
      case VisibilityEnum.PUBLIC:
        return true;
      case VisibilityEnum.CONNECTIONS_ONLY:
        return isConnection;
      case VisibilityEnum.GROUP_ONLY:
        return isGroupMember;
      case VisibilityEnum.PRIVATE:
        return false;
      default:
        return false;
    }
  }
}

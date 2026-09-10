import { AggregateRoot, UserId, Timestamp } from '@csn/domain-shared';
import { ConversationId } from '../value-objects/conversation-id';
import { ParticipantPair } from '../value-objects/participant-pair';
import { ConversationStartedEvent } from '../events/conversation-started.event';
import { NotAParticipantError } from '../errors/not-a-participant.error';

/**
 * A 1:1 conversation between exactly two members. Messages are their own
 * aggregate; the conversation owns membership and the last-activity clock the
 * inbox is ordered by.
 */
export class Conversation extends AggregateRoot<ConversationId> {
  private _participants: ParticipantPair;
  private _createdAt: Timestamp;
  private _updatedAt: Timestamp;

  private constructor(
    id: ConversationId,
    participants: ParticipantPair,
    createdAt: Timestamp,
    updatedAt: Timestamp,
  ) {
    super(id);
    this._participants = participants;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  public static create(
    id: ConversationId,
    participants: ParticipantPair,
  ): Conversation {
    const now = Timestamp.now();
    const conversation = new Conversation(id, participants, now, now);

    conversation.addDomainEvent(
      new ConversationStartedEvent(
        id.value,
        participants.participantA.value,
        participants.participantB.value,
      ),
    );
    conversation.incrementVersion();

    return conversation;
  }

  /** Rebuild a Conversation from persistence without emitting events. */
  public static reconstitute(
    id: ConversationId,
    participants: ParticipantPair,
    createdAt: Timestamp,
    updatedAt: Timestamp,
    version: number,
  ): Conversation {
    const conversation = new Conversation(id, participants, createdAt, updatedAt);
    conversation.setVersion(version);
    return conversation;
  }

  public hasParticipant(userId: UserId): boolean {
    return this._participants.includes(userId);
  }

  /** Throws NotAParticipantError when the user is an outsider. */
  public assertParticipant(userId: UserId): void {
    if (!this._participants.includes(userId)) {
      throw new NotAParticipantError(userId.value);
    }
  }

  public otherParticipant(userId: UserId): UserId {
    return this._participants.other(userId);
  }

  /** Bumps the last-activity clock so the inbox re-sorts to the top. */
  public recordActivity(at: Timestamp = Timestamp.now()): void {
    this._updatedAt = at;
    this.incrementVersion();
  }

  public get participants(): ParticipantPair {
    return this._participants;
  }

  public get createdAt(): Timestamp {
    return this._createdAt;
  }

  public get updatedAt(): Timestamp {
    return this._updatedAt;
  }
}

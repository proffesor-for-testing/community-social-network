import { IRepository, UserId } from '@csn/domain-shared';
import { Conversation } from '../aggregates/conversation';
import { ConversationId } from '../value-objects/conversation-id';
import { ParticipantPair } from '../value-objects/participant-pair';

export interface IConversationRepository
  extends IRepository<Conversation, ConversationId> {
  /** Looks up the single conversation for a pair, in either order. */
  findByParticipants(pair: ParticipantPair): Promise<Conversation | null>;

  /**
   * Returns the existing conversation for the pair, creating and persisting
   * one when there is none. Implementations must be safe against the unique
   * (participant_a, participant_b) constraint racing two concurrent callers.
   */
  findOrCreate(pair: ParticipantPair): Promise<Conversation>;

  /** The viewer's conversations, most recent activity first. */
  findByParticipant(userId: UserId): Promise<Conversation[]>;
}

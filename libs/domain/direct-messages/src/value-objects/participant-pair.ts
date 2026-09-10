import { ValueObject, UserId } from '@csn/domain-shared';
import { CannotMessageSelfError } from '../errors/cannot-message-self.error';
import { NotAParticipantError } from '../errors/not-a-participant.error';

interface ParticipantPairProps {
  participantA: string;
  participantB: string;
}

/**
 * The two members of a 1:1 conversation, held in a canonical order
 * (lexicographically ascending by user id). Canonical ordering is what makes
 * the (participant_a, participant_b) unique index enough to guarantee one
 * conversation per pair regardless of who started it.
 */
export class ParticipantPair extends ValueObject<ParticipantPairProps> {
  private constructor(props: ParticipantPairProps) {
    super(props);
  }

  public static create(first: UserId, second: UserId): ParticipantPair {
    if (first.value === second.value) {
      throw new CannotMessageSelfError();
    }

    const [participantA, participantB] = [first.value, second.value].sort();
    return new ParticipantPair({ participantA, participantB });
  }

  public get participantA(): UserId {
    return UserId.create(this.props.participantA);
  }

  public get participantB(): UserId {
    return UserId.create(this.props.participantB);
  }

  public includes(userId: UserId): boolean {
    return (
      this.props.participantA === userId.value ||
      this.props.participantB === userId.value
    );
  }

  /** The participant who is *not* the given user. */
  public other(userId: UserId): UserId {
    if (this.props.participantA === userId.value) {
      return UserId.create(this.props.participantB);
    }
    if (this.props.participantB === userId.value) {
      return UserId.create(this.props.participantA);
    }
    throw new NotAParticipantError(userId.value);
  }
}

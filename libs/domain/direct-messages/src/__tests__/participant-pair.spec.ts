import { describe, it, expect } from 'vitest';
import { UserId } from '@csn/domain-shared';
import { ParticipantPair } from '../value-objects/participant-pair';
import { CannotMessageSelfError } from '../errors/cannot-message-self.error';
import { NotAParticipantError } from '../errors/not-a-participant.error';

const LOWER = '11111111-1111-4111-8111-111111111111';
const HIGHER = '99999999-9999-4999-8999-999999999999';
const OUTSIDER = '55555555-5555-4555-8555-555555555555';

describe('ParticipantPair', () => {
  it('should order the lower id into participantA regardless of argument order', () => {
    // Arrange
    const first = UserId.create(HIGHER);
    const second = UserId.create(LOWER);

    // Act
    const pair = ParticipantPair.create(first, second);

    // Assert
    expect(pair.participantA.value).toBe(LOWER);
  });

  it('should produce an identical pair when the arguments are swapped', () => {
    // Arrange
    const forward = ParticipantPair.create(UserId.create(LOWER), UserId.create(HIGHER));

    // Act
    const reversed = ParticipantPair.create(UserId.create(HIGHER), UserId.create(LOWER));

    // Assert
    expect(reversed.equals(forward)).toBe(true);
  });

  it('should reject a pair of the same user', () => {
    // Arrange
    const user = UserId.create(LOWER);

    // Act
    const act = () => ParticipantPair.create(user, user);

    // Assert
    expect(act).toThrow(CannotMessageSelfError);
  });

  it('should report a member of the pair as included', () => {
    // Arrange
    const pair = ParticipantPair.create(UserId.create(LOWER), UserId.create(HIGHER));

    // Act
    const included = pair.includes(UserId.create(HIGHER));

    // Assert
    expect(included).toBe(true);
  });

  it('should report a non-member as not included', () => {
    // Arrange
    const pair = ParticipantPair.create(UserId.create(LOWER), UserId.create(HIGHER));

    // Act
    const included = pair.includes(UserId.create(OUTSIDER));

    // Assert
    expect(included).toBe(false);
  });

  it('should return the counterpart of a given participant', () => {
    // Arrange
    const pair = ParticipantPair.create(UserId.create(LOWER), UserId.create(HIGHER));

    // Act
    const other = pair.other(UserId.create(LOWER));

    // Assert
    expect(other.value).toBe(HIGHER);
  });

  it('should throw when asked for the counterpart of an outsider', () => {
    // Arrange
    const pair = ParticipantPair.create(UserId.create(LOWER), UserId.create(HIGHER));

    // Act
    const act = () => pair.other(UserId.create(OUTSIDER));

    // Assert
    expect(act).toThrow(NotAParticipantError);
  });
});

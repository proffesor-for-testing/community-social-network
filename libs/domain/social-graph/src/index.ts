// Value Objects
export { ConnectionId } from './value-objects/connection-id';
export {
  ConnectionStatus,
  ConnectionStatusEnum,
} from './value-objects/connection-status';
export { BlockId } from './value-objects/block-id';

// Aggregates
export { Connection } from './aggregates/connection';
export { Block } from './aggregates/block';

// Events
export { FollowRequestedEvent } from './events/follow-requested.event';
export { FollowApprovedEvent } from './events/follow-approved.event';
export { FollowRejectedEvent } from './events/follow-rejected.event';
export { UnfollowedEvent } from './events/unfollowed.event';
export { MemberBlockedEvent } from './events/member-blocked.event';
export { MemberUnblockedEvent } from './events/member-unblocked.event';

// Repository Interfaces
export { IConnectionRepository } from './repositories/connection.repository';
export { IBlockRepository } from './repositories/block.repository';

// Errors
export { CannotFollowSelfError } from './errors/cannot-follow-self.error';
export { CannotBlockSelfError } from './errors/cannot-block-self.error';
export { InvalidStatusTransitionError } from './errors/invalid-status-transition.error';

// Value Objects
export { GroupId } from './value-objects/group-id';
export { GroupName } from './value-objects/group-name';
export { GroupDescription } from './value-objects/group-description';
export { GroupSettings } from './value-objects/group-settings';
export { GroupRule } from './value-objects/group-rule';
export { GroupStatus } from './value-objects/group-status';
export { MembershipId } from './value-objects/membership-id';
export { MembershipRole, getRoleLevel, isHigherRole, isLowerRole } from './value-objects/membership-role';
export { Permission, isPermissionGrantedTo } from './value-objects/permission';

// Domain Events
export { GroupCreatedEvent } from './events/group-created.event';
export { MemberJoinedGroupEvent } from './events/member-joined-group.event';
export { MemberLeftGroupEvent } from './events/member-left-group.event';
export { MemberPromotedEvent } from './events/member-promoted.event';
export { MemberKickedEvent } from './events/member-kicked.event';
export { GroupSettingsUpdatedEvent } from './events/group-settings-updated.event';
export { OwnershipTransferredEvent } from './events/ownership-transferred.event';

// Aggregates
export { Group } from './aggregates/group';
export { Membership } from './aggregates/membership';

// Repository Interfaces
export { IGroupRepository } from './repositories/group.repository';
export { IMembershipRepository } from './repositories/membership.repository';

// Errors
export { MaxRulesExceededError } from './errors/max-rules-exceeded.error';
export { OnlyOwnerCanTransferError } from './errors/only-owner-can-transfer.error';
export { CannotPromoteToOwnerError } from './errors/cannot-promote-to-owner.error';

// Aggregate
export { Profile } from './aggregates/profile';

// Value Objects
export { ProfileId } from './value-objects/profile-id';
export { DisplayName } from './value-objects/display-name';
export { Bio } from './value-objects/bio';
export { AvatarId } from './value-objects/avatar-id';
export { Location } from './value-objects/location';
export {
  PrivacySettings,
  ProfileVisibility,
} from './value-objects/privacy-settings';

// Domain Events
export { ProfileCreatedEvent } from './events/profile-created.event';
export { ProfileUpdatedEvent } from './events/profile-updated.event';
export { AvatarChangedEvent } from './events/avatar-changed.event';

// Repository Interface
export { IProfileRepository } from './repositories/profile.repository';

// Errors
export { ProfileNotFoundError } from './errors/profile-not-found.error';
export { ProfileAlreadyExistsError } from './errors/profile-already-exists.error';

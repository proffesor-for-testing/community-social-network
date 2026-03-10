// Value Objects
export { AlertId } from './value-objects/alert-id';
export { AlertType } from './value-objects/alert-type';
export { AlertContent } from './value-objects/alert-content';
export { AlertStatus, assertAlertStatusTransition } from './value-objects/alert-status';
export { DeliveryChannel } from './value-objects/delivery-channel';
export { PreferenceId } from './value-objects/preference-id';

// Domain Events
export { AlertCreatedEvent } from './events/alert-created.event';
export { AlertReadEvent } from './events/alert-read.event';
export { PreferencesUpdatedEvent } from './events/preferences-updated.event';

// Aggregates
export { Alert } from './aggregates/alert';
export { Preference } from './aggregates/preference';

// Repository Interfaces
export { IAlertRepository } from './repositories/alert.repository';
export { IPreferenceRepository } from './repositories/preference.repository';

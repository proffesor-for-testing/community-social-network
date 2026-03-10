// Value Objects
export { AdminRole } from './value-objects/admin-role';
export { AuditEntryId } from './value-objects/audit-entry-id';
export { IpAddress } from './value-objects/ip-address';

// Domain Events
export { AuditEntryCreatedEvent } from './events/audit-entry-created.event';
export { SecurityAlertRaisedEvent } from './events/security-alert-raised.event';

// Aggregates
export { AuditEntry } from './aggregates/audit-entry';

// Repository Interfaces
export { IAuditEntryRepository } from './repositories/audit-entry.repository';

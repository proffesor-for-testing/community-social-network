// Value Objects
export { MemberId } from './value-objects/member-id';
export { Credential } from './value-objects/credential';
export { PlainPassword } from './value-objects/plain-password';
export { MemberStatus } from './value-objects/member-status';
export { SessionId } from './value-objects/session-id';

// Aggregates
export { Member } from './aggregates/member';
export { Session } from './aggregates/session';

// Events
export { MemberRegisteredEvent } from './events/member-registered.event';
export { MemberAuthenticationSucceededEvent } from './events/member-authentication-succeeded.event';
export { MemberLockedEvent } from './events/member-locked.event';
export { MemberSuspendedEvent } from './events/member-suspended.event';

// Repository Interfaces
export type { IMemberRepository } from './repositories/member.repository';
export type { ISessionRepository } from './repositories/session.repository';

// Domain Errors
export { MemberNotActiveError } from './errors/member-not-active.error';
export { MemberLockedError } from './errors/member-locked.error';
export { AlreadySuspendedError } from './errors/already-suspended.error';
export { InvalidCredentialsError } from './errors/invalid-credentials.error';

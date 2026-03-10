import {
  AggregateRoot,
  Email,
  Timestamp,
  SECURITY_LIMITS,
  ValidationError,
} from '@csn/domain-shared';
import { MemberId } from '../value-objects/member-id';
import { Credential } from '../value-objects/credential';
import { MemberStatus } from '../value-objects/member-status';
import { MemberRegisteredEvent } from '../events/member-registered.event';
import { MemberAuthenticationSucceededEvent } from '../events/member-authentication-succeeded.event';
import { MemberLockedEvent } from '../events/member-locked.event';
import { MemberSuspendedEvent } from '../events/member-suspended.event';

export class Member extends AggregateRoot<MemberId> {
  private _email: Email;
  private _credential: Credential;
  private _status: MemberStatus;
  private _displayName: string;
  private _failedLoginAttempts: number;
  private _lastLoginAt: Timestamp | null;
  private _createdAt: Timestamp;

  private constructor(
    id: MemberId,
    email: Email,
    credential: Credential,
    status: MemberStatus,
    displayName: string,
    failedLoginAttempts: number,
    lastLoginAt: Timestamp | null,
    createdAt: Timestamp,
  ) {
    super(id);
    this._email = email;
    this._credential = credential;
    this._status = status;
    this._displayName = displayName;
    this._failedLoginAttempts = failedLoginAttempts;
    this._lastLoginAt = lastLoginAt;
    this._createdAt = createdAt;
  }

  public static register(
    id: MemberId,
    email: Email,
    credential: Credential,
    displayName: string,
  ): Member {
    const member = new Member(
      id,
      email,
      credential,
      MemberStatus.pendingVerification(),
      displayName,
      0,
      null,
      Timestamp.now(),
    );

    member.addDomainEvent(
      new MemberRegisteredEvent(id.value, email.value, displayName),
    );
    member.incrementVersion();

    return member;
  }

  /**
   * Reconstitute a Member from persistence without emitting events.
   */
  public static reconstitute(
    id: MemberId,
    email: Email,
    credential: Credential,
    status: MemberStatus,
    displayName: string,
    failedLoginAttempts: number,
    lastLoginAt: Timestamp | null,
    createdAt: Timestamp,
    version: number,
  ): Member {
    const member = new Member(
      id,
      email,
      credential,
      status,
      displayName,
      failedLoginAttempts,
      lastLoginAt,
      createdAt,
    );
    member.setVersion(version);
    return member;
  }

  // --- Getters ---

  public get email(): Email {
    return this._email;
  }

  public get credential(): Credential {
    return this._credential;
  }

  public get status(): MemberStatus {
    return this._status;
  }

  public get displayName(): string {
    return this._displayName;
  }

  public get failedLoginAttempts(): number {
    return this._failedLoginAttempts;
  }

  public get lastLoginAt(): Timestamp | null {
    return this._lastLoginAt;
  }

  public get createdAt(): Timestamp {
    return this._createdAt;
  }

  // --- Behavior ---

  public activate(): void {
    this.assertTransitionAllowed(MemberStatus.active());
    this._status = MemberStatus.active();
    this.incrementVersion();
  }

  public recordSuccessfulLogin(sessionId: string): void {
    this._failedLoginAttempts = 0;
    this._lastLoginAt = Timestamp.now();
    this.addDomainEvent(
      new MemberAuthenticationSucceededEvent(this.id.value, sessionId),
    );
    this.incrementVersion();
  }

  public recordFailedLogin(): void {
    this._failedLoginAttempts++;

    if (this._failedLoginAttempts >= SECURITY_LIMITS.MAX_LOGIN_ATTEMPTS) {
      this.assertTransitionAllowed(MemberStatus.locked());
      this._status = MemberStatus.locked();
      this.addDomainEvent(
        new MemberLockedEvent(
          this.id.value,
          'Too many failed login attempts',
          this._failedLoginAttempts,
        ),
      );
    }

    this.incrementVersion();
  }

  public suspend(reason: string, suspendedBy: string): void {
    this.assertTransitionAllowed(MemberStatus.suspended());
    this._status = MemberStatus.suspended();
    this.addDomainEvent(
      new MemberSuspendedEvent(this.id.value, reason, suspendedBy),
    );
    this.incrementVersion();
  }

  public unlock(): void {
    this.assertTransitionAllowed(MemberStatus.active());
    this._status = MemberStatus.active();
    this._failedLoginAttempts = 0;
    this.incrementVersion();
  }

  public deactivate(): void {
    this.assertTransitionAllowed(MemberStatus.deactivated());
    this._status = MemberStatus.deactivated();
    this.incrementVersion();
  }

  // --- Private helpers ---

  private assertTransitionAllowed(target: MemberStatus): void {
    if (!this._status.canTransitionTo(target)) {
      throw new ValidationError(
        `Cannot transition from '${this._status.value}' to '${target.value}'`,
      );
    }
  }
}

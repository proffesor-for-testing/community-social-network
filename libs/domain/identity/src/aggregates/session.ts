import { AggregateRoot, Timestamp } from '@csn/domain-shared';
import { SessionId } from '../value-objects/session-id';
import { MemberId } from '../value-objects/member-id';

export class Session extends AggregateRoot<SessionId> {
  private _memberId: MemberId;
  private _userAgent: string;
  private _ipAddress: string;
  private _createdAt: Timestamp;
  private _expiresAt: Timestamp;
  private _isRevoked: boolean;

  private constructor(
    id: SessionId,
    memberId: MemberId,
    userAgent: string,
    ipAddress: string,
    createdAt: Timestamp,
    expiresAt: Timestamp,
    isRevoked: boolean,
  ) {
    super(id);
    this._memberId = memberId;
    this._userAgent = userAgent;
    this._ipAddress = ipAddress;
    this._createdAt = createdAt;
    this._expiresAt = expiresAt;
    this._isRevoked = isRevoked;
  }

  public static create(
    id: SessionId,
    memberId: MemberId,
    userAgent: string,
    ipAddress: string,
    expiresAt: Timestamp,
  ): Session {
    const session = new Session(
      id,
      memberId,
      userAgent,
      ipAddress,
      Timestamp.now(),
      expiresAt,
      false,
    );
    session.incrementVersion();
    return session;
  }

  /**
   * Reconstitute a Session from persistence without side effects.
   */
  public static reconstitute(
    id: SessionId,
    memberId: MemberId,
    userAgent: string,
    ipAddress: string,
    createdAt: Timestamp,
    expiresAt: Timestamp,
    isRevoked: boolean,
    version: number,
  ): Session {
    const session = new Session(id, memberId, userAgent, ipAddress, createdAt, expiresAt, isRevoked);
    session.setVersion(version);
    return session;
  }

  // --- Getters ---

  public get memberId(): MemberId {
    return this._memberId;
  }

  public get userAgent(): string {
    return this._userAgent;
  }

  public get ipAddress(): string {
    return this._ipAddress;
  }

  public get createdAt(): Timestamp {
    return this._createdAt;
  }

  public get expiresAt(): Timestamp {
    return this._expiresAt;
  }

  public get isRevoked(): boolean {
    return this._isRevoked;
  }

  // --- Behavior ---

  public revoke(): void {
    this._isRevoked = true;
    this.incrementVersion();
  }

  public isExpired(): boolean {
    return Timestamp.now().isAfter(this._expiresAt);
  }

  public isValid(): boolean {
    return !this._isRevoked && !this.isExpired();
  }
}

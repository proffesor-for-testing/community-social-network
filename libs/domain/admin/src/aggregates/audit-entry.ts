import { AggregateRoot, UserId, Timestamp, DomainError } from '@csn/domain-shared';
import { AuditEntryId } from '../value-objects/audit-entry-id';
import { IpAddress } from '../value-objects/ip-address';
import { AuditEntryCreatedEvent } from '../events/audit-entry-created.event';

export class AuditEntry extends AggregateRoot<AuditEntryId> {
  private readonly _action: string;
  private readonly _performedBy: UserId;
  private readonly _targetId: string;
  private readonly _targetType: string;
  private readonly _details: Readonly<Record<string, unknown>>;
  private readonly _ipAddress: IpAddress;
  private readonly _createdAt: Timestamp;

  private constructor(
    id: AuditEntryId,
    action: string,
    performedBy: UserId,
    targetId: string,
    targetType: string,
    details: Record<string, unknown>,
    ipAddress: IpAddress,
    createdAt: Timestamp,
  ) {
    super(id);
    this._action = action;
    this._performedBy = performedBy;
    this._targetId = targetId;
    this._targetType = targetType;
    this._details = Object.freeze({ ...details });
    this._ipAddress = ipAddress;
    this._createdAt = createdAt;
  }

  public static create(
    id: AuditEntryId,
    action: string,
    performedBy: UserId,
    targetId: string,
    targetType: string,
    details: Record<string, unknown>,
    ipAddress: IpAddress,
  ): AuditEntry {
    if (!action || action.trim().length === 0) {
      throw new DomainError('Audit entry action must not be empty', 'VALIDATION_ERROR');
    }
    if (!targetId || targetId.trim().length === 0) {
      throw new DomainError('Audit entry targetId must not be empty', 'VALIDATION_ERROR');
    }
    if (!targetType || targetType.trim().length === 0) {
      throw new DomainError('Audit entry targetType must not be empty', 'VALIDATION_ERROR');
    }

    const entry = new AuditEntry(
      id,
      action.trim(),
      performedBy,
      targetId.trim(),
      targetType.trim(),
      details,
      ipAddress,
      Timestamp.now(),
    );

    entry.addDomainEvent(
      new AuditEntryCreatedEvent(
        id.value,
        action.trim(),
        performedBy.value,
        targetId.trim(),
      ),
    );
    entry.incrementVersion();

    return entry;
  }

  public get action(): string {
    return this._action;
  }

  public get performedBy(): UserId {
    return this._performedBy;
  }

  public get targetId(): string {
    return this._targetId;
  }

  public get targetType(): string {
    return this._targetType;
  }

  public get details(): Readonly<Record<string, unknown>> {
    return this._details;
  }

  public get ipAddress(): IpAddress {
    return this._ipAddress;
  }

  public get createdAt(): Timestamp {
    return this._createdAt;
  }
}

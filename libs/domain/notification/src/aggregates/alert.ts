import { AggregateRoot, UserId, Timestamp, DomainError } from '@csn/domain-shared';
import { AlertId } from '../value-objects/alert-id';
import { AlertType } from '../value-objects/alert-type';
import { AlertContent } from '../value-objects/alert-content';
import { AlertStatus, assertAlertStatusTransition } from '../value-objects/alert-status';
import { AlertCreatedEvent } from '../events/alert-created.event';
import { AlertReadEvent } from '../events/alert-read.event';

export class Alert extends AggregateRoot<AlertId> {
  private _recipientId: UserId;
  private _type: AlertType;
  private _content: AlertContent;
  private _status: AlertStatus;
  private _sourceId: string;
  private _createdAt: Timestamp;
  private _readAt: Timestamp | null;

  private constructor(
    id: AlertId,
    recipientId: UserId,
    type: AlertType,
    content: AlertContent,
    sourceId: string,
    createdAt: Timestamp,
    status: AlertStatus = AlertStatus.UNREAD,
    readAt: Timestamp | null = null,
  ) {
    super(id);
    this._recipientId = recipientId;
    this._type = type;
    this._content = content;
    this._sourceId = sourceId;
    this._createdAt = createdAt;
    this._status = status;
    this._readAt = readAt;
  }

  public static create(
    id: AlertId,
    recipientId: UserId,
    type: AlertType,
    content: AlertContent,
    sourceId: string,
  ): Alert {
    if (!sourceId || sourceId.trim().length === 0) {
      throw new DomainError('Alert sourceId must not be empty', 'VALIDATION_ERROR');
    }

    const alert = new Alert(
      id,
      recipientId,
      type,
      content,
      sourceId,
      Timestamp.now(),
    );

    alert.addDomainEvent(
      new AlertCreatedEvent(id.value, recipientId.value, type),
    );
    alert.incrementVersion();

    return alert;
  }

  /**
   * Reconstitute an Alert from persistence without emitting events.
   */
  public static reconstitute(
    id: AlertId,
    recipientId: UserId,
    type: AlertType,
    content: AlertContent,
    sourceId: string,
    createdAt: Timestamp,
    status: AlertStatus,
    readAt: Timestamp | null,
    version: number,
  ): Alert {
    const alert = new Alert(id, recipientId, type, content, sourceId, createdAt, status, readAt);
    alert.setVersion(version);
    return alert;
  }

  public markAsRead(): void {
    assertAlertStatusTransition(this._status, AlertStatus.READ);
    this._status = AlertStatus.READ;
    this._readAt = Timestamp.now();

    this.addDomainEvent(new AlertReadEvent(this.id.value, this.version + 1));
    this.incrementVersion();
  }

  public dismiss(): void {
    assertAlertStatusTransition(this._status, AlertStatus.DISMISSED);
    this._status = AlertStatus.DISMISSED;
    this.incrementVersion();
  }

  public isUnread(): boolean {
    return this._status === AlertStatus.UNREAD;
  }

  public get recipientId(): UserId {
    return this._recipientId;
  }

  public get type(): AlertType {
    return this._type;
  }

  public get content(): AlertContent {
    return this._content;
  }

  public get status(): AlertStatus {
    return this._status;
  }

  public get sourceId(): string {
    return this._sourceId;
  }

  public get createdAt(): Timestamp {
    return this._createdAt;
  }

  public get readAt(): Timestamp | null {
    return this._readAt;
  }
}

import { DomainError } from '@csn/domain-shared';

export enum ConnectionStatusEnum {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

const VALID_TRANSITIONS: Record<ConnectionStatusEnum, ConnectionStatusEnum[]> = {
  [ConnectionStatusEnum.PENDING]: [ConnectionStatusEnum.ACCEPTED, ConnectionStatusEnum.REJECTED],
  [ConnectionStatusEnum.ACCEPTED]: [],
  [ConnectionStatusEnum.REJECTED]: [],
};

export class ConnectionStatus {
  private constructor(private readonly _value: ConnectionStatusEnum) {}

  public static create(value: ConnectionStatusEnum): ConnectionStatus {
    return new ConnectionStatus(value);
  }

  public static pending(): ConnectionStatus {
    return new ConnectionStatus(ConnectionStatusEnum.PENDING);
  }

  public static accepted(): ConnectionStatus {
    return new ConnectionStatus(ConnectionStatusEnum.ACCEPTED);
  }

  public static rejected(): ConnectionStatus {
    return new ConnectionStatus(ConnectionStatusEnum.REJECTED);
  }

  public get value(): ConnectionStatusEnum {
    return this._value;
  }

  public canTransitionTo(target: ConnectionStatusEnum): boolean {
    return VALID_TRANSITIONS[this._value].includes(target);
  }

  public transitionTo(target: ConnectionStatusEnum): ConnectionStatus {
    if (!this.canTransitionTo(target)) {
      throw new InvalidStatusTransitionError(this._value, target);
    }
    return new ConnectionStatus(target);
  }

  public equals(other: ConnectionStatus): boolean {
    if (!other) {
      return false;
    }
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}

export class InvalidStatusTransitionError extends DomainError {
  constructor(from: ConnectionStatusEnum, to: ConnectionStatusEnum) {
    super(
      `Invalid status transition from ${from} to ${to}`,
      'INVALID_STATUS_TRANSITION',
    );
    this.name = 'InvalidStatusTransitionError';
  }
}

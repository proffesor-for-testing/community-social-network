import { ValueObject } from '../value-object';
import { ValidationError } from '../errors/domain-error';

interface TimestampProps {
  value: Date;
}

export class Timestamp extends ValueObject<TimestampProps> {
  private constructor(props: TimestampProps) {
    super(props);
  }

  public static now(): Timestamp {
    return new Timestamp({ value: new Date() });
  }

  public static fromDate(date: Date): Timestamp {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new ValidationError('Invalid date provided');
    }
    return new Timestamp({ value: new Date(date.getTime()) });
  }

  public static fromISO(iso: string): Timestamp {
    const date = new Date(iso);
    if (isNaN(date.getTime())) {
      throw new ValidationError('Invalid ISO date string');
    }
    return new Timestamp({ value: date });
  }

  public get value(): Date {
    return new Date(this.props.value.getTime());
  }

  public isBefore(other: Timestamp): boolean {
    return this.props.value.getTime() < other.props.value.getTime();
  }

  public isAfter(other: Timestamp): boolean {
    return this.props.value.getTime() > other.props.value.getTime();
  }

  public toISO(): string {
    return this.props.value.toISOString();
  }
}

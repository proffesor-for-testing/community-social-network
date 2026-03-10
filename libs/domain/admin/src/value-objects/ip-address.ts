import { ValueObject, ValidationError } from '@csn/domain-shared';

interface IpAddressProps {
  value: string;
}

const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

const IPV6_REGEX =
  /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|::(?:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){0,6})?|:(?::[0-9a-fA-F]{1,4}){1,7}|::(?:[fF]{4}:)?(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))$/;

export class IpAddress extends ValueObject<IpAddressProps> {
  private constructor(props: IpAddressProps) {
    super(props);
  }

  public static create(value: string): IpAddress {
    if (!value || value.trim().length === 0) {
      throw new ValidationError('IP address must not be empty');
    }

    const trimmed = value.trim();

    if (!IPV4_REGEX.test(trimmed) && !IPV6_REGEX.test(trimmed)) {
      throw new ValidationError(`Invalid IP address format: ${trimmed}`);
    }

    return new IpAddress({ value: trimmed });
  }

  public get value(): string {
    return this.props.value;
  }

  public isIPv4(): boolean {
    return IPV4_REGEX.test(this.props.value);
  }

  public isIPv6(): boolean {
    return IPV6_REGEX.test(this.props.value);
  }

  public toString(): string {
    return this.props.value;
  }
}

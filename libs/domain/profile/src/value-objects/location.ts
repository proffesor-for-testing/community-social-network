import { ValueObject } from '@csn/domain-shared';

interface LocationProps {
  city?: string;
  country?: string;
}

export class Location extends ValueObject<LocationProps> {
  private constructor(props: LocationProps) {
    super(props);
  }

  public static create(props: { city?: string; country?: string }): Location {
    return new Location({
      city: props.city?.trim() || undefined,
      country: props.country?.trim() || undefined,
    });
  }

  public static empty(): Location {
    return new Location({});
  }

  public get city(): string | undefined {
    return this.props.city;
  }

  public get country(): string | undefined {
    return this.props.country;
  }

  public get isEmpty(): boolean {
    return !this.props.city && !this.props.country;
  }

  public toString(): string {
    const parts: string[] = [];
    if (this.props.city) parts.push(this.props.city);
    if (this.props.country) parts.push(this.props.country);
    return parts.join(', ');
  }
}

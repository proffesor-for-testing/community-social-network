export abstract class ValueObject<T extends object> {
  public readonly props: Readonly<T>;

  protected constructor(props: T) {
    this.props = Object.freeze({ ...props });
  }

  public equals(other: ValueObject<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    return this.deepEquals(this.props, other.props);
  }

  private deepEquals(a: unknown, b: unknown): boolean {
    if (a === b) {
      return true;
    }
    if (a === null || b === null || a === undefined || b === undefined) {
      return false;
    }
    if (typeof a !== typeof b) {
      return false;
    }
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);
      if (aKeys.length !== bKeys.length) {
        return false;
      }
      return aKeys.every((key) => this.deepEquals(aObj[key], bObj[key]));
    }
    return false;
  }

  protected static validate(
    condition: boolean,
    message: string,
  ): void {
    if (!condition) {
      throw new Error(message);
    }
  }
}

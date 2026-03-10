export abstract class Entity<T> {
  public readonly id: T;

  protected constructor(id: T) {
    this.id = id;
  }

  public equals(other: Entity<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    // Support value object IDs that have an `equals()` method
    if (
      this.id !== null &&
      typeof this.id === 'object' &&
      'equals' in this.id &&
      typeof (this.id as { equals: unknown }).equals === 'function'
    ) {
      return (this.id as { equals(other: unknown): boolean }).equals(other.id);
    }
    return this.id === other.id;
  }
}

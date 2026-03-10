export class OptimisticLockError extends Error {
  constructor(entityName: string, entityId: string) {
    super(
      `Optimistic lock conflict on ${entityName} with id ${entityId}. ` +
        'The entity was modified by another transaction.',
    );
    this.name = 'OptimisticLockError';
  }
}

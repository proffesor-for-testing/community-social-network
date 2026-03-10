/**
 * Interface for bidirectional mapping between domain aggregates and persistence entities.
 * Follows ADR-010 Aggregate Mapper pattern.
 */
export interface AggregateMapper<TDomain, TPersistence> {
  toDomain(raw: TPersistence): TDomain;
  toPersistence(domain: TDomain): TPersistence;
}

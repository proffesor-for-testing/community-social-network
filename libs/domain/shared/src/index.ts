// Base building blocks
export { DomainEvent, EventMetadata } from './domain-event';
export { Entity } from './entity';
export { AggregateRoot } from './aggregate-root';
export { ValueObject } from './value-object';
export { IRepository } from './repository.interface';

// Value objects
export { UserId } from './value-objects/user-id';
export { Email } from './value-objects/email';
export { Timestamp } from './value-objects/timestamp';

// Types
export {
  PaginatedResult,
  PaginationParams,
  DEFAULT_PAGINATION,
} from './types/pagination';

// Constants
export {
  CONTENT_LIMITS,
  SOCIAL_LIMITS,
  MEDIA_LIMITS,
  SECURITY_LIMITS,
  PAGINATION,
  CACHE_TTL,
  AUTH,
} from './constants/domain-constants';

// Errors
export {
  DomainError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from './errors/domain-error';

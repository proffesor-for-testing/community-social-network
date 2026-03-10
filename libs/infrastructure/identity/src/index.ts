// Entities
export { MemberEntity } from './entities/member.entity';
export { SessionEntity } from './entities/session.entity';

// Mappers
export { MemberMapper } from './mappers/member.mapper';
export { SessionMapper } from './mappers/session.mapper';

// Repositories - PostgreSQL
export { PostgresMemberRepository } from './repositories/postgres-member.repository';
export { PostgresSessionRepository } from './repositories/postgres-session.repository';

// Repositories - In-Memory (testing)
export { InMemoryMemberRepository } from './repositories/in-memory-member.repository';
export { InMemorySessionRepository } from './repositories/in-memory-session.repository';

// Module
export {
  IdentityInfrastructureModule,
  MEMBER_REPOSITORY_TOKEN,
  SESSION_REPOSITORY_TOKEN,
} from './identity.infrastructure.module';

// Migrations
export { CreateIdentityTables1710000000000 } from './migrations/1710000000000-create-identity-tables';

// Entities
export { GroupEntity } from './entities/group.entity';
export { MembershipEntity } from './entities/membership.entity';

// Mappers
export { GroupMapper } from './mappers/group.mapper';
export { MembershipMapper } from './mappers/membership.mapper';

// Repositories - Postgres
export { PostgresGroupRepository } from './repositories/postgres-group.repository';
export { PostgresMembershipRepository } from './repositories/postgres-membership.repository';

// Repositories - In-Memory (testing)
export { InMemoryGroupRepository } from './repositories/in-memory-group.repository';
export { InMemoryMembershipRepository } from './repositories/in-memory-membership.repository';

// Module
export {
  CommunityInfrastructureModule,
  GROUP_REPOSITORY,
  MEMBERSHIP_REPOSITORY,
} from './community.infrastructure.module';

// Migrations
export { CreateCommunityTables1710000004000 } from './migrations/1710000004000-create-community-tables';

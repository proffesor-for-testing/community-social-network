import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEntity } from './entities/group.entity';
import { MembershipEntity } from './entities/membership.entity';
import { PostgresGroupRepository } from './repositories/postgres-group.repository';
import { PostgresMembershipRepository } from './repositories/postgres-membership.repository';
import { DataSource } from 'typeorm';

export const GROUP_REPOSITORY = 'IGroupRepository';
export const MEMBERSHIP_REPOSITORY = 'IMembershipRepository';

@Module({
  imports: [TypeOrmModule.forFeature([GroupEntity, MembershipEntity])],
  providers: [
    {
      provide: GROUP_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        const ormRepo = dataSource.getRepository(GroupEntity);
        return new PostgresGroupRepository(ormRepo);
      },
      inject: [DataSource],
    },
    {
      provide: MEMBERSHIP_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        const ormRepo = dataSource.getRepository(MembershipEntity);
        return new PostgresMembershipRepository(ormRepo);
      },
      inject: [DataSource],
    },
  ],
  exports: [GROUP_REPOSITORY, MEMBERSHIP_REPOSITORY],
})
export class CommunityInfrastructureModule {}

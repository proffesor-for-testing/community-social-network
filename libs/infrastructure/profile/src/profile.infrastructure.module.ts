import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileEntity } from './entities/profile.entity';
import { PostgresProfileRepository } from './repositories/postgres-profile.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ProfileEntity])],
  providers: [
    {
      provide: 'IProfileRepository',
      useFactory: (repo: Repository<ProfileEntity>) =>
        new PostgresProfileRepository(repo),
      inject: [getRepositoryToken(ProfileEntity)],
    },
  ],
  exports: ['IProfileRepository'],
})
export class ProfileInfrastructureModule {}

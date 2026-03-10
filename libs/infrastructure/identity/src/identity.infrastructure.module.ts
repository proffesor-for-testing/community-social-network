import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberEntity } from './entities/member.entity';
import { SessionEntity } from './entities/session.entity';
import { PostgresMemberRepository } from './repositories/postgres-member.repository';
import { PostgresSessionRepository } from './repositories/postgres-session.repository';

export const MEMBER_REPOSITORY_TOKEN = 'IMemberRepository';
export const SESSION_REPOSITORY_TOKEN = 'ISessionRepository';

@Module({
  imports: [TypeOrmModule.forFeature([MemberEntity, SessionEntity])],
  providers: [
    {
      provide: MEMBER_REPOSITORY_TOKEN,
      useFactory: (repo: Repository<MemberEntity>) =>
        new PostgresMemberRepository(repo),
      inject: [getRepositoryToken(MemberEntity)],
    },
    {
      provide: SESSION_REPOSITORY_TOKEN,
      useFactory: (repo: Repository<SessionEntity>) =>
        new PostgresSessionRepository(repo),
      inject: [getRepositoryToken(SessionEntity)],
    },
  ],
  exports: [MEMBER_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN],
})
export class IdentityInfrastructureModule {}

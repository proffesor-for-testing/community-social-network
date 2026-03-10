import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEntryEntity } from './entities/audit-entry.entity';
import { PostgresAuditEntryRepository } from './repositories/postgres-audit-entry.repository';

export const AUDIT_ENTRY_REPOSITORY = 'IAuditEntryRepository';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEntryEntity])],
  providers: [
    {
      provide: AUDIT_ENTRY_REPOSITORY,
      useFactory: (repo: Repository<AuditEntryEntity>) =>
        new PostgresAuditEntryRepository(repo),
      inject: [getRepositoryToken(AuditEntryEntity)],
    },
  ],
  exports: [AUDIT_ENTRY_REPOSITORY],
})
export class AdminInfrastructureModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertEntity } from './entities/alert.entity';
import { PreferenceEntity } from './entities/preference.entity';
import { PostgresAlertRepository } from './repositories/postgres-alert.repository';
import { PostgresPreferenceRepository } from './repositories/postgres-preference.repository';

export const ALERT_REPOSITORY_TOKEN = 'IAlertRepository';
export const PREFERENCE_REPOSITORY_TOKEN = 'IPreferenceRepository';

@Module({
  imports: [TypeOrmModule.forFeature([AlertEntity, PreferenceEntity])],
  providers: [
    {
      provide: ALERT_REPOSITORY_TOKEN,
      useFactory: (repo: Repository<AlertEntity>) =>
        new PostgresAlertRepository(repo),
      inject: [getRepositoryToken(AlertEntity)],
    },
    {
      provide: PREFERENCE_REPOSITORY_TOKEN,
      useFactory: (repo: Repository<PreferenceEntity>) =>
        new PostgresPreferenceRepository(repo),
      inject: [getRepositoryToken(PreferenceEntity)],
    },
  ],
  exports: [ALERT_REPOSITORY_TOKEN, PREFERENCE_REPOSITORY_TOKEN],
})
export class NotificationInfrastructureModule {}

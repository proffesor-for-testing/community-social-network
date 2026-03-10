// Entities
export { AlertEntity } from './entities/alert.entity';
export { PreferenceEntity } from './entities/preference.entity';

// Mappers
export { AlertMapper } from './mappers/alert.mapper';
export { PreferenceMapper } from './mappers/preference.mapper';

// Repositories - Postgres
export { PostgresAlertRepository } from './repositories/postgres-alert.repository';
export { PostgresPreferenceRepository } from './repositories/postgres-preference.repository';

// Repositories - In-Memory (testing)
export { InMemoryAlertRepository } from './repositories/in-memory-alert.repository';
export { InMemoryPreferenceRepository } from './repositories/in-memory-preference.repository';

// Module
export {
  NotificationInfrastructureModule,
  ALERT_REPOSITORY_TOKEN,
  PREFERENCE_REPOSITORY_TOKEN,
} from './notification.infrastructure.module';

// Migrations
export { CreateNotificationTables1710000005000 } from './migrations/1710000005000-create-notification-tables';

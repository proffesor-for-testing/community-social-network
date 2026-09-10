/**
 * Shared Postgres DataSource + helpers for the persistence test suite.
 *
 * Each spec file imports `getDataSource()` (and typically calls it once in a
 * `beforeAll`) to get a connected TypeORM DataSource for the `csn_test`
 * database, whose schema was created by tests/persistence/setup/global-setup.ts.
 *
 * Guard every describe block with `describe.skipIf(!RUN_DB_TESTS)` so the
 * suite reports as (skipped, not failed) when RUN_DB_TESTS is unset.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_PERSISTENCE_ENTITIES, dbConnectionOptions } from './entities';
import { MemberEntity, PostgresMemberRepository } from '@csn/infra-identity';
import { ProfileEntity, PostgresProfileRepository } from '@csn/infra-profile';
import {
  PublicationEntity,
  MentionEntity,
  ReactionEntity,
  DiscussionEntity,
  PostgresPublicationRepository,
  PostgresDiscussionRepository,
} from '@csn/infra-content';
import {
  ConnectionEntity,
  PostgresConnectionRepository,
} from '@csn/infra-social-graph';
import {
  GroupEntity,
  MembershipEntity,
  PostgresGroupRepository,
  PostgresMembershipRepository,
} from '@csn/infra-community';
import { AlertEntity, PostgresAlertRepository } from '@csn/infra-notification';

// Re-export the domain aggregate factories shared with the in-memory
// integration suite (tests/setup/test-helpers.ts) so persistence specs build
// real domain aggregates the same way the rest of the test suite does.
export * from '../../setup/test-helpers';

export const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === '1';

let dataSourcePromise: Promise<DataSource> | null = null;

/**
 * Returns a connected, process-wide singleton DataSource for the test database.
 * Safe to call from multiple spec files/beforeAll hooks -- the connection is
 * only opened once per process.
 */
export async function getDataSource(): Promise<DataSource> {
  if (!dataSourcePromise) {
    const { host, port, username, password, database } = dbConnectionOptions();
    const dataSource = new DataSource({
      type: 'postgres',
      host,
      port,
      username,
      password,
      database,
      entities: ALL_PERSISTENCE_ENTITIES,
      // Schema is already created by global-setup.ts; do not re-synchronize
      // here so specs never race each other on DDL.
      synchronize: false,
      dropSchema: false,
      logging: false,
    });
    dataSourcePromise = dataSource.initialize();
  }
  return dataSourcePromise;
}

/**
 * Deletes all rows from every mapped table, in FK-safe order (children first).
 * Call between tests (afterEach) so each test starts from an empty database.
 */
export async function truncateAll(): Promise<void> {
  const dataSource = await getDataSource();
  const tableNames = [
    'publication_mentions',
    'publication_reactions',
    'discussions',
    'publications',
    'memberships',
    'groups',
    'connections',
    'blocks',
    'notification_preferences',
    'alerts',
    'audit_entries',
    'profiles',
    'sessions',
    'members',
  ];
  await dataSource.query(
    `TRUNCATE TABLE ${tableNames.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

/**
 * Closes the shared DataSource. Intended for use in a global afterAll if a
 * spec file needs a clean process exit; not required for a normal vitest run.
 */
export async function closeDataSource(): Promise<void> {
  if (dataSourcePromise) {
    const dataSource = await dataSourcePromise;
    await dataSource.destroy();
    dataSourcePromise = null;
  }
}

// ── Repository factories ────────────────────────────────────────────────────
// Thin builders around the real Postgres repositories under test, wired to
// the shared DataSource's TypeORM repositories -- exactly how the NestJS
// providers wire them in libs/infrastructure/*/src/*.infrastructure.module.ts.

export async function getMemberRepository(): Promise<PostgresMemberRepository> {
  const dataSource = await getDataSource();
  return new PostgresMemberRepository(dataSource.getRepository(MemberEntity));
}

export async function getProfileRepository(): Promise<PostgresProfileRepository> {
  const dataSource = await getDataSource();
  return new PostgresProfileRepository(dataSource.getRepository(ProfileEntity));
}

export async function getPublicationRepository(): Promise<PostgresPublicationRepository> {
  const dataSource = await getDataSource();
  return new PostgresPublicationRepository(
    dataSource.getRepository(PublicationEntity),
    dataSource.getRepository(MentionEntity),
    dataSource.getRepository(ReactionEntity),
  );
}

export async function getReactionRepository() {
  const dataSource = await getDataSource();
  return dataSource.getRepository(ReactionEntity);
}

export async function getDiscussionRepository(): Promise<PostgresDiscussionRepository> {
  const dataSource = await getDataSource();
  return new PostgresDiscussionRepository(dataSource.getRepository(DiscussionEntity));
}

export async function getConnectionRepository(): Promise<PostgresConnectionRepository> {
  const dataSource = await getDataSource();
  return new PostgresConnectionRepository(dataSource.getRepository(ConnectionEntity));
}

export async function getGroupRepository(): Promise<PostgresGroupRepository> {
  const dataSource = await getDataSource();
  return new PostgresGroupRepository(dataSource.getRepository(GroupEntity));
}

export async function getMembershipRepository(): Promise<PostgresMembershipRepository> {
  const dataSource = await getDataSource();
  return new PostgresMembershipRepository(dataSource.getRepository(MembershipEntity));
}

export async function getAlertRepository(): Promise<PostgresAlertRepository> {
  const dataSource = await getDataSource();
  return new PostgresAlertRepository(dataSource.getRepository(AlertEntity));
}

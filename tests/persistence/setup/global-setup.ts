/**
 * Vitest globalSetup for the Postgres persistence suite (vitest.persistence.config.ts).
 *
 * Responsibilities:
 *  1. Skip the whole run with a clear message unless RUN_DB_TESTS=1 is set.
 *  2. Ensure the `csn_test` database exists (creating it via the `postgres`
 *     maintenance database if necessary).
 *  3. Build the schema from the real entity metadata (synchronize + dropSchema)
 *     so every run starts from a clean slate that matches the current entities.
 *
 * This runs once, in its own module context, before any spec file. It does NOT
 * share a DataSource instance with the spec files -- see tests/persistence/setup/db.ts
 * for the DataSource each spec file connects through.
 */
import 'reflect-metadata';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { ALL_PERSISTENCE_ENTITIES, dbConnectionOptions } from './entities';

export default async function globalSetup(): Promise<void> {
  if (process.env['RUN_DB_TESTS'] !== '1') {
    // eslint-disable-next-line no-console
    console.log(
      '\n[tests/persistence] Skipping Postgres persistence suite: set RUN_DB_TESTS=1 to run it ' +
        '(requires a reachable Postgres instance -- see vitest.persistence.config.ts).\n',
    );
    return;
  }

  const { host, port, username, password, database } = dbConnectionOptions();

  await ensureDatabaseExists({ host, port, username, password, database });

  // Build the schema from current entity metadata. dropSchema + synchronize gives
  // every run a clean, up-to-date schema regardless of migration drift.
  const schemaDataSource = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    entities: ALL_PERSISTENCE_ENTITIES,
    synchronize: true,
    dropSchema: true,
    logging: false,
  });

  await schemaDataSource.initialize();
  await schemaDataSource.destroy();

  // eslint-disable-next-line no-console
  console.log(`\n[tests/persistence] Schema ready on database "${database}".\n`);
}

async function ensureDatabaseExists(opts: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}): Promise<void> {
  const client = new Client({
    host: opts.host,
    port: opts.port,
    user: opts.username,
    password: opts.password,
    database: 'postgres', // maintenance database, always present
  });

  await client.connect();
  try {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      opts.database,
    ]);
    if (result.rowCount === 0) {
      // Database names cannot be parameterized; opts.database is sourced from
      // trusted env vars / defaults, never user input.
      await client.query(`CREATE DATABASE "${opts.database}"`);
      // eslint-disable-next-line no-console
      console.log(`[tests/persistence] Created database "${opts.database}".`);
    }
  } finally {
    await client.end();
  }
}

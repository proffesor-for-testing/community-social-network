import { DataSource } from 'typeorm';
import * as path from 'path';

/**
 * Standalone TypeORM DataSource for CLI migrations.
 *
 * Usage:
 *   npx typeorm migration:generate -d libs/infrastructure/database/src/typeorm.config.ts
 *   npx typeorm migration:run -d libs/infrastructure/database/src/typeorm.config.ts
 */
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '5432', 10),
  username: process.env['DB_USERNAME'] || 'postgres',
  password: process.env['DB_PASSWORD'] || 'postgres',
  database: process.env['DB_DATABASE'] || 'csn_dev',
  synchronize: false,
  logging: process.env['NODE_ENV'] === 'development',
  entities: [
    path.join(
      __dirname,
      '..',
      '..',
      '*',
      'src',
      'entities',
      '*.entity.{ts,js}',
    ),
  ],
  migrations: [
    path.join(
      __dirname,
      '..',
      '..',
      '*',
      'src',
      'migrations',
      '*.{ts,js}',
    ),
  ],
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
});

export default dataSource;

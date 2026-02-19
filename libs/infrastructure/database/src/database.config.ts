import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';

export const DATABASE_CONFIG_KEY = 'database';

export const databaseConfig = registerAs(
  DATABASE_CONFIG_KEY,
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    username: process.env['DB_USERNAME'] || 'postgres',
    password: process.env['DB_PASSWORD'] || 'postgres',
    database: process.env['DB_DATABASE'] || 'csn_dev',
    synchronize: process.env['NODE_ENV'] === 'development',
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
  }),
);

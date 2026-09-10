/**
 * Single source of truth for the entity list used by the persistence suite's
 * DataSource, mirroring how libs/infrastructure/database/src/database.config.ts
 * registers entities for the real app (there it's a glob over entities.{ts,js}
 * files under each lib's src/entities directory); here we import the classes
 * directly so the vitest/esbuild-based test runner
 * resolves them the same way it resolves everything else under test).
 */
import { MemberEntity, SessionEntity } from '@csn/infra-identity';
import { ProfileEntity } from '@csn/infra-profile';
import {
  PublicationEntity,
  MentionEntity,
  ReactionEntity,
  DiscussionEntity,
} from '@csn/infra-content';
import { ConnectionEntity, BlockEntity } from '@csn/infra-social-graph';
import { GroupEntity, MembershipEntity } from '@csn/infra-community';
import { AlertEntity, PreferenceEntity } from '@csn/infra-notification';
import { AuditEntryEntity } from '@csn/infra-admin';

export const ALL_PERSISTENCE_ENTITIES = [
  MemberEntity,
  SessionEntity,
  ProfileEntity,
  PublicationEntity,
  MentionEntity,
  ReactionEntity,
  DiscussionEntity,
  ConnectionEntity,
  BlockEntity,
  GroupEntity,
  MembershipEntity,
  AlertEntity,
  PreferenceEntity,
  AuditEntryEntity,
];

export interface DbConnectionOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export function dbConnectionOptions(): DbConnectionOptions {
  return {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    username: process.env['DB_USERNAME'] || 'postgres',
    password: process.env['DB_PASSWORD'] || 'postgres',
    database: process.env['DB_DATABASE'] || 'csn_test',
  };
}

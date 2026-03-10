import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  VersionColumn,
} from 'typeorm';

@Entity('audit_entries')
@Index('IDX_audit_entries_actor_id', ['actorId'])
@Index('IDX_audit_entries_resource', ['resource', 'resourceId'])
export class AuditEntryEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId!: string;

  @Column({ type: 'varchar', length: 255 })
  action!: string;

  @Column({ type: 'varchar', length: 255 })
  resource!: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 255 })
  resourceId!: string;

  @Column({ type: 'jsonb', default: '{}' })
  details!: Record<string, unknown>;

  @Column({ name: 'ip_address', type: 'varchar', length: 45 })
  ipAddress!: string;

  @Column({ type: 'timestamp' })
  timestamp!: Date;

  @VersionColumn()
  version!: number;
}

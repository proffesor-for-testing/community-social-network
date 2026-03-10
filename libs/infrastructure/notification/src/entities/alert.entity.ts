import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  VersionColumn,
} from 'typeorm';

@Entity('alerts')
@Index('IDX_alerts_recipient_status', ['recipientId', 'status'])
export class AlertEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'action_url', type: 'varchar', length: 2048, nullable: true })
  actionUrl!: string | null;

  @Column({ type: 'varchar', length: 50, default: "'UNREAD'" })
  status!: string;

  @Column({ name: 'reference_id', type: 'varchar', length: 255, nullable: true })
  referenceId!: string | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt!: Date | null;

  @Column({ name: 'dismissed_at', type: 'timestamp', nullable: true })
  dismissedAt!: Date | null;

  @VersionColumn()
  version!: number;
}

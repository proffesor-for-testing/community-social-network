import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'member_id', type: 'uuid' })
  memberId!: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 512 })
  userAgent!: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45 })
  ipAddress!: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @VersionColumn()
  version!: number;
}

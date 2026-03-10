import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  VersionColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('blocks')
@Unique('UQ_blocks_blocker_blocked', ['blockerId', 'blockedId'])
export class BlockEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'blocker_id' })
  blockerId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'blocked_id' })
  blockedId!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason!: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @VersionColumn()
  version!: number;
}

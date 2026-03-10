import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('connections')
@Unique('UQ_connections_follower_followee', ['followerId', 'followeeId'])
export class ConnectionEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'follower_id' })
  followerId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'followee_id' })
  followeeId!: string;

  @Column({ type: 'varchar', length: 50 })
  status!: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn()
  version!: number;
}

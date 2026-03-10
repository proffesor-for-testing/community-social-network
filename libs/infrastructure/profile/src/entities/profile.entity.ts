import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

@Entity('profiles')
export class ProfileEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'member_id' })
  memberId!: string;

  @Column({ type: 'varchar', name: 'display_name' })
  displayName!: string;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'uuid', name: 'avatar_id', nullable: true })
  avatarId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  location!: string | null;

  @Column({ type: 'varchar', default: 'public' })
  visibility!: string;

  @Column({ type: 'boolean', name: 'show_email', default: false })
  showEmail!: boolean;

  @Column({ type: 'boolean', name: 'show_location', default: true })
  showLocation!: boolean;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn()
  version!: number;
}

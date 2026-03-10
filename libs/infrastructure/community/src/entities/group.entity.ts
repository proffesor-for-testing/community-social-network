import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

@Entity('groups')
export class GroupEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ name: 'is_public', type: 'boolean', default: true })
  isPublic!: boolean;

  @Column({ name: 'require_approval', type: 'boolean', default: false })
  requireApproval!: boolean;

  @Column({ name: 'allow_member_posts', type: 'boolean', default: true })
  allowMemberPosts!: boolean;

  @Column({ type: 'jsonb', default: '[]' })
  rules!: Array<{ title: string; description: string }>;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'member_count', type: 'int', default: 0 })
  memberCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @VersionColumn()
  version!: number;
}

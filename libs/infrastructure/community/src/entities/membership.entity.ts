import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  VersionColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('memberships')
@Unique('UQ_memberships_group_member', ['groupId', 'memberId'])
export class MembershipEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Index()
  @Column({ name: 'member_id', type: 'uuid' })
  memberId!: string;

  @Column({ type: 'varchar', length: 50 })
  role!: string;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamp' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamp', nullable: true })
  leftAt!: Date | null;

  @Column({ name: 'kicked_at', type: 'timestamp', nullable: true })
  kickedAt!: Date | null;

  @Column({ name: 'kicked_by', type: 'uuid', nullable: true })
  kickedBy!: string | null;

  @VersionColumn()
  version!: number;
}

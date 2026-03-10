import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

@Entity('members')
export class MemberEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 50 })
  status!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName!: string;

  @Column({
    name: 'failed_login_attempts',
    type: 'int',
    default: 0,
  })
  failedLoginAttempts!: number;

  @Column({
    name: 'last_login_at',
    type: 'timestamp',
    nullable: true,
  })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @VersionColumn()
  version!: number;
}

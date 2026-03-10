import {
  Entity,
  PrimaryColumn,
  Column,
  VersionColumn,
} from 'typeorm';

@Entity('notification_preferences')
export class PreferenceEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'member_id', type: 'uuid', unique: true })
  memberId!: string;

  @Column({
    name: 'channel_preferences',
    type: 'jsonb',
    default: "'{}'" ,
  })
  channelPreferences!: Record<string, string[]>;

  @Column({ name: 'muted_until', type: 'timestamp', nullable: true })
  mutedUntil!: Date | null;

  @VersionColumn()
  version!: number;
}

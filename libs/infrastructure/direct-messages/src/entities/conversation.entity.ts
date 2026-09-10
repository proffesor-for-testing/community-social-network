import { Entity, PrimaryColumn, Column, Index, Unique, VersionColumn } from 'typeorm';

/**
 * A 1:1 conversation. participant_a / participant_b are stored in canonical
 * (ascending) order, so the unique constraint below is what guarantees a
 * single conversation per pair no matter who started it.
 */
@Entity('conversations')
@Unique('UQ_conversations_participants', ['participantA', 'participantB'])
@Index('IDX_conversations_participant_a', ['participantA'])
@Index('IDX_conversations_participant_b', ['participantB'])
export class ConversationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'participant_a', type: 'uuid' })
  participantA!: string;

  @Column({ name: 'participant_b', type: 'uuid' })
  participantB!: string;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @VersionColumn()
  version!: number;
}

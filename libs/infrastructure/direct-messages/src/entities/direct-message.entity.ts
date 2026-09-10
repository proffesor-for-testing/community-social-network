import { Entity, PrimaryColumn, Column, Index, VersionColumn } from 'typeorm';

@Entity('direct_messages')
@Index('IDX_direct_messages_conversation_created', ['conversationId', 'createdAt'])
@Index('IDX_direct_messages_unread', ['conversationId', 'senderId', 'readAt'])
export class DirectMessageEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt!: Date | null;

  @VersionColumn()
  version!: number;
}

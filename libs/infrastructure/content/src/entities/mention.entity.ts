import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PublicationEntity } from './publication.entity';

@Entity('publication_mentions')
export class MentionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'publication_id' })
  publicationId!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column('int')
  position!: number;

  @ManyToOne(() => PublicationEntity, (pub) => pub.mentions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'publication_id' })
  publication!: PublicationEntity;
}

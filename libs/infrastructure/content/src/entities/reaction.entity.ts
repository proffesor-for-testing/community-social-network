import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { PublicationEntity } from './publication.entity';

@Entity('publication_reactions')
@Unique('UQ_publication_reactions_pub_user', ['publicationId', 'userId'])
export class ReactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'publication_id' })
  publicationId!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column('varchar', { length: 32 })
  type!: string;

  @ManyToOne(() => PublicationEntity, (pub) => pub.reactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'publication_id' })
  publication!: PublicationEntity;
}

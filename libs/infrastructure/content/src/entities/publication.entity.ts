import {
  Entity,
  Column,
  PrimaryColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { MentionEntity } from './mention.entity';
import { ReactionEntity } from './reaction.entity';

@Entity('publications')
export class PublicationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'author_id' })
  authorId!: string;

  @Column('text')
  content!: string;

  @Column('varchar', { length: 32 })
  status!: string;

  @Column('varchar', { length: 32 })
  visibility!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @VersionColumn()
  version!: number;

  @OneToMany(() => MentionEntity, (mention) => mention.publication, {
    cascade: true,
    eager: false,
  })
  mentions!: MentionEntity[];

  @OneToMany(() => ReactionEntity, (reaction) => reaction.publication, {
    cascade: true,
    eager: false,
  })
  reactions!: ReactionEntity[];
}

import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  VersionColumn,
} from 'typeorm';

@Entity('discussions')
export class DiscussionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'publication_id' })
  publicationId!: string;

  @Column('uuid', { name: 'author_id' })
  authorId!: string;

  @Column('uuid', { name: 'parent_id', nullable: true })
  parentId!: string | null;

  @Column('text')
  content!: string;

  @Column('varchar', { length: 32 })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @VersionColumn()
  version!: number;

  @ManyToOne(() => DiscussionEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent!: DiscussionEntity | null;
}

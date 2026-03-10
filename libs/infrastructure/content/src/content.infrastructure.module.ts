import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PublicationEntity } from './entities/publication.entity';
import { MentionEntity } from './entities/mention.entity';
import { ReactionEntity } from './entities/reaction.entity';
import { DiscussionEntity } from './entities/discussion.entity';
import { PostgresPublicationRepository } from './repositories/postgres-publication.repository';
import { PostgresDiscussionRepository } from './repositories/postgres-discussion.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PublicationEntity,
      MentionEntity,
      ReactionEntity,
      DiscussionEntity,
    ]),
  ],
  providers: [
    {
      provide: 'IPublicationRepository',
      useFactory: (dataSource: DataSource) => {
        return new PostgresPublicationRepository(
          dataSource.getRepository(PublicationEntity),
          dataSource.getRepository(MentionEntity),
          dataSource.getRepository(ReactionEntity),
        );
      },
      inject: [DataSource],
    },
    {
      provide: 'IDiscussionRepository',
      useFactory: (dataSource: DataSource) => {
        return new PostgresDiscussionRepository(
          dataSource.getRepository(DiscussionEntity),
        );
      },
      inject: [DataSource],
    },
  ],
  exports: ['IPublicationRepository', 'IDiscussionRepository'],
})
export class ContentInfrastructureModule {}

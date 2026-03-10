import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConnectionEntity } from './entities/connection.entity';
import { BlockEntity } from './entities/block.entity';
import { PostgresConnectionRepository } from './repositories/postgres-connection.repository';
import { PostgresBlockRepository } from './repositories/postgres-block.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ConnectionEntity, BlockEntity])],
  providers: [
    {
      provide: 'IConnectionRepository',
      useFactory: (dataSource: DataSource) => {
        const ormRepo = dataSource.getRepository(ConnectionEntity);
        return new PostgresConnectionRepository(ormRepo);
      },
      inject: [DataSource],
    },
    {
      provide: 'IBlockRepository',
      useFactory: (dataSource: DataSource) => {
        const ormRepo = dataSource.getRepository(BlockEntity);
        return new PostgresBlockRepository(ormRepo);
      },
      inject: [DataSource],
    },
  ],
  exports: ['IConnectionRepository', 'IBlockRepository'],
})
export class SocialGraphInfrastructureModule {}

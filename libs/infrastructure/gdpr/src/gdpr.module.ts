import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentEntity } from './consent.entity';
import { ConsentService } from './consent.service';
import { DataExportService } from './data-export.service';
import { DataErasureService } from './data-erasure.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConsentEntity])],
  providers: [ConsentService, DataExportService, DataErasureService],
  exports: [ConsentService, DataExportService, DataErasureService],
})
export class GdprModule {}

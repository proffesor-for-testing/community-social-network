import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3UploadService } from './s3-upload.service';
import { ImageProcessorService } from './image-processor.service';
import { CdnUrlService } from './cdn-url.service';

@Module({
  imports: [ConfigModule],
  providers: [S3UploadService, ImageProcessorService, CdnUrlService],
  exports: [S3UploadService, ImageProcessorService, CdnUrlService],
})
export class StorageModule {}

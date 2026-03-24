import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { StorageModule } from '@csn/infra-storage';
import { UploadController } from './upload.controller';

@Module({
  imports: [
    StorageModule,
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB max
      },
    }),
  ],
  controllers: [UploadController],
})
export class UploadModule {}

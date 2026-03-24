import { Module } from '@nestjs/common';
import { GdprModule } from '@csn/infra-gdpr';
import { PrivacyController } from './privacy.controller';

@Module({
  imports: [GdprModule],
  controllers: [PrivacyController],
})
export class PrivacyModule {}

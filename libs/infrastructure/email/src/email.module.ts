import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { TemplateEngine } from './template-engine';
import { EmailQueueConsumer } from './email-queue.consumer';

@Module({
  imports: [ConfigModule],
  providers: [TemplateEngine, EmailService, EmailQueueConsumer],
  exports: [EmailService, TemplateEngine, EmailQueueConsumer],
})
export class EmailModule {}

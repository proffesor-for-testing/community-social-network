import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loggerConfig } from './logger.config';
import { LoggerService } from './logger.service';

export const LOGGER_SERVICE = Symbol('LOGGER_SERVICE');

@Global()
@Module({
  imports: [ConfigModule.forFeature(loggerConfig)],
  providers: [
    LoggerService,
    {
      provide: LOGGER_SERVICE,
      useExisting: LoggerService,
    },
  ],
  exports: [LoggerService, LOGGER_SERVICE],
})
export class LoggerModule {}

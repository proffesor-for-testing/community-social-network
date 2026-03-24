import { Global, Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loggerConfig } from './logger.config';
import { tracingConfig } from './tracing.config';
import { LoggerService } from './logger.service';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { RequestLoggerMiddleware } from './request-logger.middleware';
import { MetricsRecordingMiddleware } from './metrics-recording.middleware';

export const LOGGER_SERVICE = Symbol('LOGGER_SERVICE');

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(loggerConfig),
    ConfigModule.forFeature(tracingConfig),
  ],
  controllers: [MetricsController],
  providers: [
    LoggerService,
    MetricsService,
    CorrelationIdMiddleware,
    RequestLoggerMiddleware,
    MetricsRecordingMiddleware,
    {
      provide: LOGGER_SERVICE,
      useExisting: LoggerService,
    },
  ],
  exports: [
    LoggerService,
    MetricsService,
    LOGGER_SERVICE,
  ],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware, MetricsRecordingMiddleware, RequestLoggerMiddleware)
      .forRoutes('*');
  }
}

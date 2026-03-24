// Configuration
export { loggerConfig, LOGGER_CONFIG_KEY } from './logger.config';
export type { LoggerConfig } from './logger.config';
export { tracingConfig, TRACING_CONFIG_KEY, ManualSpan } from './tracing.config';
export type { TracingConfig } from './tracing.config';

// Logger
export { LoggerService } from './logger.service';
export type { LogContext } from './logger.service';
export { LoggerModule } from './logger.module';

// Metrics
export { MetricsService } from './metrics.service';
export { MetricsController } from './metrics.controller';

// Middleware
export { CorrelationIdMiddleware, CORRELATION_ID_HEADER } from './correlation-id.middleware';
export { RequestLoggerMiddleware } from './request-logger.middleware';
export { MetricsRecordingMiddleware } from './metrics-recording.middleware';

// Module
export { ObservabilityModule, LOGGER_SERVICE } from './observability.module';

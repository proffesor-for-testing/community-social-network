import { registerAs } from '@nestjs/config';

export const LOGGER_CONFIG_KEY = 'logger';

export interface LoggerConfig {
  level: string;
  prettyPrint: boolean;
  redactPaths: string[];
}

export const loggerConfig = registerAs(LOGGER_CONFIG_KEY, (): LoggerConfig => ({
  level: process.env['LOG_LEVEL'] || 'info',
  prettyPrint: process.env['NODE_ENV'] !== 'production',
  redactPaths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'body.password',
    'body.token',
    'body.refreshToken',
  ],
}));

/**
 * Creates a Pino-compatible logger configuration object.
 * Used to initialize structured JSON logging with request context.
 */
export function createPinoConfig(config: LoggerConfig) {
  return {
    level: config.level,
    formatters: {
      level: (label: string) => ({ level: label }),
      log: (object: Record<string, unknown>) => {
        // Redact sensitive fields
        const redacted = { ...object };
        for (const path of config.redactPaths) {
          const parts = path.split('.');
          let current: Record<string, unknown> = redacted;
          for (let i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] && typeof current[parts[i]] === 'object') {
              current = current[parts[i]] as Record<string, unknown>;
            } else {
              break;
            }
          }
          const lastKey = parts[parts.length - 1];
          if (current && lastKey in current) {
            current[lastKey] = '[REDACTED]';
          }
        }
        return redacted;
      },
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    serializers: {
      req: (req: { method?: string; url?: string; id?: string }) => ({
        method: req.method,
        url: req.url,
        id: req.id,
      }),
      res: (res: { statusCode?: number }) => ({
        statusCode: res.statusCode,
      }),
    },
  };
}

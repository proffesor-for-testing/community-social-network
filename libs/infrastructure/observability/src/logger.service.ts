import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Structured logger service that outputs JSON-formatted log entries.
 * Supports correlation ID injection and contextual metadata.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private context = '';
  private defaultMeta: LogContext = {};

  setContext(context: string): void {
    this.context = context;
  }

  setDefaultMeta(meta: LogContext): void {
    this.defaultMeta = { ...this.defaultMeta, ...meta };
  }

  log(message: string, ...optionalParams: unknown[]): void {
    this.writeLog('info', message, optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]): void {
    this.writeLog('error', message, optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.writeLog('warn', message, optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.writeLog('debug', message, optionalParams);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.writeLog('verbose', message, optionalParams);
  }

  private writeLog(level: string, message: string, params: unknown[]): void {
    const entry: Record<string, unknown> = {
      level,
      message,
      context: this.context,
      timestamp: new Date().toISOString(),
      ...this.defaultMeta,
    };

    if (params.length > 0) {
      const last = params[params.length - 1];
      if (typeof last === 'string') {
        entry['context'] = last;
      } else if (last instanceof Error) {
        entry['error'] = {
          name: last.name,
          message: last.message,
          stack: last.stack,
        };
      } else if (typeof last === 'object' && last !== null) {
        Object.assign(entry, last);
      }
    }

    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        process.stderr.write(output + '\n');
        break;
      default:
        process.stdout.write(output + '\n');
        break;
    }
  }
}

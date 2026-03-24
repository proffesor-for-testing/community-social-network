import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from './logger.service';

/**
 * Middleware that logs every HTTP request with method, URL, status code,
 * response time in ms, and content length.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger: LoggerService;

  constructor() {
    this.logger = new LoggerService();
    this.logger.setContext('HTTP');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const { method, originalUrl } = req;
    const correlationId = (req as Request & { correlationId?: string }).correlationId;

    if (correlationId) {
      this.logger.setDefaultMeta({ correlationId });
    }

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      const contentLength = res.get('content-length') || '0';

      const logData = {
        method,
        url: originalUrl,
        statusCode,
        duration,
        contentLength,
        correlationId,
      };

      if (statusCode >= 500) {
        this.logger.error(`${method} ${originalUrl} ${statusCode} ${duration}ms`, logData);
      } else if (statusCode >= 400) {
        this.logger.warn(`${method} ${originalUrl} ${statusCode} ${duration}ms`, logData);
      } else {
        this.logger.log(`${method} ${originalUrl} ${statusCode} ${duration}ms`, logData);
      }
    });

    next();
  }
}

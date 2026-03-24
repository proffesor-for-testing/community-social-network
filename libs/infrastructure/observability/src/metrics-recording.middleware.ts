import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Middleware that records request metrics (count and duration)
 * for every HTTP request passing through the application.
 */
@Injectable()
export class MetricsRecordingMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    this.metricsService.incrementConnections();

    res.on('finish', () => {
      const duration = Date.now() - start;
      this.metricsService.decrementConnections();
      this.metricsService.recordRequest(
        req.method,
        req.route?.path || req.originalUrl,
        res.statusCode,
        duration,
      );
    });

    next();
  }
}

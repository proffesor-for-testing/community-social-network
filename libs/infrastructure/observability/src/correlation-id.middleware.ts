import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Extracts or generates a correlation ID for every request.
 * The ID is attached to the request object and set as a response header.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[CORRELATION_ID_HEADER] as string | undefined;
    const correlationId = incoming && this.isValidCorrelationId(incoming)
      ? incoming
      : randomUUID();

    // Attach to request for downstream access
    (req as Request & { correlationId: string }).correlationId = correlationId;

    // Set response header so clients can correlate
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }

  /**
   * Validates that a correlation ID is a reasonable string (UUID or similar).
   * Prevents injection of arbitrary data via the header.
   */
  private isValidCorrelationId(id: string): boolean {
    return /^[a-zA-Z0-9\-_]{1,128}$/.test(id);
  }
}

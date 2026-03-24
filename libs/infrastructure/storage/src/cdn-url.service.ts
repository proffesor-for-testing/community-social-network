import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

export interface CdnUrlOptions {
  expiresIn?: number; // seconds, default 3600
  width?: number;
}

/**
 * Generates CDN URLs with signed tokens for secure file access.
 * Supports optional width suffixes for image variants.
 */
@Injectable()
export class CdnUrlService {
  private readonly logger = new Logger(CdnUrlService.name);
  private readonly cdnBaseUrl: string;
  private readonly signingSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.cdnBaseUrl = this.configService.get<string>(
      'CDN_BASE_URL',
      'http://localhost:9000/csn-uploads',
    );
    this.signingSecret = this.configService.get<string>(
      'CDN_SIGNING_SECRET',
      'dev-signing-secret',
    );
  }

  /**
   * Generates a signed CDN URL for a storage key.
   */
  generateUrl(key: string, options: CdnUrlOptions = {}): string {
    const expiresIn = options.expiresIn ?? 3600;
    const expires = Math.floor(Date.now() / 1000) + expiresIn;

    // Build the path with optional width variant
    let path = key;
    if (options.width) {
      const dotIndex = key.lastIndexOf('.');
      if (dotIndex > 0) {
        path = `${key.substring(0, dotIndex)}_${options.width}${key.substring(dotIndex)}`;
      }
    }

    // Generate HMAC signature
    const signature = this.sign(path, expires);

    return `${this.cdnBaseUrl}/${path}?expires=${expires}&sig=${signature}`;
  }

  /**
   * Validates a signed URL's token.
   */
  validateSignature(path: string, expires: number, signature: string): boolean {
    if (expires < Math.floor(Date.now() / 1000)) {
      return false; // Expired
    }

    const expectedSignature = this.sign(path, expires);
    return expectedSignature === signature;
  }

  private sign(path: string, expires: number): string {
    const data = `${path}:${expires}`;
    return createHmac('sha256', this.signingSecret)
      .update(data)
      .digest('hex')
      .substring(0, 32);
  }
}

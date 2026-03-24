import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export interface UploadResult {
  key: string;
  bucket: string;
  location: string;
  etag?: string;
  contentType: string;
  size: number;
}

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/**
 * S3-compatible upload service.
 * Abstract enough for AWS S3 in production and MinIO in development.
 * Stubbed to work without @aws-sdk/client-s3 installed.
 */
@Injectable()
export class S3UploadService {
  private readonly logger = new Logger(S3UploadService.name);
  private readonly config: S3Config;
  private s3Client: unknown = null;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      endpoint: this.configService.get<string>('S3_ENDPOINT', 'http://localhost:9000'),
      region: this.configService.get<string>('S3_REGION', 'us-east-1'),
      bucket: this.configService.get<string>('S3_BUCKET', 'csn-uploads'),
      accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID', 'minioadmin'),
      secretAccessKey: this.configService.get<string>('S3_SECRET_ACCESS_KEY', 'minioadmin'),
      forcePathStyle: this.configService.get<boolean>('S3_FORCE_PATH_STYLE', true),
    };

    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      const sdk = await import('@aws-sdk/client-s3');
      this.s3Client = new sdk.S3Client({
        endpoint: this.config.endpoint,
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        forcePathStyle: this.config.forcePathStyle,
      });
      this.logger.log('S3 client initialized with AWS SDK');
    } catch {
      this.logger.warn(
        'AWS SDK not available - S3 upload service will operate in stub mode',
      );
    }
  }

  async upload(
    buffer: Buffer,
    contentType: string,
    prefix: string = 'uploads',
  ): Promise<UploadResult> {
    const extension = this.getExtension(contentType);
    const key = `${prefix}/${randomUUID()}${extension}`;

    if (this.s3Client) {
      return this.uploadToS3(key, buffer, contentType);
    }

    return this.stubUpload(key, buffer, contentType);
  }

  async delete(key: string): Promise<void> {
    if (this.s3Client) {
      try {
        const sdk = await import('@aws-sdk/client-s3');
        const command = new sdk.DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        });
        await (this.s3Client as { send: (cmd: unknown) => Promise<unknown> }).send(command);
        this.logger.log(`Deleted object: ${key}`);
      } catch (error) {
        this.logger.error(`Failed to delete ${key}`, error);
        throw error;
      }
    } else {
      this.logger.log(`[STUB] Deleted object: ${key}`);
    }
  }

  private async uploadToS3(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    try {
      const sdk = await import('@aws-sdk/client-s3');
      const command = new sdk.PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });
      const response = await (
        this.s3Client as { send: (cmd: unknown) => Promise<{ ETag?: string }> }
      ).send(command);

      this.logger.log(`Uploaded to S3: ${key} (${buffer.length} bytes)`);

      return {
        key,
        bucket: this.config.bucket,
        location: `${this.config.endpoint}/${this.config.bucket}/${key}`,
        etag: response.ETag,
        contentType,
        size: buffer.length,
      };
    } catch (error) {
      this.logger.error(`S3 upload failed for ${key}`, error);
      throw error;
    }
  }

  private stubUpload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): UploadResult {
    this.logger.log(`[STUB] Uploaded: ${key} (${buffer.length} bytes)`);

    return {
      key,
      bucket: this.config.bucket,
      location: `${this.config.endpoint}/${this.config.bucket}/${key}`,
      contentType,
      size: buffer.length,
    };
  }

  private getExtension(contentType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
    };
    return map[contentType] || '';
  }
}

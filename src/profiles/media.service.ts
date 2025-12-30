/**
 * Media Service - Image upload and processing for User Profiles
 * SPARC Phase 4 - TDD Implementation (M2 Profiles)
 *
 * Handles image validation, upload to S3, and processing with Sharp
 */

import { v4 as uuidv4 } from 'uuid';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

import {
  Media,
  MediaType,
  ScanStatus,
  MediaUploadRequest,
  PresignedUploadUrl,
  ImageVariant,
  ImageProcessingConfig,
  MediaServiceResult,
  MediaErrorCodes,
  MAGIC_BYTES,
  DEFAULT_MEDIA_CONFIG,
} from './profile.types';

export class MediaService {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;
  private maxFileSize: number;
  private allowedMimeTypes: string[];

  constructor(config?: {
    s3Client?: S3Client;
    bucket?: string;
    region?: string;
    maxFileSize?: number;
    allowedMimeTypes?: string[];
  }) {
    this.region = config?.region || process.env.AWS_REGION || 'us-east-1';
    this.bucket = config?.bucket || process.env.S3_BUCKET || 'community-social-network-media';
    this.maxFileSize = config?.maxFileSize || DEFAULT_MEDIA_CONFIG.maxFileSize;
    this.allowedMimeTypes = config?.allowedMimeTypes || DEFAULT_MEDIA_CONFIG.allowedMimeTypes;

    this.s3Client = config?.s3Client || new S3Client({
      region: this.region,
    });
  }

  /**
   * Generate a pre-signed URL for direct upload to S3
   */
  async generatePresignedUploadUrl(
    userId: number,
    request: MediaUploadRequest
  ): Promise<{ success: boolean; data?: PresignedUploadUrl; error?: { code: string; message: string } }> {
    // Validate file type
    if (!this.allowedMimeTypes.includes(request.mimeType)) {
      return {
        success: false,
        error: {
          code: MediaErrorCodes.INVALID_FILE_TYPE,
          message: `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
        },
      };
    }

    // Validate file size
    if (request.fileSize > this.maxFileSize) {
      return {
        success: false,
        error: {
          code: MediaErrorCodes.FILE_TOO_LARGE,
          message: `File too large. Maximum size: ${this.maxFileSize / (1024 * 1024)}MB`,
        },
      };
    }

    // Generate S3 key
    const uploadId = uuidv4();
    const timestamp = Date.now();
    const extension = this.getExtensionFromMimeType(request.mimeType);
    const s3Key = this.generateS3Key(userId, request.mediaType, timestamp, uploadId, extension);

    // Generate pre-signed URL
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        ContentType: request.mimeType,
        ContentLength: request.fileSize,
        Metadata: {
          userId: userId.toString(),
          mediaType: request.mediaType,
          originalFilename: request.filename,
          uploadId,
        },
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: DEFAULT_MEDIA_CONFIG.presignedUrlExpiry,
      });

      const expiresAt = new Date(Date.now() + DEFAULT_MEDIA_CONFIG.presignedUrlExpiry * 1000);

      return {
        success: true,
        data: {
          uploadUrl,
          fields: {
            key: s3Key,
            bucket: this.bucket,
            'Content-Type': request.mimeType,
          },
          expiresAt,
          uploadId,
          s3Key,
        },
      };
    } catch (error) {
      console.error('Error generating pre-signed URL:', error);
      return {
        success: false,
        error: {
          code: MediaErrorCodes.UPLOAD_FAILED,
          message: 'Failed to generate upload URL',
        },
      };
    }
  }

  /**
   * Validate file using magic bytes
   */
  validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
    const signature = MAGIC_BYTES[mimeType];
    if (!signature) return false;

    if (buffer.length < signature.minLength) return false;

    for (const pattern of signature.signatures) {
      let match = true;
      for (let i = 0; i < pattern.length; i++) {
        // Skip null values (wildcards)
        if (pattern[i] === null) continue;
        if (buffer[i] !== pattern[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        // Special handling for WebP - need to check WEBP signature at offset 8
        if (mimeType === 'image/webp') {
          if (buffer.length >= 12) {
            const webpSignature = [0x57, 0x45, 0x42, 0x50]; // WEBP
            let webpMatch = true;
            for (let i = 0; i < webpSignature.length; i++) {
              if (buffer[8 + i] !== webpSignature[i]) {
                webpMatch = false;
                break;
              }
            }
            return webpMatch;
          }
          return false;
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Process uploaded image - resize and convert to WebP
   */
  async processImage(
    buffer: Buffer,
    mediaType: MediaType
  ): Promise<{
    success: boolean;
    data?: { variants: ImageVariant[]; metadata: sharp.Metadata };
    error?: { code: string; message: string };
  }> {
    try {
      const config = DEFAULT_MEDIA_CONFIG.processingConfig[mediaType];
      const metadata = await sharp(buffer).metadata();

      // Strip EXIF data for privacy
      let imageBuffer = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF orientation
        .toBuffer();

      const variants: ImageVariant[] = [];

      for (const variant of config.variants) {
        const processedBuffer = await sharp(imageBuffer)
          .resize(variant.width, variant.height, {
            fit: 'cover',
            position: 'center',
          })
          .webp({ quality: config.quality })
          .toBuffer();

        variants.push({
          name: variant.name,
          s3Key: '', // Will be set during upload
          width: variant.width,
          height: variant.height,
          fileSize: processedBuffer.length,
          format: 'webp',
        });
      }

      return {
        success: true,
        data: {
          variants,
          metadata,
        },
      };
    } catch (error) {
      console.error('Error processing image:', error);
      return {
        success: false,
        error: {
          code: MediaErrorCodes.PROCESSING_FAILED,
          message: 'Failed to process image',
        },
      };
    }
  }

  /**
   * Process and upload image with all variants
   */
  async processAndUploadImage(
    buffer: Buffer,
    userId: number,
    mediaType: MediaType,
    originalFilename: string
  ): Promise<{
    success: boolean;
    data?: {
      originalS3Key: string;
      variants: ImageVariant[];
      cdnUrl: string;
    };
    error?: { code: string; message: string };
  }> {
    try {
      const config = DEFAULT_MEDIA_CONFIG.processingConfig[mediaType];
      const uploadId = uuidv4();
      const timestamp = Date.now();

      // Validate magic bytes
      const mimeType = this.getMimeTypeFromBuffer(buffer);
      if (!mimeType || !this.validateMagicBytes(buffer, mimeType)) {
        return {
          success: false,
          error: {
            code: MediaErrorCodes.INVALID_FILE_TYPE,
            message: 'Invalid file content - magic bytes validation failed',
          },
        };
      }

      // Process image - auto-rotate and strip EXIF
      let imageBuffer = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF orientation
        .toBuffer();

      // Upload original
      const originalS3Key = this.generateS3Key(userId, mediaType, timestamp, uploadId, 'original');
      await this.uploadToS3(imageBuffer, originalS3Key, mimeType);

      // Generate and upload variants
      const variants: ImageVariant[] = [];

      for (const variantConfig of config.variants) {
        const processedBuffer = await sharp(imageBuffer)
          .resize(variantConfig.width, variantConfig.height, {
            fit: 'cover',
            position: 'center',
          })
          .webp({ quality: config.quality })
          .toBuffer();

        const variantS3Key = this.generateS3Key(
          userId,
          mediaType,
          timestamp,
          uploadId,
          variantConfig.name,
          'webp'
        );

        await this.uploadToS3(processedBuffer, variantS3Key, 'image/webp');

        variants.push({
          name: variantConfig.name,
          s3Key: variantS3Key,
          width: variantConfig.width,
          height: variantConfig.height,
          fileSize: processedBuffer.length,
          format: 'webp',
        });
      }

      // Return the optimized variant URL
      const optimizedVariant = variants.find(v => v.name === 'medium') || variants[0];
      const cdnUrl = optimizedVariant ? this.getCdnUrl(optimizedVariant.s3Key) : '';

      return {
        success: true,
        data: {
          originalS3Key,
          variants,
          cdnUrl,
        },
      };
    } catch (error) {
      console.error('Error processing and uploading image:', error);
      return {
        success: false,
        error: {
          code: MediaErrorCodes.PROCESSING_FAILED,
          message: 'Failed to process and upload image',
        },
      };
    }
  }

  /**
   * Delete media from S3
   */
  async deleteMedia(s3Key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting media:', error);
      return false;
    }
  }

  /**
   * Get a signed URL for downloading media
   */
  async getSignedDownloadUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Upload buffer to S3
   */
  private async uploadToS3(
    buffer: Buffer,
    s3Key: string,
    contentType: string
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1 year
    });
    await this.s3Client.send(command);
  }

  /**
   * Generate S3 key for media storage
   */
  private generateS3Key(
    userId: number,
    mediaType: MediaType,
    timestamp: number,
    uploadId: string,
    variant: string,
    extension: string = ''
  ): string {
    const folder = this.getFolderForMediaType(mediaType);
    const ext = extension || 'webp';
    return `${folder}/user_${userId}/${timestamp}_${uploadId}_${variant}.${ext}`;
  }

  /**
   * Get folder path for media type
   */
  private getFolderForMediaType(mediaType: MediaType): string {
    switch (mediaType) {
      case 'profile_picture':
        return 'avatars';
      case 'cover_image':
        return 'covers';
      case 'post_image':
        return 'posts';
      default:
        return 'misc';
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mapping: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    return mapping[mimeType] || 'bin';
  }

  /**
   * Detect MIME type from buffer magic bytes
   */
  private getMimeTypeFromBuffer(buffer: Buffer): string | null {
    for (const [mimeType, signature] of Object.entries(MAGIC_BYTES)) {
      if (this.validateMagicBytes(buffer, mimeType)) {
        return mimeType;
      }
    }
    return null;
  }

  /**
   * Get CDN URL for S3 key
   */
  private getCdnUrl(s3Key: string): string {
    const cdnDomain = process.env.CDN_DOMAIN;
    if (cdnDomain) {
      return `https://${cdnDomain}/${s3Key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${s3Key}`;
  }
}

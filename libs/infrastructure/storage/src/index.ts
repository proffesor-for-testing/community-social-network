// S3 Upload
export { S3UploadService } from './s3-upload.service';
export type { UploadResult, S3Config } from './s3-upload.service';

// Image Processing
export { ImageProcessorService, IMAGE_VARIANT_SIZES } from './image-processor.service';
export type { ImageVariant } from './image-processor.service';

// CDN URLs
export { CdnUrlService } from './cdn-url.service';
export type { CdnUrlOptions } from './cdn-url.service';

// File Validation
export {
  detectFileType,
  validateImageBuffer,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_AVATAR_TYPES,
  MAX_FILE_SIZES,
} from './magic-bytes-validator';
export type { FileTypeResult } from './magic-bytes-validator';

// Module
export { StorageModule } from './storage.module';

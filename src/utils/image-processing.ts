/**
 * Image Processing Utilities
 * SPARC Phase 4 - TDD Implementation (M2 Profiles)
 *
 * Utility functions for image validation and processing
 * REFACTOR Phase: Extracted from MediaService for reusability
 */

import sharp from 'sharp';
import { MAGIC_BYTES } from '../profiles/profile.types';

/**
 * Image metadata extracted from buffer
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
  orientation?: number;
  size: number;
}

/**
 * Extract metadata from image buffer
 */
export async function extractImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  const metadata = await sharp(buffer).metadata();

  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
    hasAlpha: metadata.hasAlpha || false,
    orientation: metadata.orientation,
    size: buffer.length,
  };
}

/**
 * Validate image dimensions
 */
export function validateImageDimensions(
  metadata: ImageMetadata,
  constraints: {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    maxPixels?: number;
  }
): { valid: boolean; message?: string } {
  const { minWidth = 0, minHeight = 0, maxWidth = 10000, maxHeight = 10000, maxPixels = 25000000 } = constraints;

  if (metadata.width < minWidth || metadata.height < minHeight) {
    return {
      valid: false,
      message: `Image too small. Minimum dimensions: ${minWidth}x${minHeight}`,
    };
  }

  if (metadata.width > maxWidth || metadata.height > maxHeight) {
    return {
      valid: false,
      message: `Image too large. Maximum dimensions: ${maxWidth}x${maxHeight}`,
    };
  }

  const totalPixels = metadata.width * metadata.height;
  if (totalPixels > maxPixels) {
    return {
      valid: false,
      message: `Image has too many pixels. Maximum: ${maxPixels}`,
    };
  }

  return { valid: true };
}

/**
 * Validate magic bytes for file type
 */
export function validateMagicBytes(buffer: Buffer, expectedMimeType: string): boolean {
  const signature = MAGIC_BYTES[expectedMimeType];
  if (!signature) return false;

  if (buffer.length < signature.minLength) return false;

  for (const pattern of signature.signatures) {
    let match = true;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] !== null && buffer[i] !== pattern[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      // Special handling for WebP
      if (expectedMimeType === 'image/webp' && buffer.length >= 12) {
        const webpSignature = [0x57, 0x45, 0x42, 0x50];
        for (let i = 0; i < webpSignature.length; i++) {
          if (buffer[8 + i] !== webpSignature[i]) {
            return false;
          }
        }
      }
      return true;
    }
  }

  return false;
}

/**
 * Detect MIME type from buffer magic bytes
 */
export function detectMimeType(buffer: Buffer): string | null {
  for (const [mimeType] of Object.entries(MAGIC_BYTES)) {
    if (validateMagicBytes(buffer, mimeType)) {
      return mimeType;
    }
  }
  return null;
}

/**
 * Resize image with options
 */
export async function resizeImage(
  buffer: Buffer,
  width: number,
  height: number,
  options: {
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    position?: string;
    background?: { r: number; g: number; b: number; alpha: number };
  } = {}
): Promise<Buffer> {
  const { fit = 'cover', position = 'center', background } = options;

  let pipeline = sharp(buffer).resize(width, height, {
    fit,
    position,
    background,
  });

  return pipeline.toBuffer();
}

/**
 * Convert image to WebP format
 */
export async function convertToWebP(
  buffer: Buffer,
  quality: number = 85
): Promise<Buffer> {
  return sharp(buffer)
    .webp({ quality })
    .toBuffer();
}

/**
 * Strip EXIF metadata from image
 */
export async function stripExifData(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // Auto-rotate based on EXIF orientation
    .toBuffer();
}

/**
 * Create image thumbnail
 */
export async function createThumbnail(
  buffer: Buffer,
  size: number = 100,
  format: 'webp' | 'jpeg' | 'png' = 'webp',
  quality: number = 80
): Promise<Buffer> {
  let pipeline = sharp(buffer)
    .resize(size, size, {
      fit: 'cover',
      position: 'center',
    });

  switch (format) {
    case 'webp':
      return pipeline.webp({ quality }).toBuffer();
    case 'jpeg':
      return pipeline.jpeg({ quality }).toBuffer();
    case 'png':
      return pipeline.png().toBuffer();
    default:
      return pipeline.webp({ quality }).toBuffer();
  }
}

/**
 * Optimize image for web
 */
export async function optimizeForWeb(
  buffer: Buffer,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}
): Promise<Buffer> {
  const { maxWidth = 2048, maxHeight = 2048, quality = 85, format = 'webp' } = options;

  let pipeline = sharp(buffer)
    .rotate() // Auto-rotate
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });

  switch (format) {
    case 'webp':
      return pipeline.webp({ quality }).toBuffer();
    case 'jpeg':
      return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    case 'png':
      return pipeline.png({ compressionLevel: 9 }).toBuffer();
    default:
      return pipeline.webp({ quality }).toBuffer();
  }
}

/**
 * Generate blur hash placeholder (for lazy loading)
 */
export async function generateBlurPlaceholder(
  buffer: Buffer,
  width: number = 32,
  height: number = 32
): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height)
    .blur(10)
    .webp({ quality: 20 })
    .toBuffer();
}

/**
 * Calculate aspect ratio
 */
export function calculateAspectRatio(width: number, height: number): number {
  return width / height;
}

/**
 * Check if image is square
 */
export function isSquare(width: number, height: number, tolerance: number = 0.1): boolean {
  const ratio = calculateAspectRatio(width, height);
  return Math.abs(ratio - 1) <= tolerance;
}

/**
 * Get dimensions for a target aspect ratio
 */
export function getDimensionsForAspectRatio(
  originalWidth: number,
  originalHeight: number,
  targetRatio: number,
  mode: 'fit' | 'fill' = 'fit'
): { width: number; height: number } {
  const originalRatio = originalWidth / originalHeight;

  if (mode === 'fit') {
    if (originalRatio > targetRatio) {
      // Original is wider, limit by width
      return {
        width: originalWidth,
        height: Math.round(originalWidth / targetRatio),
      };
    } else {
      // Original is taller, limit by height
      return {
        width: Math.round(originalHeight * targetRatio),
        height: originalHeight,
      };
    }
  } else {
    // fill mode
    if (originalRatio > targetRatio) {
      // Original is wider, crop width
      return {
        width: Math.round(originalHeight * targetRatio),
        height: originalHeight,
      };
    } else {
      // Original is taller, crop height
      return {
        width: originalWidth,
        height: Math.round(originalWidth / targetRatio),
      };
    }
  }
}

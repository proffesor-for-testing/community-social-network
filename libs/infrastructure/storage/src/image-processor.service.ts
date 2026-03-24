import { Injectable, Logger } from '@nestjs/common';

export interface ImageVariant {
  width: number;
  suffix: string;
  buffer: Buffer;
  contentType: string;
}

export const IMAGE_VARIANT_SIZES = [100, 200, 400, 800] as const;

/**
 * Image processing service that generates thumbnail variants.
 * Uses sharp when available, falls back to returning the original
 * buffer at each size (stub mode for development without sharp).
 */
@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);
  private sharpAvailable = false;
  private sharpFn: ((input: Buffer) => unknown) | null = null;

  constructor() {
    this.loadSharp();
  }

  private async loadSharp(): Promise<void> {
    try {
      const mod = await import('sharp');
      this.sharpFn = mod.default || mod;
      this.sharpAvailable = true;
      this.logger.log('Sharp image processing library loaded');
    } catch {
      this.logger.warn(
        'Sharp not available - image processing will operate in stub mode',
      );
    }
  }

  /**
   * Generates image variants (thumbnails) at predefined sizes.
   */
  async generateVariants(
    buffer: Buffer,
    contentType: string,
    sizes: readonly number[] = IMAGE_VARIANT_SIZES,
  ): Promise<ImageVariant[]> {
    const variants: ImageVariant[] = [];

    for (const width of sizes) {
      try {
        const variant = await this.resize(buffer, width, contentType);
        variants.push(variant);
      } catch (error) {
        this.logger.warn(
          `Failed to generate ${width}px variant: ${(error as Error).message}`,
        );
      }
    }

    return variants;
  }

  /**
   * Resizes an image to a target width, preserving aspect ratio.
   */
  async resize(
    buffer: Buffer,
    targetWidth: number,
    contentType: string,
  ): Promise<ImageVariant> {
    if (this.sharpAvailable && this.sharpFn) {
      return this.resizeWithSharp(buffer, targetWidth, contentType);
    }

    // Stub mode: return original buffer tagged with the target size
    return {
      width: targetWidth,
      suffix: `_${targetWidth}`,
      buffer,
      contentType,
    };
  }

  private async resizeWithSharp(
    buffer: Buffer,
    targetWidth: number,
    contentType: string,
  ): Promise<ImageVariant> {
    const pipeline = (this.sharpFn as (input: Buffer) => {
      resize: (w: number) => { toFormat: (f: string, o?: unknown) => { toBuffer: () => Promise<Buffer> } };
    })(buffer).resize(targetWidth);

    const format = contentType.split('/')[1] || 'jpeg';
    const outputBuffer = await pipeline.toFormat(format, { quality: 85 }).toBuffer();

    return {
      width: targetWidth,
      suffix: `_${targetWidth}`,
      buffer: outputBuffer,
      contentType,
    };
  }
}

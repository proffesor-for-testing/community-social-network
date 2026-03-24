import { describe, it, expect } from 'vitest';
import {
  detectFileType,
  validateImageBuffer,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_AVATAR_TYPES,
  MAX_FILE_SIZES,
} from '../magic-bytes-validator';

describe('Magic Bytes Validator', () => {
  describe('detectFileType', () => {
    it('should detect JPEG files', () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const result = detectFileType(buffer);

      expect(result).toBeDefined();
      expect(result!.mime).toBe('image/jpeg');
      expect(result!.extension).toBe('jpg');
    });

    it('should detect PNG files', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      const result = detectFileType(buffer);

      expect(result).toBeDefined();
      expect(result!.mime).toBe('image/png');
      expect(result!.extension).toBe('png');
    });

    it('should detect GIF87a files', () => {
      const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00]);
      const result = detectFileType(buffer);

      expect(result).toBeDefined();
      expect(result!.mime).toBe('image/gif');
      expect(result!.extension).toBe('gif');
    });

    it('should detect GIF89a files', () => {
      const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00]);
      const result = detectFileType(buffer);

      expect(result).toBeDefined();
      expect(result!.mime).toBe('image/gif');
      expect(result!.extension).toBe('gif');
    });

    it('should detect WebP files', () => {
      // RIFF....WEBP
      const buffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46,  // RIFF
        0x00, 0x00, 0x00, 0x00,  // file size (placeholder)
        0x57, 0x45, 0x42, 0x50,  // WEBP
        0x00, 0x00,
      ]);
      const result = detectFileType(buffer);

      expect(result).toBeDefined();
      expect(result!.mime).toBe('image/webp');
      expect(result!.extension).toBe('webp');
    });

    it('should detect PDF files', () => {
      const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
      const result = detectFileType(buffer);

      expect(result).toBeDefined();
      expect(result!.mime).toBe('application/pdf');
      expect(result!.extension).toBe('pdf');
    });

    it('should detect SVG files starting with <?xml', () => {
      const buffer = Buffer.from('<?xml version="1.0"?><svg>', 'utf-8');
      const result = detectFileType(buffer);

      expect(result).toBeDefined();
      expect(result!.mime).toBe('image/svg+xml');
      expect(result!.extension).toBe('svg');
    });

    it('should detect SVG files starting with <svg', () => {
      const buffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">', 'utf-8');
      const result = detectFileType(buffer);

      expect(result).toBeDefined();
      expect(result!.mime).toBe('image/svg+xml');
      expect(result!.extension).toBe('svg');
    });

    it('should return null for unrecognized file types', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      const result = detectFileType(buffer);

      expect(result).toBeNull();
    });

    it('should return null for buffers that are too small', () => {
      const buffer = Buffer.from([0xff, 0xd8]);
      const result = detectFileType(buffer);

      expect(result).toBeNull();
    });

    it('should return null for empty buffers', () => {
      const buffer = Buffer.alloc(0);
      const result = detectFileType(buffer);

      expect(result).toBeNull();
    });

    it('should not falsely detect RIFF without WEBP signature as WebP', () => {
      const buffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46,  // RIFF
        0x00, 0x00, 0x00, 0x00,  // file size
        0x41, 0x56, 0x49, 0x20,  // AVI (not WEBP)
        0x00, 0x00,
      ]);
      const result = detectFileType(buffer);

      // Should not be detected as WebP
      expect(result === null || result.mime !== 'image/webp').toBe(true);
    });
  });

  describe('validateImageBuffer', () => {
    it('should validate a valid JPEG image', () => {
      const buffer = Buffer.alloc(1000);
      buffer[0] = 0xff;
      buffer[1] = 0xd8;
      buffer[2] = 0xff;

      const result = validateImageBuffer(buffer);

      expect(result.valid).toBe(true);
      expect(result.mime).toBe('image/jpeg');
    });

    it('should validate a valid PNG image', () => {
      const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const buffer = Buffer.alloc(1000);
      for (let i = 0; i < pngHeader.length; i++) {
        buffer[i] = pngHeader[i];
      }

      const result = validateImageBuffer(buffer);

      expect(result.valid).toBe(true);
      expect(result.mime).toBe('image/png');
    });

    it('should reject empty buffers', () => {
      const buffer = Buffer.alloc(0);
      const result = validateImageBuffer(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File is empty');
    });

    it('should reject files exceeding max size', () => {
      const buffer = Buffer.alloc(MAX_FILE_SIZES.IMAGE + 1);
      buffer[0] = 0xff;
      buffer[1] = 0xd8;
      buffer[2] = 0xff;

      const result = validateImageBuffer(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should reject unrecognized file types', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      const result = validateImageBuffer(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unrecognized file type');
    });

    it('should reject disallowed file types', () => {
      // PDF magic bytes
      const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
      const result = validateImageBuffer(buffer, ALLOWED_IMAGE_TYPES);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should use custom allowed types', () => {
      // JPEG buffer
      const buffer = Buffer.alloc(100);
      buffer[0] = 0xff;
      buffer[1] = 0xd8;
      buffer[2] = 0xff;

      const result = validateImageBuffer(buffer, ALLOWED_AVATAR_TYPES);

      expect(result.valid).toBe(true);
      expect(result.mime).toBe('image/jpeg');
    });

    it('should reject GIF for avatar uploads (not in ALLOWED_AVATAR_TYPES)', () => {
      const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);
      const result = validateImageBuffer(buffer, ALLOWED_AVATAR_TYPES);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should use custom max size', () => {
      const buffer = Buffer.alloc(1000);
      buffer[0] = 0xff;
      buffer[1] = 0xd8;
      buffer[2] = 0xff;

      const result = validateImageBuffer(buffer, ALLOWED_IMAGE_TYPES, 500);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should handle all standard avatar types correctly', () => {
      const avatarTypes = [
        { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
        { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png' },
      ];

      for (const type of avatarTypes) {
        const buffer = Buffer.alloc(100);
        for (let i = 0; i < type.bytes.length; i++) {
          buffer[i] = type.bytes[i];
        }

        const result = validateImageBuffer(buffer, ALLOWED_AVATAR_TYPES);
        expect(result.valid).toBe(true);
        expect(result.mime).toBe(type.mime);
      }
    });
  });

  describe('MAX_FILE_SIZES constants', () => {
    it('should have sensible file size limits', () => {
      expect(MAX_FILE_SIZES.IMAGE).toBe(10 * 1024 * 1024);
      expect(MAX_FILE_SIZES.AVATAR).toBe(5 * 1024 * 1024);
      expect(MAX_FILE_SIZES.DOCUMENT).toBe(25 * 1024 * 1024);
      expect(MAX_FILE_SIZES.AVATAR).toBeLessThan(MAX_FILE_SIZES.IMAGE);
      expect(MAX_FILE_SIZES.IMAGE).toBeLessThan(MAX_FILE_SIZES.DOCUMENT);
    });
  });
});

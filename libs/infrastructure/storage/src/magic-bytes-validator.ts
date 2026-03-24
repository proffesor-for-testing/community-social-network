/**
 * Validates file types by examining magic bytes (file signatures),
 * not relying on file extensions which can be spoofed.
 */

export interface FileTypeResult {
  mime: string;
  extension: string;
}

interface MagicSignature {
  bytes: number[];
  offset: number;
  mime: string;
  extension: string;
}

const SIGNATURES: MagicSignature[] = [
  // JPEG: FF D8 FF
  { bytes: [0xff, 0xd8, 0xff], offset: 0, mime: 'image/jpeg', extension: 'jpg' },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0, mime: 'image/png', extension: 'png' },
  // GIF87a: 47 49 46 38 37 61
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], offset: 0, mime: 'image/gif', extension: 'gif' },
  // GIF89a: 47 49 46 38 39 61
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], offset: 0, mime: 'image/gif', extension: 'gif' },
  // WebP: 52 49 46 46 xx xx xx xx 57 45 42 50
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mime: 'image/webp', extension: 'webp' },
  // PDF: 25 50 44 46
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mime: 'application/pdf', extension: 'pdf' },
  // SVG: starts with < (check for <?xml or <svg)
  { bytes: [0x3c, 0x3f, 0x78, 0x6d, 0x6c], offset: 0, mime: 'image/svg+xml', extension: 'svg' },
  { bytes: [0x3c, 0x73, 0x76, 0x67], offset: 0, mime: 'image/svg+xml', extension: 'svg' },
];

/** Allowed MIME types for image uploads */
export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

/** Allowed MIME types for avatar uploads (subset of image types) */
export const ALLOWED_AVATAR_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** Maximum file sizes in bytes */
export const MAX_FILE_SIZES = {
  IMAGE: 10 * 1024 * 1024,    // 10 MB
  AVATAR: 5 * 1024 * 1024,    // 5 MB
  DOCUMENT: 25 * 1024 * 1024, // 25 MB
} as const;

/**
 * Detects file type from buffer by examining magic bytes.
 * Returns null if the file type is not recognized.
 */
export function detectFileType(buffer: Buffer): FileTypeResult | null {
  if (buffer.length < 4) {
    return null;
  }

  for (const sig of SIGNATURES) {
    if (buffer.length < sig.offset + sig.bytes.length) {
      continue;
    }

    // Special handling for WebP: need to also check bytes 8-11 for 'WEBP'
    if (sig.mime === 'image/webp') {
      const riffMatch = sig.bytes.every(
        (byte, i) => buffer[sig.offset + i] === byte,
      );
      if (riffMatch && buffer.length >= 12) {
        const webpBytes = [0x57, 0x45, 0x42, 0x50];
        const webpMatch = webpBytes.every((byte, i) => buffer[8 + i] === byte);
        if (webpMatch) {
          return { mime: sig.mime, extension: sig.extension };
        }
      }
      continue;
    }

    const match = sig.bytes.every(
      (byte, i) => buffer[sig.offset + i] === byte,
    );

    if (match) {
      return { mime: sig.mime, extension: sig.extension };
    }
  }

  return null;
}

/**
 * Validates that a buffer represents an allowed image type.
 */
export function validateImageBuffer(
  buffer: Buffer,
  allowedTypes: Set<string> = ALLOWED_IMAGE_TYPES,
  maxSize: number = MAX_FILE_SIZES.IMAGE,
): { valid: boolean; mime?: string; error?: string } {
  if (buffer.length === 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (buffer.length > maxSize) {
    return {
      valid: false,
      error: `File size ${buffer.length} exceeds maximum ${maxSize} bytes`,
    };
  }

  const fileType = detectFileType(buffer);
  if (!fileType) {
    return { valid: false, error: 'Unrecognized file type' };
  }

  if (!allowedTypes.has(fileType.mime)) {
    return {
      valid: false,
      error: `File type ${fileType.mime} is not allowed. Allowed: ${Array.from(allowedTypes).join(', ')}`,
    };
  }

  return { valid: true, mime: fileType.mime };
}

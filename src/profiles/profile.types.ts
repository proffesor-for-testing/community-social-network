/**
 * Profile Types - TypeScript interfaces for User Profiles Module
 * SPARC Phase 4 - TDD Implementation (M2 Profiles)
 */

import { z } from 'zod';

// ============================================================
// Validation Schemas (Zod)
// ============================================================

export const CreateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().max(200).optional().nullable(),
  isPublic: z.boolean().default(true),
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().max(200).optional().nullable(),
  isPublic: z.boolean().optional(),
});

export const ProfileSearchSchema = z.object({
  query: z.string().min(1).max(100),
  location: z.string().max(100).optional(),
  isPublic: z.boolean().optional(),
  hasAvatar: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['relevance', 'created_at', 'display_name']).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const PrivacySettingsSchema = z.object({
  isPublic: z.boolean(),
  showEmail: z.boolean().default(false),
  showLocation: z.boolean().default(true),
  allowSearchIndexing: z.boolean().default(true),
});

// ============================================================
// Core Types
// ============================================================

export interface UserProfile {
  id: number;
  userId: number;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarS3Key: string | null;
  coverImageUrl: string | null;
  coverImageS3Key: string | null;
  location: string | null;
  website: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProfileInput {
  userId: number;
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string | null;
  isPublic?: boolean;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string | null;
  isPublic?: boolean;
  avatarUrl?: string;
  avatarS3Key?: string;
  coverImageUrl?: string;
  coverImageS3Key?: string;
}

export interface ProfileSearchFilters {
  query: string;
  location?: string;
  isPublic?: boolean;
  hasAvatar?: boolean;
  limit: number;
  offset: number;
  sortBy: 'relevance' | 'created_at' | 'display_name';
  sortOrder: 'asc' | 'desc';
}

export interface ProfileSearchResult {
  profiles: UserProfile[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PrivacySettings {
  isPublic: boolean;
  showEmail: boolean;
  showLocation: boolean;
  allowSearchIndexing: boolean;
}

// ============================================================
// Media Types
// ============================================================

export type MediaType = 'profile_picture' | 'cover_image' | 'post_image';
export type ScanStatus = 'pending' | 'scanning' | 'clean' | 'infected' | 'failed';

export interface MediaUploadRequest {
  mediaType: MediaType;
  filename: string;
  fileSize: number;
  mimeType: string;
}

export interface Media {
  id: number;
  userId: number;
  mediaType: MediaType;
  originalFilename: string;
  s3Bucket: string;
  s3Key: string;
  s3Region: string;
  fileSize: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  scanStatus: ScanStatus;
  virusScanResult: Record<string, unknown> | null;
  uploadedFrom: string;
  uploadedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
}

export interface PresignedUploadUrl {
  uploadUrl: string;
  fields: Record<string, string>;
  expiresAt: Date;
  uploadId: string;
  s3Key: string;
}

export interface ImageVariant {
  name: string;
  s3Key: string;
  width: number;
  height: number;
  fileSize: number;
  format: string;
}

export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
  stripMetadata?: boolean;
}

export interface ImageProcessingConfig {
  variants: Array<{
    name: string;
    width: number;
    height: number;
  }>;
  format: 'jpeg' | 'png' | 'webp' | 'avif';
  quality: number;
  stripMetadata: boolean;
}

// ============================================================
// Service Result Types
// ============================================================

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ProfileServiceResult extends ServiceResult<UserProfile> {}
export interface MediaServiceResult extends ServiceResult<Media> {}
export interface SearchServiceResult extends ServiceResult<ProfileSearchResult> {}

// ============================================================
// Error Codes
// ============================================================

export const ProfileErrorCodes = {
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  PROFILE_ALREADY_EXISTS: 'PROFILE_ALREADY_EXISTS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export const MediaErrorCodes = {
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  MALWARE_DETECTED: 'MALWARE_DETECTED',
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
} as const;

// ============================================================
// Configuration Types
// ============================================================

export interface MediaConfig {
  maxFileSize: number; // bytes
  allowedMimeTypes: string[];
  s3Bucket: string;
  s3Region: string;
  presignedUrlExpiry: number; // seconds
  processingConfig: Record<MediaType, ImageProcessingConfig>;
}

export interface CacheConfig {
  profileTtl: number; // seconds
  searchTtl: number;
  mediaTtl: number;
}

// Magic bytes for file type validation
export const MAGIC_BYTES: Record<string, { signatures: number[][]; minLength: number }> = {
  'image/jpeg': {
    signatures: [
      [0xFF, 0xD8, 0xFF, 0xE0], // JFIF
      [0xFF, 0xD8, 0xFF, 0xE1], // EXIF
      [0xFF, 0xD8, 0xFF, 0xE2], // ICC
      [0xFF, 0xD8, 0xFF, 0xDB], // JPG
    ],
    minLength: 4,
  },
  'image/png': {
    signatures: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    minLength: 8,
  },
  'image/gif': {
    signatures: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    ],
    minLength: 6,
  },
  'image/webp': {
    signatures: [[0x52, 0x49, 0x46, 0x46]], // RIFF (need to also check WEBP at offset 8)
    minLength: 12,
  },
};

// Default media configuration
export const DEFAULT_MEDIA_CONFIG: MediaConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  s3Bucket: process.env.S3_BUCKET || 'community-social-network-media',
  s3Region: process.env.AWS_REGION || 'us-east-1',
  presignedUrlExpiry: 300, // 5 minutes
  processingConfig: {
    profile_picture: {
      variants: [
        { name: 'thumbnail', width: 100, height: 100 },
        { name: 'small', width: 200, height: 200 },
        { name: 'medium', width: 400, height: 400 },
        { name: 'large', width: 800, height: 800 },
      ],
      format: 'webp',
      quality: 85,
      stripMetadata: true,
    },
    cover_image: {
      variants: [
        { name: 'small', width: 800, height: 400 },
        { name: 'medium', width: 1200, height: 600 },
        { name: 'large', width: 1600, height: 800 },
      ],
      format: 'webp',
      quality: 85,
      stripMetadata: true,
    },
    post_image: {
      variants: [
        { name: 'thumbnail', width: 300, height: 300 },
        { name: 'small', width: 640, height: 640 },
        { name: 'medium', width: 1024, height: 1024 },
        { name: 'large', width: 2048, height: 2048 },
      ],
      format: 'webp',
      quality: 80,
      stripMetadata: true,
    },
  },
};

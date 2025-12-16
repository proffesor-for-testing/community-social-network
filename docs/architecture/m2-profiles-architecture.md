# M2 User Profiles & Media System - Architecture Specification

**Version:** 1.0.0
**Phase:** SPARC Phase 3 (Architecture)
**Module:** User Profiles, Media Upload, Security
**Last Updated:** 2025-12-16
**Status:** 🏗️ ARCHITECTURE DRAFT

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Architecture](#data-architecture)
4. [Storage Architecture](#storage-architecture)
5. [Image Processing Pipeline](#image-processing-pipeline)
6. [API Architecture](#api-architecture)
7. [Security Architecture](#security-architecture)
8. [Search Architecture](#search-architecture)
9. [Sequence Diagrams](#sequence-diagrams)
10. [Technology Stack](#technology-stack)
11. [Deployment Architecture](#deployment-architecture)
12. [Performance & Scalability](#performance--scalability)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Web Client  │  │ Mobile Apps  │  │  API Client  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                               │
│  ┌────────────────────────────────────────────────────────┐         │
│  │  Kong/Nginx - Rate Limiting, Auth, CORS, Compression   │         │
│  └────────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Application Services Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Profile    │  │    Media     │  │   Security   │              │
│  │   Service    │  │   Service    │  │   Service    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
┌────────────────────┐  ┌─────────────┐  ┌──────────────┐
│    PostgreSQL      │  │   Redis     │  │  RabbitMQ    │
│  (Primary Data)    │  │  (Cache)    │  │  (Events)    │
└────────────────────┘  └─────────────┘  └──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Storage & CDN Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  AWS S3      │  │  CloudFront  │  │    Sharp     │              │
│  │  (Storage)   │  │    (CDN)     │  │ (Processing) │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### System Responsibilities

**Profile Service:**
- User profile CRUD operations
- Profile validation and sanitization
- Profile search and discovery
- Privacy settings management

**Media Service:**
- Secure file upload handling
- Image validation (type, size, dimensions)
- Virus scanning coordination
- S3 storage management
- Pre-signed URL generation
- Image processing pipeline orchestration

**Security Service:**
- File type validation (magic bytes)
- Malware detection
- Rate limiting enforcement
- Quota management
- Incident logging and monitoring

---

## Component Architecture

### Profile Service Components

```
┌────────────────────────────────────────────────────────────────┐
│                      Profile Service                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐     │
│  │              ProfileController                        │     │
│  │  - POST   /api/v1/profiles                           │     │
│  │  - GET    /api/v1/profiles/:userId                   │     │
│  │  - PUT    /api/v1/profiles/:userId                   │     │
│  │  - DELETE /api/v1/profiles/:userId                   │     │
│  │  - GET    /api/v1/profiles/search                    │     │
│  └──────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │              ProfileService                           │     │
│  │  - validateProfileData(data)                         │     │
│  │  - sanitizeInputs(data)                              │     │
│  │  - createProfile(userId, data)                       │     │
│  │  - updateProfile(userId, data)                       │     │
│  │  - searchProfiles(query, filters)                    │     │
│  └──────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │            ProfileRepository                          │     │
│  │  - findByUserId(userId)                              │     │
│  │  - create(profileData)                               │     │
│  │  - update(userId, data)                              │     │
│  │  - delete(userId)                                    │     │
│  │  - searchByDisplayName(query)                        │     │
│  └──────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │              ProfileCache                             │     │
│  │  - get(userId): Profile | null                       │     │
│  │  - set(userId, profile, ttl=300)                     │     │
│  │  - invalidate(userId)                                │     │
│  │  - invalidatePattern(pattern)                        │     │
│  └──────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
```

### Media Service Components

```
┌────────────────────────────────────────────────────────────────┐
│                       Media Service                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐     │
│  │              MediaController                          │     │
│  │  - POST   /api/v1/media/upload                       │     │
│  │  - GET    /api/v1/media/:mediaId                     │     │
│  │  - DELETE /api/v1/media/:mediaId                     │     │
│  │  - GET    /api/v1/media/presigned-url                │     │
│  └──────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │            FileUploadService                          │     │
│  │  - validateFile(file, mediaType)                     │     │
│  │  - validateMagicBytes(buffer)                        │     │
│  │  - validateDimensions(file, mediaType)               │     │
│  │  - checkQuota(userId, fileSize)                      │     │
│  │  - generateS3Key(userId, mediaType)                  │     │
│  │  - uploadToS3(file, s3Key)                           │     │
│  └──────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │         ImageProcessingService                        │     │
│  │  - processImage(s3Key, mediaType)                    │     │
│  │  - generateVariants(originalImage)                   │     │
│  │  - optimizeImage(buffer, format)                     │     │
│  │  - extractMetadata(buffer)                           │     │
│  └──────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │              S3StorageService                         │     │
│  │  - upload(key, buffer, metadata)                     │     │
│  │  - download(key): Buffer                             │     │
│  │  - delete(key)                                       │     │
│  │  - generatePresignedUrl(key, ttl)                    │     │
│  │  - copyObject(sourceKey, destKey)                    │     │
│  └──────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │            MediaRepository                            │     │
│  │  - create(mediaData)                                 │     │
│  │  - findById(mediaId)                                 │     │
│  │  - findByUser(userId, mediaType)                     │     │
│  │  - updateScanStatus(mediaId, status)                │     │
│  │  - softDelete(mediaId)                               │     │
│  └──────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
```

### Security Service Components

```
┌────────────────────────────────────────────────────────────────┐
│                     Security Service                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐     │
│  │           FileSecurityValidator                       │     │
│  │  - validateMimeType(file, allowedTypes)              │     │
│  │  - validateMagicBytes(buffer, mimeType)              │     │
│  │  - scanForMalware(s3Key): ScanResult                 │     │
│  │  - checkFileIntegrity(buffer)                        │     │
│  └──────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │             QuotaManager                              │     │
│  │  - checkQuota(userId, additionalBytes): bool         │     │
│  │  - incrementUsage(userId, bytes)                     │     │
│  │  - decrementUsage(userId, bytes)                     │     │
│  │  - getQuotaStatus(userId): QuotaStatus               │     │
│  └──────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │          IncidentLogger                               │     │
│  │  - logIncident(type, userId, details)                │     │
│  │  - logMalwareDetection(mediaId, scanResult)          │     │
│  │  - logQuotaViolation(userId, attemptedSize)          │     │
│  │  - logSuspiciousActivity(userId, pattern)            │     │
│  └──────────────────────────────────────────────────────┘     │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │           RateLimitService                            │     │
│  │  - checkRateLimit(userId, action): bool              │     │
│  │  - incrementCounter(userId, action)                  │     │
│  │  - getRemainingQuota(userId, action): int            │     │
│  └──────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
```

---

## Data Architecture

### Database Schema (PostgreSQL)

```sql
-- ============================================================
-- USER PROFILES TABLE
-- ============================================================
CREATE TABLE user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    bio TEXT CHECK (char_length(bio) <= 500),
    avatar_url VARCHAR(500),
    avatar_s3_key VARCHAR(255),
    cover_image_url VARCHAR(500),
    cover_image_s3_key VARCHAR(255),
    location VARCHAR(100),
    website VARCHAR(200),
    is_public BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_website_url CHECK (
        website IS NULL OR website ~* '^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    )
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_display_name ON user_profiles(display_name) WHERE display_name IS NOT NULL;
CREATE INDEX idx_user_profiles_is_public ON user_profiles(is_public);
CREATE INDEX idx_user_profiles_created_at ON user_profiles(created_at);

-- Full-text search index
CREATE INDEX idx_user_profiles_display_name_trgm ON user_profiles USING gin(display_name gin_trgm_ops);

-- Updated timestamp trigger
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MEDIA TABLE
-- ============================================================
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('profile_picture', 'cover_image', 'post_image')),
    original_filename VARCHAR(255) NOT NULL,
    s3_bucket VARCHAR(100) NOT NULL,
    s3_key VARCHAR(255) NOT NULL UNIQUE,
    s3_region VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER CHECK (width > 0),
    height INTEGER CHECK (height > 0),
    scan_status VARCHAR(50) DEFAULT 'pending' CHECK (
        scan_status IN ('pending', 'scanning', 'clean', 'infected', 'failed')
    ),
    virus_scan_result JSONB,
    uploaded_from INET NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT valid_s3_key CHECK (s3_key ~ '^[a-zA-Z0-9/_-]+\.[a-z0-9]+$'),
    CONSTRAINT deleted_at_consistency CHECK (
        (is_deleted = true AND deleted_at IS NOT NULL) OR
        (is_deleted = false AND deleted_at IS NULL)
    )
);

-- Indexes for performance
CREATE INDEX idx_media_user_id ON media(user_id);
CREATE INDEX idx_media_user_media_type ON media(user_id, media_type) WHERE is_deleted = false;
CREATE INDEX idx_media_scan_status ON media(scan_status) WHERE scan_status != 'clean';
CREATE INDEX idx_media_uploaded_at ON media(uploaded_at);
CREATE INDEX idx_media_s3_key ON media(s3_key) WHERE is_deleted = false;

-- Partitioning by upload date (monthly)
-- ALTER TABLE media PARTITION BY RANGE (uploaded_at);
-- CREATE TABLE media_2025_01 PARTITION OF media FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- ============================================================
-- USER QUOTA TABLE
-- ============================================================
CREATE TABLE user_quotas (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    used_bytes BIGINT DEFAULT 0 NOT NULL CHECK (used_bytes >= 0),
    quota_bytes BIGINT DEFAULT 104857600 NOT NULL, -- 100 MB default
    file_count INTEGER DEFAULT 0 NOT NULL CHECK (file_count >= 0),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT quota_not_exceeded CHECK (used_bytes <= quota_bytes * 1.1) -- 10% grace
);

-- Indexes
CREATE INDEX idx_user_quotas_used_bytes ON user_quotas(used_bytes);
CREATE INDEX idx_user_quotas_last_updated ON user_quotas(last_updated);

-- ============================================================
-- SECURITY INCIDENTS TABLE
-- ============================================================
CREATE TABLE security_incidents (
    id SERIAL PRIMARY KEY,
    incident_type VARCHAR(50) NOT NULL CHECK (
        incident_type IN ('malware_upload', 'quota_abuse', 'invalid_file_type', 'suspicious_pattern')
    ),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    details JSONB NOT NULL,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (
        status IN ('open', 'investigating', 'resolved', 'false_positive')
    ),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT resolved_at_consistency CHECK (
        (status IN ('resolved', 'false_positive') AND resolved_at IS NOT NULL) OR
        (status IN ('open', 'investigating') AND resolved_at IS NULL)
    )
);

-- Indexes
CREATE INDEX idx_security_incidents_type_status ON security_incidents(incident_type, status);
CREATE INDEX idx_security_incidents_user_id ON security_incidents(user_id);
CREATE INDEX idx_security_incidents_created_at ON security_incidents(created_at);
CREATE INDEX idx_security_incidents_severity ON security_incidents(severity) WHERE status != 'resolved';

-- Partitioning by creation date (quarterly)
-- ALTER TABLE security_incidents PARTITION BY RANGE (created_at);
```

### Entity Relationship Diagram

```
┌─────────────────────────┐
│        users            │
│─────────────────────────│
│ id (PK)                 │
│ email                   │
│ password_hash           │
│ created_at              │
└─────────────────────────┘
           │
           │ 1:1
           ▼
┌─────────────────────────┐
│    user_profiles        │
│─────────────────────────│
│ id (PK)                 │
│ user_id (FK, UNIQUE)    │◄─────────────┐
│ display_name            │              │
│ bio                     │              │
│ avatar_s3_key           │              │
│ cover_image_s3_key      │              │
│ location                │              │
│ website                 │              │
│ is_public               │              │
│ created_at              │              │
│ updated_at              │              │
└─────────────────────────┘              │
           │                              │
           │ 1:1                          │
           ▼                              │
┌─────────────────────────┐              │
│     user_quotas         │              │
│─────────────────────────│              │
│ user_id (PK, FK)        │              │
│ used_bytes              │              │
│ quota_bytes             │              │
│ file_count              │              │
│ last_updated            │              │
└─────────────────────────┘              │
           │                              │
           │ 1:N                          │
           ▼                              │
┌─────────────────────────┐              │
│        media            │              │
│─────────────────────────│              │
│ id (PK)                 │              │
│ user_id (FK)            │──────────────┘
│ media_type              │
│ s3_bucket               │
│ s3_key (UNIQUE)         │
│ file_size               │
│ mime_type               │
│ width, height           │
│ scan_status             │
│ virus_scan_result       │
│ uploaded_from           │
│ uploaded_at             │
│ is_deleted              │
└─────────────────────────┘
           │
           │ 1:N
           ▼
┌─────────────────────────┐
│  security_incidents     │
│─────────────────────────│
│ id (PK)                 │
│ incident_type           │
│ user_id (FK)            │
│ media_id (FK)           │
│ severity                │
│ details (JSON)          │
│ ip_address              │
│ status                  │
│ created_at              │
│ resolved_at             │
└─────────────────────────┘
```

---

## Storage Architecture

### S3 Bucket Structure

```
s3://community-social-network-media-prod/
├── avatars/
│   ├── original/
│   │   └── user_{userId}/
│   │       └── {timestamp}_{randomId}.{ext}
│   ├── thumbnails/
│   │   └── user_{userId}/
│   │       └── {timestamp}_{randomId}_thumb.webp
│   └── optimized/
│       └── user_{userId}/
│           └── {timestamp}_{randomId}_opt.webp
│
├── covers/
│   ├── original/
│   │   └── user_{userId}/
│   │       └── {timestamp}_{randomId}.{ext}
│   └── optimized/
│       └── user_{userId}/
│           └── {timestamp}_{randomId}_opt.webp
│
├── posts/
│   ├── original/
│   │   └── user_{userId}/
│   │       └── {timestamp}_{randomId}.{ext}
│   └── variants/
│       └── user_{userId}/
│           ├── {timestamp}_{randomId}_small.webp
│           ├── {timestamp}_{randomId}_medium.webp
│           └── {timestamp}_{randomId}_large.webp
│
└── temp/
    └── uploads/
        └── {uploadId}/
            └── {filename}
```

### S3 Configuration

```yaml
s3_configuration:
  bucket_name: "community-social-network-media-prod"
  region: "us-east-1"

  lifecycle_policies:
    - id: "delete-temp-uploads"
      prefix: "temp/uploads/"
      expiration_days: 1

    - id: "transition-old-media"
      prefix: "avatars/original/"
      transitions:
        - storage_class: "STANDARD_IA"
          days: 90
        - storage_class: "GLACIER"
          days: 365

  versioning: true
  encryption: "AES256"

  cors_configuration:
    - allowed_origins: ["https://app.example.com"]
      allowed_methods: ["GET", "PUT", "POST"]
      allowed_headers: ["*"]
      max_age_seconds: 3600

  public_access_block:
    block_public_acls: true
    ignore_public_acls: true
    block_public_policy: true
    restrict_public_buckets: true
```

### Pre-Signed URL Generation

```typescript
// Configuration
const PRESIGNED_URL_CONFIG = {
  avatar_upload: {
    expiry: 300, // 5 minutes
    max_size: 5 * 1024 * 1024, // 5 MB
    allowed_types: ['image/jpeg', 'image/png', 'image/webp']
  },
  avatar_download: {
    expiry: 3600, // 1 hour
    cache_control: 'public, max-age=31536000' // 1 year
  },
  cover_upload: {
    expiry: 300,
    max_size: 5 * 1024 * 1024,
    allowed_types: ['image/jpeg', 'image/png', 'image/webp']
  }
};

// Pre-signed URL structure
interface PresignedUrlResponse {
  url: string;            // Pre-signed S3 URL
  fields: {               // Form fields for POST upload
    key: string;
    bucket: string;
    'X-Amz-Algorithm': string;
    'X-Amz-Credential': string;
    'X-Amz-Date': string;
    'X-Amz-Security-Token'?: string;
    Policy: string;
    'X-Amz-Signature': string;
  };
  expires_at: string;     // ISO 8601 timestamp
  upload_id: string;      // Tracking ID
}
```

### CDN Integration (CloudFront)

```yaml
cloudfront_configuration:
  distribution_id: "E1ABCDEFG2HIJK"
  domain_name: "cdn.example.com"

  origins:
    - id: "s3-media-origin"
      domain_name: "community-social-network-media-prod.s3.amazonaws.com"
      origin_access_identity: "origin-access-identity/cloudfront/ABCDEFG1234567"

  cache_behaviors:
    - path_pattern: "/avatars/optimized/*"
      min_ttl: 86400        # 1 day
      default_ttl: 2592000  # 30 days
      max_ttl: 31536000     # 1 year
      compress: true
      viewer_protocol_policy: "redirect-to-https"

    - path_pattern: "/avatars/original/*"
      min_ttl: 3600         # 1 hour
      default_ttl: 86400    # 1 day
      max_ttl: 604800       # 7 days
      compress: true
      viewer_protocol_policy: "redirect-to-https"

  geo_restriction:
    restriction_type: "none"

  price_class: "PriceClass_100"  # US, Canada, Europe
```

---

## Image Processing Pipeline

### Sharp Library Integration

```typescript
// Image processing configuration
const IMAGE_PROCESSING_CONFIG = {
  profile_picture: {
    variants: [
      { name: 'thumbnail', width: 100, height: 100 },
      { name: 'small', width: 200, height: 200 },
      { name: 'medium', width: 400, height: 400 },
      { name: 'large', width: 800, height: 800 }
    ],
    format: 'webp',
    quality: 85,
    strip_metadata: true
  },
  cover_image: {
    variants: [
      { name: 'small', width: 800, height: 400 },
      { name: 'medium', width: 1200, height: 600 },
      { name: 'large', width: 1600, height: 800 }
    ],
    format: 'webp',
    quality: 85,
    strip_metadata: true
  },
  post_image: {
    variants: [
      { name: 'thumbnail', width: 300, height: 300 },
      { name: 'small', width: 640, height: 640 },
      { name: 'medium', width: 1024, height: 1024 },
      { name: 'large', width: 2048, height: 2048 }
    ],
    format: 'webp',
    quality: 80,
    strip_metadata: true
  }
};
```

### Processing Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Image Processing Pipeline                      │
│                                                                  │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐              │
│  │  Upload  │─────▶│ Validate │─────▶│  Queue   │              │
│  │  File    │      │  Image   │      │  Job     │              │
│  └──────────┘      └──────────┘      └──────────┘              │
│                          │                  │                    │
│                          │                  │                    │
│                          ▼                  ▼                    │
│                    ┌──────────┐      ┌──────────┐              │
│                    │  Scan    │      │  Worker  │              │
│                    │  Virus   │      │  Process │              │
│                    └──────────┘      └──────────┘              │
│                          │                  │                    │
│                          │                  ▼                    │
│                          │            ┌──────────┐              │
│                          │            │  Sharp   │              │
│                          │            │ Process  │              │
│                          │            └──────────┘              │
│                          │                  │                    │
│                          │            ┌─────┴─────┐             │
│                          │            │           │             │
│                          │            ▼           ▼             │
│                          │      ┌──────────┐ ┌──────────┐      │
│                          │      │ Resize   │ │ Optimize │      │
│                          │      │ Variants │ │  Format  │      │
│                          │      └──────────┘ └──────────┘      │
│                          │            │           │             │
│                          │            └─────┬─────┘             │
│                          │                  ▼                    │
│                          │            ┌──────────┐              │
│                          │            │ Upload   │              │
│                          │            │ to S3    │              │
│                          │            └──────────┘              │
│                          │                  │                    │
│                          ▼                  ▼                    │
│                    ┌──────────────────────────┐                │
│                    │  Update Database         │                │
│                    │  - Scan status           │                │
│                    │  - Variant URLs          │                │
│                    │  - Metadata              │                │
│                    └──────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### Sharp Processing Implementation

```typescript
// Image processing service using Sharp
interface ProcessingOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
  stripMetadata?: boolean;
}

interface ImageVariant {
  name: string;
  s3_key: string;
  width: number;
  height: number;
  file_size: number;
  format: string;
}

// Processing steps
const PROCESSING_STEPS = {
  1: 'Load original image from S3',
  2: 'Extract metadata (dimensions, format, color space)',
  3: 'Auto-orient based on EXIF data',
  4: 'Strip sensitive metadata',
  5: 'Generate variants (thumbnail, small, medium, large)',
  6: 'Optimize each variant (compression, format conversion)',
  7: 'Upload variants to S3',
  8: 'Update database with variant URLs',
  9: 'Invalidate CDN cache',
  10: 'Emit processing completion event'
};
```

---

## API Architecture

### Profile API Contracts

```yaml
openapi: 3.0.0
info:
  title: User Profiles & Media API
  version: 1.0.0
  description: API for managing user profiles and media uploads

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    UserProfile:
      type: object
      properties:
        id:
          type: integer
          example: 123
        userId:
          type: integer
          example: 456
        displayName:
          type: string
          maxLength: 100
          example: "John Doe"
        bio:
          type: string
          maxLength: 500
          example: "Software engineer passionate about open source"
        avatarUrl:
          type: string
          format: uri
          example: "https://cdn.example.com/avatars/user_456/avatar_opt.webp"
        coverImageUrl:
          type: string
          format: uri
          nullable: true
        location:
          type: string
          maxLength: 100
          example: "San Francisco, CA"
        website:
          type: string
          format: uri
          maxLength: 200
          example: "https://johndoe.com"
        isPublic:
          type: boolean
          default: true
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    Media:
      type: object
      properties:
        id:
          type: integer
        userId:
          type: integer
        mediaType:
          type: string
          enum: [profile_picture, cover_image, post_image]
        originalFilename:
          type: string
        s3Key:
          type: string
        fileSize:
          type: integer
          description: File size in bytes
        mimeType:
          type: string
        width:
          type: integer
        height:
          type: integer
        scanStatus:
          type: string
          enum: [pending, scanning, clean, infected, failed]
        uploadedAt:
          type: string
          format: date-time

    PresignedUploadUrl:
      type: object
      properties:
        uploadUrl:
          type: string
          format: uri
        fields:
          type: object
          additionalProperties: true
        expiresAt:
          type: string
          format: date-time
        uploadId:
          type: string
          format: uuid

    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object
        validationErrors:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string

paths:
  /profiles:
    post:
      summary: Create user profile
      operationId: createProfile
      tags: [Profiles]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                displayName:
                  type: string
                  maxLength: 100
                bio:
                  type: string
                  maxLength: 500
                location:
                  type: string
                  maxLength: 100
                website:
                  type: string
                  format: uri
                isPublic:
                  type: boolean
      responses:
        201:
          description: Profile created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserProfile'
        400:
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        409:
          description: Profile already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /profiles/{userId}:
    get:
      summary: Get user profile
      operationId: getProfile
      tags: [Profiles]
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: integer
      responses:
        200:
          description: Profile found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserProfile'
        404:
          description: Profile not found

    put:
      summary: Update user profile
      operationId: updateProfile
      tags: [Profiles]
      security:
        - bearerAuth: []
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                displayName:
                  type: string
                bio:
                  type: string
                location:
                  type: string
                website:
                  type: string
                isPublic:
                  type: boolean
      responses:
        200:
          description: Profile updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserProfile'
        403:
          description: Not authorized to update this profile
        404:
          description: Profile not found

  /media/presigned-upload-url:
    post:
      summary: Get pre-signed URL for file upload
      operationId: getPresignedUploadUrl
      tags: [Media]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [mediaType, filename, fileSize, mimeType]
              properties:
                mediaType:
                  type: string
                  enum: [profile_picture, cover_image, post_image]
                filename:
                  type: string
                fileSize:
                  type: integer
                mimeType:
                  type: string
      responses:
        200:
          description: Pre-signed URL generated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PresignedUploadUrl'
        400:
          description: Invalid request
        413:
          description: File too large or quota exceeded

  /media/{mediaId}/confirm-upload:
    post:
      summary: Confirm upload and trigger processing
      operationId: confirmUpload
      tags: [Media]
      security:
        - bearerAuth: []
      parameters:
        - name: mediaId
          in: path
          required: true
          schema:
            type: integer
      responses:
        200:
          description: Upload confirmed, processing started
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Media'
        404:
          description: Media not found
```

### Rate Limiting Configuration

```yaml
rate_limits:
  profile_updates:
    window: 3600  # 1 hour
    max_requests: 10

  media_uploads:
    window: 3600
    max_requests: 50

  presigned_url_generation:
    window: 60  # 1 minute
    max_requests: 20

  profile_search:
    window: 60
    max_requests: 30
```

---

## Security Architecture

### File Validation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   File Validation Pipeline                       │
│                                                                  │
│  1. ┌──────────────────────────────────────────────┐            │
│     │ File Extension Check                         │            │
│     │ - Extract extension from filename            │            │
│     │ - Compare against allowed extensions         │            │
│     └──────────────────────────────────────────────┘            │
│                          │                                       │
│                          ▼ PASS                                  │
│  2. ┌──────────────────────────────────────────────┐            │
│     │ MIME Type Validation                         │            │
│     │ - Check Content-Type header                  │            │
│     │ - Validate against allowed MIME types        │            │
│     └──────────────────────────────────────────────┘            │
│                          │                                       │
│                          ▼ PASS                                  │
│  3. ┌──────────────────────────────────────────────┐            │
│     │ Magic Bytes Validation                       │            │
│     │ - Read first 12 bytes of file                │            │
│     │ - Compare against known file signatures      │            │
│     │ - JPEG: 0xFF 0xD8 0xFF                       │            │
│     │ - PNG:  0x89 0x50 0x4E 0x47...               │            │
│     │ - GIF:  0x47 0x49 0x46 0x38                  │            │
│     │ - WebP: 0x52 0x49 0x46 0x46                  │            │
│     └──────────────────────────────────────────────┘            │
│                          │                                       │
│                          ▼ PASS                                  │
│  4. ┌──────────────────────────────────────────────┐            │
│     │ File Size Check                              │            │
│     │ - Verify size <= max allowed                 │            │
│     │ - Check user quota availability              │            │
│     └──────────────────────────────────────────────┘            │
│                          │                                       │
│                          ▼ PASS                                  │
│  5. ┌──────────────────────────────────────────────┐            │
│     │ Image Dimension Validation                   │            │
│     │ - Load image metadata with Sharp             │            │
│     │ - Check width/height within limits           │            │
│     │ - Validate aspect ratio (optional)           │            │
│     │ - Check total pixels <= max                  │            │
│     └──────────────────────────────────────────────┘            │
│                          │                                       │
│                          ▼ PASS                                  │
│  6. ┌──────────────────────────────────────────────┐            │
│     │ Virus Scan (Async)                           │            │
│     │ - Upload to S3 temp location                 │            │
│     │ - Queue scanning job                         │            │
│     │ - Scan with ClamAV or AWS GuardDuty          │            │
│     │ - Update scan_status in database             │            │
│     └──────────────────────────────────────────────┘            │
│                          │                                       │
│                          ▼ CLEAN                                 │
│  7. ┌──────────────────────────────────────────────┐            │
│     │ Process & Store                              │            │
│     │ - Generate variants                          │            │
│     │ - Upload to permanent S3 location            │            │
│     │ - Update profile with URLs                   │            │
│     └──────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Magic Bytes Validation

```typescript
// Magic bytes signatures
const FILE_SIGNATURES = {
  'image/jpeg': {
    signatures: [
      [0xFF, 0xD8, 0xFF, 0xE0], // JFIF
      [0xFF, 0xD8, 0xFF, 0xE1], // EXIF
      [0xFF, 0xD8, 0xFF, 0xE2], // ICC
      [0xFF, 0xD8, 0xFF, 0xDB]  // JPG
    ],
    minLength: 4
  },
  'image/png': {
    signatures: [
      [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    ],
    minLength: 8
  },
  'image/gif': {
    signatures: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]  // GIF89a
    ],
    minLength: 6
  },
  'image/webp': {
    signatures: [
      [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]
    ],
    minLength: 12
  }
};

// Validation algorithm
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signature = FILE_SIGNATURES[mimeType];
  if (!signature) return false;

  for (const pattern of signature.signatures) {
    let match = true;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] !== null && buffer[i] !== pattern[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }

  return false;
}
```

### Quota Management

```typescript
// Quota enforcement
interface QuotaStatus {
  userId: number;
  usedBytes: number;
  quotaBytes: number;
  fileCount: number;
  availableBytes: number;
  percentUsed: number;
}

const QUOTA_TIERS = {
  free: {
    quotaBytes: 100 * 1024 * 1024,  // 100 MB
    maxFileSize: 5 * 1024 * 1024     // 5 MB per file
  },
  premium: {
    quotaBytes: 1024 * 1024 * 1024,  // 1 GB
    maxFileSize: 10 * 1024 * 1024    // 10 MB per file
  },
  enterprise: {
    quotaBytes: 10 * 1024 * 1024 * 1024,  // 10 GB
    maxFileSize: 50 * 1024 * 1024          // 50 MB per file
  }
};
```

---

## Search Architecture

### Profile Search Implementation

```sql
-- Full-text search with PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Search index
CREATE INDEX idx_user_profiles_search ON user_profiles
USING gin(to_tsvector('english',
  coalesce(display_name, '') || ' ' ||
  coalesce(bio, '') || ' ' ||
  coalesce(location, '')
));

-- Trigram index for fuzzy search
CREATE INDEX idx_user_profiles_display_name_trgm
ON user_profiles USING gin(display_name gin_trgm_ops);

-- Search query
SELECT
  up.id,
  up.user_id,
  up.display_name,
  up.bio,
  up.avatar_url,
  up.location,
  ts_rank(
    to_tsvector('english',
      coalesce(up.display_name, '') || ' ' ||
      coalesce(up.bio, '') || ' ' ||
      coalesce(up.location, '')
    ),
    plainto_tsquery('english', :searchQuery)
  ) AS rank
FROM user_profiles up
WHERE
  up.is_public = true
  AND (
    to_tsvector('english',
      coalesce(up.display_name, '') || ' ' ||
      coalesce(up.bio, '') || ' ' ||
      coalesce(up.location, '')
    ) @@ plainto_tsquery('english', :searchQuery)
    OR
    similarity(up.display_name, :searchQuery) > 0.3
  )
ORDER BY rank DESC, similarity(up.display_name, :searchQuery) DESC
LIMIT :limit
OFFSET :offset;
```

### Search API

```typescript
// Search filters
interface ProfileSearchFilters {
  query: string;
  location?: string;
  isPublic?: boolean;
  hasAvatar?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'created_at' | 'display_name';
  sortOrder?: 'asc' | 'desc';
}

// Search result
interface ProfileSearchResult {
  profiles: UserProfile[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

---

## Sequence Diagrams

### 1. Profile Update Flow

```
User          API Gateway    ProfileService   ProfileRepo     Cache       Database
 │                │               │               │             │            │
 │   PUT /profiles/:id            │               │             │            │
 ├───────────────>│               │               │             │            │
 │                │  Authenticate │               │             │            │
 │                ├──────────────>│               │             │            │
 │                │               │ Validate Data │             │            │
 │                │               ├──────────────>│             │            │
 │                │               │               │             │            │
 │                │               │ Update Profile│             │            │
 │                │               ├──────────────>│  UPDATE     │            │
 │                │               │               ├────────────>│            │
 │                │               │               │  Profile    │            │
 │                │               │               │<────────────┤            │
 │                │               │<──────────────┤             │            │
 │                │               │               │  Invalidate │            │
 │                │               │               ├────────────>│            │
 │                │               │               │  Cache      │            │
 │                │               │               │<────────────┤            │
 │                │               │ Updated Profile             │            │
 │                │<──────────────┤               │             │            │
 │   200 OK       │               │               │             │            │
 │<───────────────┤               │               │             │            │
```

### 2. Avatar Upload Flow

```
User     API      MediaService  S3Storage  SecurityService  ProcessingQueue  Worker    Database
 │        │            │            │            │                │           │         │
 │ POST /media/presigned-url       │            │                │           │         │
 ├───────>│            │            │            │                │           │         │
 │        │ Check Quota│            │            │                │           │         │
 │        ├───────────>│            │            │                │           │         │
 │        │            │ Validate   │            │                │           │         │
 │        │            ├───────────>│            │                │           │         │
 │        │            │            │ Generate   │                │           │         │
 │        │            │            │ Presigned  │                │           │         │
 │        │            │            │ URL        │                │           │         │
 │        │<───────────┴────────────┤            │                │           │         │
 │ Presigned URL                    │            │                │           │         │
 │<───────┤            │            │            │                │           │         │
 │        │            │            │            │                │           │         │
 │ PUT (upload to S3)  │            │            │                │           │         │
 ├────────────────────────────────->│            │                │           │         │
 │        │            │            │ Upload OK  │                │           │         │
 │<───────────────────────────────┤│            │                │           │         │
 │        │            │            │            │                │           │         │
 │ POST /media/confirm-upload      │            │                │           │         │
 ├───────>│            │            │            │                │           │         │
 │        │ Create Media Record    │            │                │           │         │
 │        ├───────────────────────────────────────────────────────────────────>│
 │        │            │            │            │                │           │ INSERT  │
 │        │            │            │            │                │           │ Media   │
 │        │            │            │            │  Queue         │           │         │
 │        │            │            │            │  Processing    │           │         │
 │        ├────────────────────────────────────>│                │           │         │
 │ 202 Accepted       │            │            │                │           │         │
 │<───────┤            │            │            │                │           │         │
 │        │            │            │            │                │  Dequeue  │         │
 │        │            │            │            │                │<──────────┤         │
 │        │            │            │            │  Scan File     │           │         │
 │        │            │            │            │<───────────────────────────┤         │
 │        │            │            │            │  Clean        │           │         │
 │        │            │            │            │───────────────────────────>│         │
 │        │            │  Download  │            │                │           │         │
 │        │            │<───────────┤            │                │           │         │
 │        │            │  Process   │            │                │           │         │
 │        │            │  (Sharp)   │            │                │           │         │
 │        │            │  Variants  │            │                │           │         │
 │        │            │───────────>│            │                │           │         │
 │        │            │  Upload    │            │                │           │         │
 │        │            │  Variants  │            │                │           │         │
 │        │            │───────────>│            │                │           │         │
 │        │            │            │            │                │           │ UPDATE  │
 │        │            │            │            │                │           │ scan_   │
 │        │            │            │            │                │           │ status  │
 │        │            │            │            │                │           │────────>│
```

### 3. Media Processing Flow

```
Worker          S3Storage      Sharp         Database       ProfileService    CDN
 │                 │             │              │                 │            │
 │  Dequeue Job    │             │              │                 │            │
 ├────────────────>│             │              │                 │            │
 │                 │             │              │                 │            │
 │  Download       │             │              │                 │            │
 ├────────────────>│             │              │                 │            │
 │  Original Image │             │              │                 │            │
 │<────────────────┤             │              │                 │            │
 │                 │             │              │                 │            │
 │  Extract Metadata            │              │                 │            │
 ├─────────────────────────────>│              │                 │            │
 │  {width, height, format}     │              │                 │            │
 │<─────────────────────────────┤              │                 │            │
 │                 │             │              │                 │            │
 │  Generate Thumbnail          │              │                 │            │
 ├─────────────────────────────>│              │                 │            │
 │  Thumbnail Buffer            │              │                 │            │
 │<─────────────────────────────┤              │                 │            │
 │                 │             │              │                 │            │
 │  Upload Thumbnail            │              │                 │            │
 ├────────────────>│             │              │                 │            │
 │                 │             │              │                 │            │
 │  Generate Small Variant      │              │                 │            │
 ├─────────────────────────────>│              │                 │            │
 │  Small Buffer   │             │              │                 │            │
 │<─────────────────────────────┤              │                 │            │
 │                 │             │              │                 │            │
 │  Upload Small   │             │              │                 │            │
 ├────────────────>│             │              │                 │            │
 │                 │             │              │                 │            │
 │  Generate Medium Variant     │              │                 │            │
 ├─────────────────────────────>│              │                 │            │
 │  Medium Buffer  │             │              │                 │            │
 │<─────────────────────────────┤              │                 │            │
 │                 │             │              │                 │            │
 │  Upload Medium  │             │              │                 │            │
 ├────────────────>│             │              │                 │            │
 │                 │             │              │                 │            │
 │  Update Media Record         │              │                 │            │
 ├─────────────────────────────────────────────>│                 │            │
 │  (Add variant URLs)          │              │                 │            │
 │                 │             │              │                 │            │
 │  If profile_picture: Update Profile          │                 │            │
 ├──────────────────────────────────────────────────────────────>│            │
 │  (Set avatar_url)            │              │                 │            │
 │                 │             │              │                 │            │
 │  Invalidate CDN Cache        │              │                 │            │
 ├────────────────────────────────────────────────────────────────────────────>│
 │                 │             │              │                 │            │
 │  Emit Processing Complete Event (RabbitMQ)  │                 │            │
 ├─────────────────────────────>│              │                 │            │
```

---

## Technology Stack

### Backend Services

```yaml
runtime:
  language: TypeScript
  runtime: Node.js 18 LTS
  framework: NestJS 10.x

dependencies:
  core:
    - "@nestjs/common": "^10.0.0"
    - "@nestjs/core": "^10.0.0"
    - "@nestjs/platform-express": "^10.0.0"
    - "express": "^4.18.0"

  database:
    - "@prisma/client": "^5.0.0"
    - "prisma": "^5.0.0"
    - "pg": "^8.11.0"

  storage:
    - "@aws-sdk/client-s3": "^3.400.0"
    - "@aws-sdk/s3-request-presigner": "^3.400.0"
    - "@aws-sdk/client-cloudfront": "^3.400.0"

  image_processing:
    - "sharp": "^0.32.0"  # Primary image processing
    - "file-type": "^18.0.0"  # MIME type detection
    - "image-size": "^1.0.0"  # Dimension extraction

  validation:
    - "class-validator": "^0.14.0"
    - "class-transformer": "^0.5.1"
    - "joi": "^17.9.0"

  security:
    - "helmet": "^7.0.0"
    - "express-rate-limit": "^6.10.0"
    - "hpp": "^0.2.3"

  caching:
    - "ioredis": "^5.3.0"
    - "@nestjs/cache-manager": "^2.0.0"

  messaging:
    - "@nestjs/microservices": "^10.0.0"
    - "amqplib": "^0.10.0"
    - "amqp-connection-manager": "^4.1.0"

  monitoring:
    - "@opentelemetry/sdk-node": "^0.41.0"
    - "prom-client": "^14.2.0"
    - "winston": "^3.10.0"
```

### Infrastructure

```yaml
infrastructure:
  database:
    service: Amazon RDS PostgreSQL
    version: "15.3"
    instance_class: "db.t4g.medium"
    storage: "100 GB SSD"
    multi_az: true

  cache:
    service: Amazon ElastiCache Redis
    version: "7.0"
    node_type: "cache.t4g.medium"
    cluster_mode: false

  storage:
    service: Amazon S3
    storage_class: "Standard"
    versioning: true
    encryption: "AES-256"

  cdn:
    service: Amazon CloudFront
    price_class: "PriceClass_100"
    ssl_certificate: "ACM"

  queue:
    service: Amazon MQ (RabbitMQ)
    instance_type: "mq.t3.micro"
    deployment_mode: "SINGLE_INSTANCE"

  container_orchestration:
    service: Amazon ECS Fargate
    cpu: "1 vCPU"
    memory: "2 GB"
    auto_scaling: true
```

---

## Deployment Architecture

### Container Configuration

```yaml
# docker-compose.yml for local development
version: '3.8'

services:
  profile-service:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://user:pass@postgres:5432/social_network
      REDIS_URL: redis://redis:6379
      S3_BUCKET: local-media-bucket
      AWS_REGION: us-east-1
    depends_on:
      - postgres
      - redis
      - rabbitmq
    volumes:
      - ./src:/app/src
      - ./uploads:/app/uploads

  media-worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://user:pass@postgres:5432/social_network
      REDIS_URL: redis://redis:6379
      RABBITMQ_URL: amqp://rabbitmq:5672
      S3_BUCKET: local-media-bucket
    depends_on:
      - postgres
      - redis
      - rabbitmq

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: social_network
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
```

### Kubernetes Deployment

```yaml
# k8s/profile-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: profile-service
  labels:
    app: profile-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: profile-service
  template:
    metadata:
      labels:
        app: profile-service
    spec:
      containers:
      - name: profile-service
        image: profile-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: profile-service
spec:
  selector:
    app: profile-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: profile-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: profile-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Performance & Scalability

### Caching Strategy

```yaml
cache_layers:
  cdn_cache:
    ttl: 2592000  # 30 days for optimized images
    cache_control: "public, max-age=2592000, immutable"

  api_gateway_cache:
    ttl: 60  # 1 minute for profile data
    cache_key: "profile:{userId}"

  application_cache:
    profile_data:
      ttl: 300  # 5 minutes
      key_pattern: "profile:{userId}"
      invalidate_on: ["profile.updated", "profile.deleted"]

    media_metadata:
      ttl: 3600  # 1 hour
      key_pattern: "media:{mediaId}"
      invalidate_on: ["media.processed", "media.deleted"]

    quota_status:
      ttl: 60  # 1 minute
      key_pattern: "quota:{userId}"
      invalidate_on: ["media.uploaded", "media.deleted"]
```

### Database Optimization

```sql
-- Connection pooling configuration
-- pgBouncer or application-level pooling
pool_config:
  min_connections: 10
  max_connections: 100
  connection_timeout: 30000
  idle_timeout: 600000

-- Query optimization
-- 1. Use EXPLAIN ANALYZE for slow queries
EXPLAIN ANALYZE
SELECT * FROM user_profiles WHERE display_name ILIKE '%john%';

-- 2. Add covering indexes
CREATE INDEX idx_user_profiles_covering
ON user_profiles(user_id)
INCLUDE (display_name, avatar_url, is_public);

-- 3. Partition large tables
ALTER TABLE security_incidents PARTITION BY RANGE (created_at);
CREATE TABLE security_incidents_2025_q1 PARTITION OF security_incidents
  FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
```

### Scalability Targets

```yaml
performance_targets:
  api_response_times:
    p50: "< 100ms"
    p95: "< 300ms"
    p99: "< 500ms"

  throughput:
    profile_reads: "10,000 req/sec"
    profile_updates: "1,000 req/sec"
    media_uploads: "500 req/sec"

  availability: "99.9%"

  database:
    max_connections: 1000
    read_replicas: 3
    connection_pool: 100

  image_processing:
    max_concurrent_jobs: 50
    processing_time: "< 5 seconds per image"
    queue_latency: "< 1 second"
```

---

## Monitoring & Observability

```yaml
metrics:
  application:
    - http_request_duration_seconds
    - http_requests_total
    - active_connections
    - db_query_duration_seconds
    - cache_hit_rate
    - upload_file_size_bytes
    - image_processing_duration_seconds

  business:
    - profiles_created_total
    - profiles_updated_total
    - media_uploads_total
    - media_uploads_failed_total
    - quota_exceeded_total
    - malware_detected_total

  infrastructure:
    - cpu_utilization
    - memory_utilization
    - disk_io_operations
    - network_bytes_transmitted
    - s3_request_count
    - cloudfront_requests

alerts:
  - name: HighErrorRate
    condition: error_rate > 5%
    severity: critical

  - name: SlowAPIResponse
    condition: p95_latency > 500ms
    severity: warning

  - name: MalwareDetected
    condition: malware_count > 0
    severity: critical

  - name: QuotaExceeded
    condition: quota_exceeded_rate > 10%
    severity: warning
```

---

## Appendix

### File Type Configuration

```typescript
export const ALLOWED_FILE_TYPES = {
  'image/jpeg': {
    extensions: ['jpg', 'jpeg'],
    magicBytes: [[0xFF, 0xD8, 0xFF]],
    maxSize: 5 * 1024 * 1024,
    description: 'JPEG Image'
  },
  'image/png': {
    extensions: ['png'],
    magicBytes: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    maxSize: 5 * 1024 * 1024,
    description: 'PNG Image'
  },
  'image/gif': {
    extensions: ['gif'],
    magicBytes: [[0x47, 0x49, 0x46, 0x38]],
    maxSize: 2 * 1024 * 1024,
    description: 'GIF Image'
  },
  'image/webp': {
    extensions: ['webp'],
    magicBytes: [[0x52, 0x49, 0x46, 0x46]],
    maxSize: 3 * 1024 * 1024,
    description: 'WebP Image'
  }
};
```

---

**Document Status**: ARCHITECTURE DRAFT
**Next Phase**: SPARC Phase 4 (Refinement) - TDD Implementation
**Generated**: 2025-12-16
**Total Lines**: ~790

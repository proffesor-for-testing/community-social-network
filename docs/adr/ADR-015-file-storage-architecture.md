# ADR-015: File Storage Architecture

**Status**: Accepted
**Date**: 2026-02-05
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-007 (Bounded Contexts), ADR-008 (Aggregate Design / MediaAsset), ADR-009 (Domain Events / Bull Queue), ADR-011 (Deployment Infrastructure), ADR-012 (Observability), ADR-013 (Data Privacy / GDPR)

## Context

ADR-008 defines a `MediaAsset` aggregate in the Profile context with file upload, magic bytes validation, and 4 image variants (thumbnail 100px, small 200px, medium 400px, large 800px). ADR-007 assigns the Profile context as the owner of media assets and defines `MediaAsset` as a core domain concept with storage quotas. The Content context references media by ID for post attachments (max 4 per post, per `MediaLimits.MAX_MEDIA_PER_POST` in ADR-008).

However, no ADR specifies: (1) where files are physically stored, (2) how files are processed into variants, (3) how files are served to clients, (4) how storage quotas are enforced, (5) how orphaned files are cleaned up, or (6) how local development works without AWS. Without this ADR, the `MediaAsset` aggregate cannot be implemented.

## Decision

We adopt **S3-compatible object storage** with **MinIO** for development, **AWS S3** for production, **Sharp** for image processing, and **CloudFront** CDN for delivery.

### 1. Storage Architecture

```
  Client (Upload)                              Client (Read)
       |                                            ^
       v                                            |
  +--------------------+                  +--------------------+
  |   API Gateway      |                  |   CloudFront CDN   |
  |   POST /api/v1/    |                  |   max-age=1yr,     |
  |   media/upload     |                  |   immutable        |
  +--------+-----------+                  +--------+-----------+
           |                                       ^
           v                                       |
  +--------------------+                  +--------------------+
  | MediaUploadService |                  |  csn-media-public  |
  | 1. Validate        |                  |  (S3 Bucket)       |
  | 2. Check quota     |                  +--------+-----------+
  | 3. Store original  |                           ^
  | 4. Queue process   |                           | (variants)
  +--------+-----------+                  +--------+-----------+
           |                              | ImageProcessing    |
           v                              | Worker (Sharp)     |
  +--------------------+                  | 100/200/400/800px  |
  | csn-media-originals| MediaUploaded   +--------+-----------+
  | (S3 / PRIVATE)     |   Event                  ^
  +--------+-----------+                           |
           |               +--------------------+  |
           +-------------->| Bull Queue         +--+
                           | 'media-process'    |
                           +--------------------+
```

**Buckets**:

| Bucket | Purpose | Access | Lifecycle |
|--------|---------|--------|-----------|
| `csn-media-originals` | Raw uploads | Private (API only) | Glacier after 90 days |
| `csn-media-public` | Processed variants | Public via CloudFront | No expiration |

**File naming**: `{context}/{userId}/{mediaId}.{ext}` and `{context}/{userId}/{mediaId}-{variant}.jpg`. Allowed context prefixes: `avatars`, `posts`, `groups`.

---

### 2. Upload Pipeline

Validation: magic bytes check (not just extension), max 10 MB, allowed MIME types (ADR-008 `MediaLimits`). Upload via `POST /api/v1/media/upload` (multipart/form-data). Returns `201 { mediaId, status: "processing" }` immediately.

```typescript
// src/application/profile/services/MediaUploadService.ts

export class MediaUploadService {
  constructor(
    private readonly s3Client: S3Client,
    private readonly mediaRepository: MediaAssetRepository,
    private readonly quotaService: StorageQuotaService,
    private readonly processingQueue: Queue,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async upload(memberId: string, file: UploadedFile, context: 'avatars' | 'posts' | 'groups') {
    // 1. Domain validation via MediaAsset.create() (ADR-008 invariants)
    const mediaId = randomUUID();
    const mediaAsset = MediaAsset.create(MediaId.from(mediaId), MemberId.from(memberId), file);

    // 2. Quota check
    const quota = await this.quotaService.checkQuota(memberId, file.size);
    if (!quota.allowed) throw new MediaQuotaExceededError(memberId, quota.used, quota.limit);

    // 3. Upload original to private bucket
    const s3Key = `${context}/${memberId}/${mediaId}.${file.extension}`;
    await this.s3Client.send(new PutObjectCommand({
      Bucket: 'csn-media-originals', Key: s3Key,
      Body: file.buffer, ContentType: file.mimeType,
    }));

    // 4. Persist aggregate + update quota + queue processing
    await this.mediaRepository.save(mediaAsset);
    await this.quotaService.incrementUsage(memberId, file.size);
    await this.processingQueue.add('process-image',
      { mediaId, memberId, s3Key, context, mimeType: file.mimeType },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
    await this.eventPublisher.publish(
      new MediaUploadedEvent(mediaId, memberId, file.mimeType, file.size),
    );
    return { mediaId, status: 'processing' };
  }
}
```

**Magic bytes validation** reads the first bytes of the file buffer, not the extension:

```typescript
// src/domain/profile/value-objects/MagicBytes.ts

const MAGIC_BYTES: Record<string, Buffer> = {
  'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  'image/png':  Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  'image/gif':  Buffer.from([0x47, 0x49, 0x46]),
  'image/webp': Buffer.from([0x52, 0x49, 0x46, 0x46]),  // + bytes 8-11 = 'WEBP'
};

export function validateMagicBytes(buffer: Buffer, declaredMimeType: string): boolean {
  const expected = MAGIC_BYTES[declaredMimeType];
  if (!expected) return false;
  if (declaredMimeType === 'image/webp') {
    return buffer.subarray(0, 4).equals(expected)
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return buffer.subarray(0, expected.length).equals(expected);
}
```

**Processing worker** generates 4 variants using Sharp, uploads to public bucket, emits `MediaProcessedEvent`:

```typescript
// src/infrastructure/profile/workers/ImageProcessingWorker.ts

const VARIANTS = [
  { name: 'thumbnail', width: 100 }, { name: 'small', width: 200 },
  { name: 'medium',    width: 400 }, { name: 'large', width: 800 },
] as const;

export class ImageProcessingWorker {
  async process(job: Job<{ mediaId: string; memberId: string; s3Key: string; context: string }>) {
    const { mediaId, memberId, s3Key, context } = job.data;
    const original = await this.s3Client.send(new GetObjectCommand({
      Bucket: 'csn-media-originals', Key: s3Key,
    }));
    const buffer = await streamToBuffer(original.Body);

    const results = await Promise.all(VARIANTS.map(async (v) => {
      const processed = await sharp(buffer)
        .resize(v.width, v.width, { fit: 'cover', withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true }).toBuffer();
      const key = `${context}/${memberId}/${mediaId}-${v.name}.jpg`;
      await this.s3Client.send(new PutObjectCommand({
        Bucket: 'csn-media-public', Key: key, Body: processed,
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      return { name: v.name, width: v.width, key, size: processed.length };
    }));

    const asset = await this.mediaRepository.findById(MediaId.from(mediaId));
    asset.markProcessed(results);
    await this.mediaRepository.save(asset);
    await this.eventPublisher.publish(new MediaProcessedEvent(mediaId, memberId, results));
  }
}
```

`MediaProcessedEvent` follows the naming convention from ADR-009: `profile.media_processed`.

---

### 3. CDN Configuration

CloudFront serves `csn-media-public`. All objects use `Cache-Control: public, max-age=31536000, immutable` because paths are content-addressed (UUID-based). Updating an avatar creates a new path; the old one is cleaned up by the orphan job.

**URL format**: `https://cdn.example.com/{context}/{userId}/{mediaId}-{variant}.jpg`

**Signed URLs** for private content (group-only posts, friends-only profiles):

```typescript
// src/infrastructure/profile/services/SignedUrlService.ts
export class SignedUrlService {
  generateSignedUrl(s3Key: string, expiresInSeconds: number = 3600): string {
    const url = `https://${this.cfDistributionDomain}/${s3Key}`;
    return this.cfSigner.getSignedUrl({ url,
      dateLessThan: new Date(Date.now() + expiresInSeconds * 1000) });
  }
}
```

| Content Visibility | URL Type | Expiry |
|--------------------|----------|--------|
| Public posts/profiles | Unsigned CDN URL | N/A (immutable) |
| Private group posts | Signed CloudFront URL | 1 hour |
| Friends-only profiles | Signed CloudFront URL | 1 hour |

---

### 4. Storage Quotas

| Tier | Limit | Default |
|------|-------|---------|
| Free | 100 MB per user | Yes |

```sql
CREATE TABLE storage_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(50) NOT NULL DEFAULT 'free',
    storage_limit_bytes BIGINT NOT NULL DEFAULT 104857600,
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    file_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id)
);
```

Enforcement: check before upload, reject with HTTP 413 and error code `MEDIA_QUOTA_EXCEEDED`. Quota updates use atomic PostgreSQL increment (`SET storage_used_bytes = storage_used_bytes + $1`) to prevent race conditions.

---

### 5. Development Setup (MinIO)

MinIO provides S3-compatible storage locally. Console at `localhost:9001`.

```yaml
# docker-compose.yml (addition to ADR-011 services)
  minio:
    image: minio/minio:latest
    ports: ['9000:9000', '9001:9001']
    environment: { MINIO_ROOT_USER: minioadmin, MINIO_ROOT_PASSWORD: minioadmin }
    command: server /data --console-address ":9001"
    volumes: [minio_data:/data]
    healthcheck: { test: ['CMD', 'mc', 'ready', 'local'], interval: 10s, timeout: 5s, retries: 5 }
  minio-init:
    image: minio/mc:latest
    depends_on: { minio: { condition: service_healthy } }
    entrypoint: >
      /bin/sh -c "mc alias set local http://minio:9000 minioadmin minioadmin;
      mc mb --ignore-existing local/csn-media-originals;
      mc mb --ignore-existing local/csn-media-public;
      mc anonymous set download local/csn-media-public;"
```

Same `@aws-sdk/client-s3` code works for both via endpoint configuration:

```typescript
// src/infrastructure/config/s3.config.ts
export function createS3Client(): S3Client {
  if (process.env.NODE_ENV === 'development') {
    return new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: 'us-east-1', forcePathStyle: true,
      credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' },
    });
  }
  return new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
}
```

| Variable | Dev | Prod |
|----------|-----|------|
| `S3_ENDPOINT` | `http://minio:9000` | Not set (AWS default) |
| `S3_ORIGINALS_BUCKET` | `csn-media-originals` | `csn-media-originals` |
| `S3_PUBLIC_BUCKET` | `csn-media-public` | `csn-media-public` |
| `CDN_BASE_URL` | `http://localhost:9000/csn-media-public` | `https://cdn.example.com` |

---

### 6. Cleanup Strategy

**Orphaned media**: files not referenced by any post/profile after 24 hours. Daily job (01:00 UTC) moves them to a `trash/` prefix. **Trash cleanup**: daily job (02:00 UTC) permanently deletes trash older than 7 days. **User deletion** (ADR-013): `UserErasureMediaHandler` listens for `UserDataErasedEvent` and deletes all user files from both S3 buckets immediately.

```typescript
// src/infrastructure/profile/handlers/UserErasureMediaHandler.ts
export class UserErasureMediaHandler implements EventHandler<UserDataErasedEvent> {
  async handle(event: UserDataErasedEvent): Promise<void> {
    const memberId = event.originalMemberId;
    for (const bucket of ['csn-media-originals', 'csn-media-public']) {
      for (const ctx of ['avatars', 'posts', 'groups']) {
        await this.deleteAllWithPrefix(bucket, `${ctx}/${memberId}/`);
      }
    }
    await this.mediaRepository.deleteAllByOwner(memberId);
    await this.quotaRepository.deleteByUserId(memberId);
  }
}
```

| Job | Schedule | Action |
|-----|----------|--------|
| `OrphanedMediaCleanupJob` | Daily 01:00 UTC | Move unreferenced media to trash/ prefix |
| `TrashCleanupJob` | Daily 02:00 UTC | Delete trash older than 7 days |
| `UserErasureMediaHandler` | On `UserDataErasedEvent` | Delete all user media immediately |

---

### 7. Performance Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Upload (5 MB file) | < 2 seconds | API request to 201 response |
| Processing (4 variants) | < 10 seconds | Bull Queue job duration |
| CDN delivery (cache hit) | < 100 ms | CloudFront edge response |
| CDN delivery (cache miss) | < 500 ms | CloudFront origin fetch |
| Quota check | < 10 ms | PostgreSQL indexed lookup |

**Observability metrics** (ADR-012): `media_upload_duration_seconds` (histogram), `media_processing_duration_seconds` (histogram), `media_processing_errors_total` (counter), `media_storage_quota_used_bytes` (gauge), `media_orphan_cleanup_count` (counter).

---

## Alternatives Considered

### Option A: Local Filesystem (Rejected)

Store files in `/var/uploads`. Simplest approach but **does not scale horizontally** -- files on Pod 1 are invisible to Pod 2 (ADR-011 defines 2-6 pods). No CDN integration, no redundancy. Kubernetes PersistentVolumes add complexity without solving cross-pod access. **Rejected**: incompatible with multi-pod deployment.

### Option B: Cloudinary / Imgix (Rejected)

Managed image processing and CDN. Zero infrastructure management, on-the-fly transforms, built-in CDN. However: **vendor lock-in** (proprietary API, migration requires re-uploading all assets), cost at scale ($99+/month for 100K+ transforms), and **GDPR compliance risk** (user photos on third-party infrastructure complicates data controller obligations per ADR-013). **Rejected**: lock-in and compliance risk outweigh convenience.

### Option C: Database BLOBs (Rejected)

Store files as `BYTEA` in PostgreSQL. Single data store, transactional consistency. However: **terrible performance** (serving images through DB adds load), database bloat (10K users x 10 images x 2 MB = 200 GB destroys VACUUM performance), no CDN, and connection pool exhaustion (BLOB reads hold connections). **Rejected**: file serving is not a database workload.

---

## Consequences

### Positive

- **Horizontal scaling**: S3 is accessible from all API pods without shared filesystem
- **Performance**: CDN edge caching delivers images in < 100ms globally
- **Cost efficiency**: S3 at $0.023/GB/month; CloudFront at $0.085/GB for first 10 TB
- **Dev parity**: MinIO mirrors S3 API exactly; no code changes between environments
- **GDPR compliance**: Files deleted as part of erasure flow (ADR-013)
- **Domain integrity**: MediaAsset aggregate (ADR-008) backed by infrastructure without domain leakage

### Negative

- **Infrastructure complexity**: Two additional services (S3/MinIO + CloudFront)
- **Eventual consistency**: Users see "processing" status for up to 10 seconds
- **Cost scaling**: CDN and storage costs grow with content volume
- **S3 dependency**: S3 outage prevents uploads (reads continue from CDN cache)

### Mitigation

| Risk | Mitigation |
|------|------------|
| Processing delay | Return mediaId immediately; client listens for `MediaProcessedEvent` via WebSocket (ADR-009) |
| S3 upload failure | Bull Queue retries (3 attempts, exponential backoff); `media_processing_errors_total` metric |
| CDN invalidation | Content-addressed URLs make invalidation unnecessary; new content gets new URLs |
| Orphaned files | Daily cleanup with 7-day trash recovery window |
| Quota race condition | Atomic PostgreSQL increment; no read-then-write pattern |

## References

- ADR-007: Bounded Contexts -- Profile context owns MediaAsset and Quota
- ADR-008: Aggregate Design -- MediaAsset aggregate, MediaVariant, MediaLimits
- ADR-009: Domain Events -- MediaUploadedEvent, Bull Queue, event publishing
- ADR-011: Deployment Infrastructure -- Docker Compose, Kubernetes pods
- ADR-012: Observability -- Metric naming, histogram/counter/gauge patterns
- ADR-013: Data Privacy / GDPR -- UserDataErasedEvent, erasure flow
- AWS S3: https://docs.aws.amazon.com/AmazonS3/latest/userguide/
- Sharp: https://sharp.pixelplumbing.com/
- MinIO: https://min.io/docs/
- CloudFront Signed URLs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html

# File Upload Security Specifications
## Community Social Network - Milestone 2 (User Profiles)

**Document Version:** 1.0.0
**Last Updated:** 2025-12-04
**Classification:** CRITICAL SECURITY
**Status:** Draft - Awaiting Implementation

---

## Executive Summary

This document defines comprehensive security requirements for file upload functionality in the Community Social Network platform. The specifications address CRITICAL vulnerability #4 identified in the validation report: malicious file upload prevention affecting profile pictures, group images, and future media uploads.

**Risk Level:** HIGH - Potential for malware distribution, server compromise, data exfiltration
**Affected Features:** User profile pictures, group images, event banners, future media uploads
**Implementation Priority:** IMMEDIATE (Before Milestone 2 completion)

---

## Table of Contents

1. [File Validation Requirements](#1-file-validation-requirements)
2. [Malware Scanning Architecture](#2-malware-scanning-architecture)
3. [Storage Security Configuration](#3-storage-security-configuration)
4. [Image Processing Security](#4-image-processing-security)
5. [Rate Limiting & Quota Management](#5-rate-limiting--quota-management)
6. [Security Test Scenarios](#6-security-test-scenarios)
7. [Incident Response Procedures](#7-incident-response-procedures)
8. [Implementation Checklist](#8-implementation-checklist)

---

## 1. File Validation Requirements

### 1.1 Magic Byte Validation

**Requirement:** All uploaded files MUST be validated using magic byte (file signature) analysis, NOT extension checking alone.

#### Supported File Types & Magic Bytes

| File Type | MIME Type | Magic Bytes (Hex) | Max Size |
|-----------|-----------|-------------------|----------|
| JPEG | image/jpeg | `FF D8 FF` | 5 MB |
| PNG | image/png | `89 50 4E 47 0D 0A 1A 0A` | 5 MB |
| GIF | image/gif | `47 49 46 38 37 61` or `47 49 46 38 39 61` | 2 MB |
| WebP | image/webp | `52 49 46 46 ?? ?? ?? ?? 57 45 42 50` | 3 MB |
| AVIF | image/avif | `00 00 00 ?? 66 74 79 70 61 76 69 66` | 3 MB |

**Explicitly BLOCKED File Types:**
- SVG (XSS risks, code execution)
- TIFF (ImageTragick vulnerabilities)
- BMP (oversized, no compression)
- ICO (limited use case, security risks)
- Executable files (.exe, .dll, .sh, .bat, .cmd)
- Archive files (.zip, .rar, .tar, .gz)
- Document files (.pdf, .doc, .xls)

#### Implementation Example (Node.js)

```javascript
// File: src/security/file-validation.js
const fileType = require('file-type');
const fs = require('fs').promises;

const ALLOWED_TYPES = {
  'image/jpeg': { ext: ['jpg', 'jpeg'], maxSize: 5 * 1024 * 1024 },
  'image/png': { ext: ['png'], maxSize: 5 * 1024 * 1024 },
  'image/gif': { ext: ['gif'], maxSize: 2 * 1024 * 1024 },
  'image/webp': { ext: ['webp'], maxSize: 3 * 1024 * 1024 },
  'image/avif': { ext: ['avif'], maxSize: 3 * 1024 * 1024 }
};

async function validateFileSignature(filePath) {
  const buffer = await fs.readFile(filePath);

  // Check magic bytes
  const detectedType = await fileType.fromBuffer(buffer);

  if (!detectedType) {
    throw new Error('Unable to determine file type - file may be corrupted or invalid');
  }

  // Verify against whitelist
  if (!ALLOWED_TYPES[detectedType.mime]) {
    throw new Error(`File type ${detectedType.mime} is not allowed`);
  }

  // Verify file size
  const maxSize = ALLOWED_TYPES[detectedType.mime].maxSize;
  if (buffer.length > maxSize) {
    throw new Error(`File size ${buffer.length} exceeds maximum ${maxSize}`);
  }

  return {
    mime: detectedType.mime,
    ext: detectedType.ext,
    size: buffer.length,
    valid: true
  };
}

module.exports = { validateFileSignature };
```

### 1.2 MIME Type Verification

**Requirement:** Cross-validate MIME type from three sources:
1. Magic byte detection (primary)
2. HTTP Content-Type header (secondary)
3. File extension (tertiary, informational only)

All three MUST be consistent. Mismatches indicate potential spoofing attacks.

```javascript
// File: src/security/mime-validation.js
function verifyMimeConsistency(detectedMime, contentType, filename) {
  const extension = filename.split('.').pop().toLowerCase();

  // Extract MIME from Content-Type header (may include charset)
  const headerMime = contentType.split(';')[0].trim();

  // Check magic byte MIME matches header
  if (detectedMime !== headerMime) {
    throw new Error(
      `MIME type mismatch: detected ${detectedMime} but header says ${headerMime}`
    );
  }

  // Check extension matches MIME type
  const allowedExts = ALLOWED_TYPES[detectedMime].ext;
  if (!allowedExts.includes(extension)) {
    throw new Error(
      `File extension .${extension} does not match MIME type ${detectedMime}`
    );
  }

  return true;
}
```

### 1.3 File Size Limits

**Per-File Limits:**
- Profile pictures: 5 MB
- Group images: 5 MB
- Event banners: 5 MB
- Future media uploads: 10 MB (configurable)

**Per-User Storage Quota:**
- Free tier: 100 MB total
- Premium tier: 1 GB total (future enhancement)

**Enforcement:**
- Frontend validation (user experience)
- Backend validation (security enforcement)
- Database tracking of user storage usage

### 1.4 Image Dimension Limits

**Requirement:** Prevent oversized images that could cause DoS via memory exhaustion.

| Image Type | Min Dimensions | Max Dimensions | Aspect Ratio |
|------------|---------------|----------------|--------------|
| Profile Picture | 100x100 | 4096x4096 | 1:1 to 4:3 |
| Group Image | 200x200 | 4096x4096 | Any |
| Event Banner | 400x200 | 4096x2048 | 2:1 to 3:1 |

```javascript
// File: src/security/image-dimensions.js
const sharp = require('sharp');

async function validateImageDimensions(filePath, imageType) {
  const metadata = await sharp(filePath).metadata();

  const limits = {
    profile: { minW: 100, minH: 100, maxW: 4096, maxH: 4096 },
    group: { minW: 200, minH: 200, maxW: 4096, maxH: 4096 },
    banner: { minW: 400, minH: 200, maxW: 4096, maxH: 2048 }
  };

  const limit = limits[imageType];

  if (metadata.width < limit.minW || metadata.height < limit.minH) {
    throw new Error('Image dimensions too small');
  }

  if (metadata.width > limit.maxW || metadata.height > limit.maxH) {
    throw new Error('Image dimensions too large');
  }

  // Check for decompression bomb (pixel count)
  const pixelCount = metadata.width * metadata.height;
  const MAX_PIXELS = 25_000_000; // 25 megapixels

  if (pixelCount > MAX_PIXELS) {
    throw new Error('Image has too many pixels - potential decompression bomb');
  }

  return metadata;
}
```

---

## 2. Malware Scanning Architecture

### 2.1 Scanning Strategy

**Approach:** Multi-layered defense with ClamAV local scanning + VirusTotal API for high-risk files.

**Scanning Workflow:**
```
Upload Request
    ↓
Initial Validation (magic bytes, size, dimensions)
    ↓
Quarantine Storage (temporary S3 bucket)
    ↓
ClamAV Scan (synchronous, < 5 seconds)
    ↓
   Pass → Image Re-encoding → Production Storage
    ↓
   Fail → Quarantine → Alert → Reject Upload
    ↓
High Risk File? → VirusTotal API (async) → Secondary Validation
```

### 2.2 ClamAV Integration

**Installation:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install clamav clamav-daemon

# Update virus definitions
sudo freshclam

# Start daemon
sudo systemctl start clamav-daemon
```

**Node.js Integration:**
```javascript
// File: src/security/malware-scanner.js
const { NodeClam } = require('clamscan');
const logger = require('../utils/logger');

const clamScanner = new NodeClam({
  clamdscan: {
    socket: '/var/run/clamav/clamd.ctl',
    timeout: 60000,
    multiscan: true
  },
  preference: 'clamdscan'
});

async function scanFileForMalware(filePath) {
  try {
    const { isInfected, viruses } = await clamScanner.isInfected(filePath);

    if (isInfected) {
      logger.warn('Malware detected', {
        file: filePath,
        viruses
      });

      // Move to quarantine
      await quarantineFile(filePath, viruses);

      return {
        safe: false,
        viruses,
        action: 'quarantined'
      };
    }

    return { safe: true };

  } catch (error) {
    logger.error('ClamAV scan failed', { error: error.message });

    // Fail secure - reject upload if scan fails
    throw new Error('Unable to verify file safety - upload rejected');
  }
}

async function quarantineFile(filePath, viruses) {
  const quarantinePath = `/var/quarantine/${Date.now()}_${path.basename(filePath)}`;

  // Move file to quarantine
  await fs.rename(filePath, quarantinePath);

  // Log incident
  await db.securityIncidents.create({
    type: 'malware_upload_attempt',
    filePath: quarantinePath,
    viruses: viruses.join(', '),
    timestamp: new Date(),
    status: 'quarantined'
  });

  // Alert security team
  await alertSecurityTeam({
    severity: 'high',
    type: 'malware_upload',
    details: { filePath, viruses }
  });
}

module.exports = { scanFileForMalware };
```

### 2.3 VirusTotal Integration (Secondary)

**Use Case:** High-risk files (unusual patterns, large files, user reports)

```javascript
// File: src/security/virustotal-scanner.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const VIRUSTOTAL_URL = 'https://www.virustotal.com/api/v3';

async function scanWithVirusTotal(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  try {
    // Submit file for analysis
    const uploadResponse = await axios.post(
      `${VIRUSTOTAL_URL}/files`,
      form,
      {
        headers: {
          'x-apikey': VIRUSTOTAL_API_KEY,
          ...form.getHeaders()
        }
      }
    );

    const analysisId = uploadResponse.data.data.id;

    // Wait for analysis (polling)
    let attempts = 0;
    while (attempts < 10) {
      await sleep(5000); // Wait 5 seconds

      const analysisResponse = await axios.get(
        `${VIRUSTOTAL_URL}/analyses/${analysisId}`,
        {
          headers: { 'x-apikey': VIRUSTOTAL_API_KEY }
        }
      );

      const status = analysisResponse.data.data.attributes.status;

      if (status === 'completed') {
        const stats = analysisResponse.data.data.attributes.stats;

        return {
          malicious: stats.malicious,
          suspicious: stats.suspicious,
          safe: stats.malicious === 0 && stats.suspicious === 0
        };
      }

      attempts++;
    }

    throw new Error('VirusTotal analysis timeout');

  } catch (error) {
    logger.error('VirusTotal scan failed', { error: error.message });
    // Don't fail upload if VT is down - primary scan already passed
    return { safe: true, skipped: true };
  }
}
```

### 2.4 Scan Timing

**Synchronous Scanning (Blocks Upload):**
- ClamAV local scan (< 5 seconds)
- File validation (< 1 second)
- Image dimensions check (< 1 second)

**Asynchronous Scanning (Post-Upload):**
- VirusTotal API (30-60 seconds)
- If fails: Remove from production, notify user, quarantine

**User Experience:**
```
1. User uploads file → "Processing..."
2. Synchronous scans complete → "Upload successful!"
3. File available immediately
4. Async VirusTotal scan runs in background
5. If fails: Email notification, file removed, refund upload quota
```

---

## 3. Storage Security Configuration

### 3.1 AWS S3 Bucket Architecture

**Three-Bucket Strategy:**

1. **Upload Quarantine Bucket** (`csn-uploads-quarantine`)
   - Temporary storage during validation
   - Lifecycle: Delete after 24 hours
   - No public access
   - Server-side encryption enabled

2. **Production Storage Bucket** (`csn-media-production`)
   - Validated, safe files only
   - Private by default
   - CloudFront CDN distribution
   - Pre-signed URLs for access

3. **Quarantine Archive Bucket** (`csn-security-quarantine`)
   - Infected/suspicious files
   - Long-term retention (90 days)
   - Strict access controls
   - Audit logging enabled

### 3.2 S3 Bucket Policy (Production)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::csn-media-production",
        "arn:aws:s3:::csn-media-production/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    },
    {
      "Sid": "DenyUnencryptedObjectUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::csn-media-production/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    },
    {
      "Sid": "AllowCloudFrontAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity EXAMPLE"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::csn-media-production/*"
    },
    {
      "Sid": "AllowApplicationUpload",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:role/csn-application-role"
      },
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::csn-media-production/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    }
  ]
}
```

### 3.3 Encryption Configuration

**At Rest:**
- Server-side encryption with AES-256 (SSE-S3)
- Automatic encryption for all new objects
- KMS encryption for sensitive metadata (future enhancement)

**In Transit:**
- TLS 1.2+ required for all connections
- CloudFront HTTPS-only distribution
- Pre-signed URLs with HTTPS enforcement

```javascript
// File: src/storage/s3-client.js
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  signatureVersion: 'v4',
  sslEnabled: true
});

async function uploadToS3(bucket, key, fileBuffer, metadata) {
  const params = {
    Bucket: bucket,
    Key: key,
    Body: fileBuffer,
    ServerSideEncryption: 'AES256',
    ContentType: metadata.mimeType,
    Metadata: {
      originalName: metadata.originalName,
      uploadedBy: metadata.userId,
      scanStatus: 'validated',
      uploadDate: new Date().toISOString()
    },
    ACL: 'private' // Never use public-read
  };

  const result = await s3.upload(params).promise();
  return result.Location;
}

function generatePresignedUrl(bucket, key, expiresIn = 3600) {
  return s3.getSignedUrl('getObject', {
    Bucket: bucket,
    Key: key,
    Expires: expiresIn, // Default: 1 hour
    ResponseContentDisposition: 'inline' // Prevent download prompt
  });
}

module.exports = { uploadToS3, generatePresignedUrl };
```

### 3.4 Pre-Signed URL Security

**Requirements:**
- Short expiration (1 hour default, 24 hours max)
- HTTPS-only URLs
- No sensitive metadata in URL parameters
- Regenerate on each request (no URL caching)

```javascript
// File: src/api/routes/media.js
app.get('/api/media/:mediaId', authenticate, async (req, res) => {
  const { mediaId } = req.params;
  const userId = req.user.id;

  // Verify user has permission to access media
  const media = await db.media.findOne({
    where: { id: mediaId }
  });

  if (!media) {
    return res.status(404).json({ error: 'Media not found' });
  }

  // Check access permissions
  const hasAccess = await checkMediaAccess(userId, media);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Generate short-lived pre-signed URL
  const presignedUrl = generatePresignedUrl(
    'csn-media-production',
    media.s3Key,
    3600 // 1 hour
  );

  // Log access for audit trail
  await db.mediaAccessLog.create({
    userId,
    mediaId,
    accessedAt: new Date(),
    ipAddress: req.ip
  });

  res.json({ url: presignedUrl });
});
```

---

## 4. Image Processing Security

### 4.1 Image Re-encoding (Strip Metadata)

**Requirement:** All uploaded images MUST be re-encoded to strip EXIF metadata, prevent polyglot attacks, and normalize format.

```javascript
// File: src/security/image-processor.js
const sharp = require('sharp');

async function sanitizeAndProcessImage(inputPath, outputPath, options = {}) {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 85,
    format = 'jpeg'
  } = options;

  try {
    // Re-encode image with Sharp (strips EXIF, metadata)
    await sharp(inputPath)
      .rotate() // Auto-rotate based on EXIF (before stripping)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFormat(format, {
        quality,
        mozjpeg: true // Use mozjpeg for better compression
      })
      .withMetadata(false) // Strip all metadata
      .toFile(outputPath);

    // Delete original file
    await fs.unlink(inputPath);

    return {
      success: true,
      outputPath,
      format
    };

  } catch (error) {
    logger.error('Image processing failed', {
      error: error.message,
      inputPath
    });

    throw new Error('Image processing failed - upload rejected');
  }
}
```

### 4.2 Sharp Security Configuration

**Installation:**
```bash
npm install sharp --ignore-scripts=false
```

**Security Hardening:**
```javascript
// Disable Sharp cache to prevent memory leaks
sharp.cache(false);

// Set memory limits
sharp.concurrency(2); // Limit concurrent operations
sharp.simd(false); // Disable SIMD if causing issues

// Configure for security
const sharpSecure = sharp({
  limitInputPixels: 25000000, // 25 megapixels max
  sequentialRead: true,
  density: 72 // Prevent high-density DoS
});
```

### 4.3 SVG Handling (Block Entirely)

**Decision:** SVG files are BLOCKED due to XSS and code execution risks.

**Rationale:**
- SVG can contain JavaScript (`<script>` tags)
- Complex sanitization required (DOMPurify, svg-sanitizer)
- Limited use case for user-uploaded profile pictures
- High risk-to-benefit ratio

**If SVG support is required in future:**
```javascript
// Strict SVG sanitization (example only - not recommended)
const { sanitize } = require('isomorphic-dompurify');

function sanitizeSVG(svgContent) {
  return sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'foreignObject'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  });
}
```

### 4.4 ImageMagick Avoidance

**Decision:** Do NOT use ImageMagick due to ImageTragick vulnerabilities.

**Use Sharp instead:**
- Secure by design
- No shell command injection risks
- Better performance
- Active maintenance

---

## 5. Rate Limiting & Quota Management

### 5.1 Upload Rate Limits

**Per User:**
- 10 uploads per minute
- 100 uploads per hour
- 500 uploads per day

**Implementation:**
```javascript
// File: src/middleware/rate-limiter.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');

const uploadRateLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'upload_limit:'
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute
  message: 'Too many uploads. Please wait before uploading again.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id, // Rate limit per user
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', {
      userId: req.user.id,
      ip: req.ip
    });

    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

module.exports = { uploadRateLimiter };
```

### 5.2 Storage Quota Management

**Per-User Quota:**
- Free tier: 100 MB total
- Track usage in database
- Prevent uploads when quota exceeded
- Quota reduction when files deleted

```javascript
// File: src/models/user-quota.js
const { DataTypes } = require('sequelize');

const UserQuota = sequelize.define('UserQuota', {
  userId: {
    type: DataTypes.INTEGER,
    unique: true,
    allowNull: false
  },
  usedBytes: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  quotaBytes: {
    type: DataTypes.BIGINT,
    defaultValue: 100 * 1024 * 1024 // 100 MB
  },
  fileCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

// Middleware to check quota before upload
async function checkStorageQuota(req, res, next) {
  const userId = req.user.id;
  const fileSize = req.file.size;

  const quota = await UserQuota.findOne({ where: { userId } });

  if (!quota) {
    // Create quota record for new user
    await UserQuota.create({ userId });
    return next();
  }

  if (quota.usedBytes + fileSize > quota.quotaBytes) {
    return res.status(413).json({
      error: 'Storage quota exceeded',
      used: quota.usedBytes,
      limit: quota.quotaBytes,
      available: quota.quotaBytes - quota.usedBytes
    });
  }

  next();
}

// Update quota after successful upload
async function incrementQuota(userId, fileSize) {
  await UserQuota.increment(
    { usedBytes: fileSize, fileCount: 1 },
    { where: { userId } }
  );
}

// Restore quota after file deletion
async function decrementQuota(userId, fileSize) {
  await UserQuota.decrement(
    { usedBytes: fileSize, fileCount: 1 },
    { where: { userId } }
  );
}

module.exports = {
  UserQuota,
  checkStorageQuota,
  incrementQuota,
  decrementQuota
};
```

### 5.3 Concurrent Upload Limits

**Requirement:** Limit concurrent uploads per user to prevent resource exhaustion.

```javascript
// File: src/middleware/concurrent-upload-limiter.js
const redis = require('../config/redis');

const MAX_CONCURRENT_UPLOADS = 3;

async function concurrentUploadLimiter(req, res, next) {
  const userId = req.user.id;
  const uploadKey = `concurrent_uploads:${userId}`;

  const currentUploads = await redis.incr(uploadKey);
  await redis.expire(uploadKey, 300); // 5 minute timeout

  if (currentUploads > MAX_CONCURRENT_UPLOADS) {
    await redis.decr(uploadKey);
    return res.status(429).json({
      error: 'Too many concurrent uploads',
      limit: MAX_CONCURRENT_UPLOADS
    });
  }

  // Decrement on response finish
  res.on('finish', async () => {
    await redis.decr(uploadKey);
  });

  next();
}

module.exports = { concurrentUploadLimiter };
```

### 5.4 Quota Notification System

```javascript
// File: src/services/quota-notifications.js
async function sendQuotaWarning(userId, percentUsed) {
  const user = await db.users.findByPk(userId);

  if (percentUsed >= 90) {
    await sendEmail({
      to: user.email,
      subject: 'Storage Quota Warning',
      template: 'quota-warning',
      data: {
        percentUsed,
        used: formatBytes(user.quota.usedBytes),
        limit: formatBytes(user.quota.quotaBytes)
      }
    });
  }
}

// Check quota after each upload
async function checkQuotaThresholds(userId) {
  const quota = await UserQuota.findOne({ where: { userId } });
  const percentUsed = (quota.usedBytes / quota.quotaBytes) * 100;

  if (percentUsed >= 90) {
    await sendQuotaWarning(userId, percentUsed);
  }
}
```

---

## 6. Security Test Scenarios

### 6.1 Malicious File Upload Test Vectors

#### Vector 1: EICAR Test File (Malware Detection)
```javascript
// Test: src/tests/security/malware-upload.test.js
describe('Malware Upload Prevention', () => {
  it('should detect and reject EICAR test file', async () => {
    const eicarString = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    const eicarFile = Buffer.from(eicarString);

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', eicarFile, 'test.jpg')
      .expect(400);

    expect(response.body.error).toContain('malware');

    // Verify file was quarantined
    const incident = await db.securityIncidents.findOne({
      where: { type: 'malware_upload_attempt' }
    });
    expect(incident).toBeDefined();
  });
});
```

#### Vector 2: Extension Spoofing
```javascript
it('should reject .exe file renamed to .jpg', async () => {
  // MZ header (Windows executable)
  const exeHeader = Buffer.from('4D5A90000300000004000000FFFF0000', 'hex');

  const response = await request(app)
    .post('/api/upload')
    .set('Authorization', `Bearer ${userToken}`)
    .attach('file', exeHeader, 'innocent.jpg')
    .expect(400);

  expect(response.body.error).toContain('Invalid file type');
});
```

#### Vector 3: Polyglot File (Valid Image + Hidden Payload)
```javascript
it('should reject polyglot files', async () => {
  // Create a file that's both a valid JPEG and a ZIP archive
  const jpegHeader = Buffer.from('FFD8FFE0', 'hex');
  const zipPayload = Buffer.from('504B0304', 'hex'); // ZIP header
  const polyglot = Buffer.concat([jpegHeader, zipPayload]);

  const response = await request(app)
    .post('/api/upload')
    .set('Authorization', `Bearer ${userToken}`)
    .attach('file', polyglot, 'polyglot.jpg')
    .expect(400);

  // Image re-encoding should fail or strip payload
  expect(response.body.error).toBeDefined();
});
```

#### Vector 4: Oversized File (DoS)
```javascript
it('should reject files exceeding size limit', async () => {
  const largeFile = Buffer.alloc(10 * 1024 * 1024); // 10 MB

  const response = await request(app)
    .post('/api/upload')
    .set('Authorization', `Bearer ${userToken}`)
    .attach('file', largeFile, 'large.jpg')
    .expect(413);

  expect(response.body.error).toContain('File size exceeds limit');
});
```

#### Vector 5: Decompression Bomb
```javascript
it('should reject decompression bomb images', async () => {
  // Create image with excessive dimensions (1px visible, 100000x100000 actual)
  const bombImage = await sharp({
    create: {
      width: 100000,
      height: 100000,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  }).png().toBuffer();

  const response = await request(app)
    .post('/api/upload')
    .set('Authorization', `Bearer ${userToken}`)
    .attach('file', bombImage, 'bomb.png')
    .expect(400);

  expect(response.body.error).toContain('too many pixels');
});
```

#### Vector 6: Path Traversal
```javascript
it('should prevent path traversal in filename', async () => {
  const validImage = await createTestImage();

  const response = await request(app)
    .post('/api/upload')
    .set('Authorization', `Bearer ${userToken}`)
    .attach('file', validImage, '../../../etc/passwd.jpg')
    .expect(400);

  expect(response.body.error).toContain('Invalid filename');
});
```

#### Vector 7: Null Byte Injection
```javascript
it('should prevent null byte injection', async () => {
  const validImage = await createTestImage();

  const response = await request(app)
    .post('/api/upload')
    .set('Authorization', `Bearer ${userToken}`)
    .attach('file', validImage, 'image.jpg\0.exe')
    .expect(400);

  expect(response.body.error).toContain('Invalid filename');
});
```

### 6.2 Additional Test Vectors (8-25)

```javascript
describe('Comprehensive Security Test Vectors', () => {
  // Vector 8: SVG with embedded JavaScript
  it('should reject SVG files', async () => {
    const svg = '<svg onload="alert(1)"><script>alert(2)</script></svg>';
    // Test implementation
  });

  // Vector 9: PHP backdoor in image EXIF
  it('should strip EXIF data containing code', async () => {
    // Create JPEG with PHP code in EXIF comment field
  });

  // Vector 10: Double extension (image.jpg.php)
  it('should reject double extensions', async () => {
    // Test implementation
  });

  // Vector 11: Unicode/UTF-8 filename bypass
  it('should handle Unicode filenames securely', async () => {
    // Test with Unicode characters that might bypass filters
  });

  // Vector 12: MIME type confusion
  it('should reject Content-Type header spoofing', async () => {
    const exeFile = createExeFile();
    // Send with Content-Type: image/jpeg
  });

  // Vector 13: ZIP bomb
  it('should reject compressed bomb files', async () => {
    // Test with 42.zip or similar
  });

  // Vector 14: ImageTragick exploit (if using ImageMagick)
  it('should be immune to ImageTragick', async () => {
    // MVG file with shell injection
  });

  // Vector 15: XXE (XML External Entity) in metadata
  it('should prevent XXE attacks', async () => {
    // Image with XXE in XMP metadata
  });

  // Vector 16: SSRF via image URL processing
  it('should prevent SSRF when processing URLs', async () => {
    // If app supports image URL uploads
  });

  // Vector 17: Race condition in upload validation
  it('should prevent TOCTOU attacks', async () => {
    // Swap file between validation and storage
  });

  // Vector 18: Case sensitivity bypass
  it('should handle case-insensitive extensions', async () => {
    // .JPG, .JpG, .jpG variations
  });

  // Vector 19: Whitespace in extension
  it('should reject extensions with whitespace', async () => {
    // "image.jpg " or "image. jpg"
  });

  // Vector 20: Missing file extension
  it('should reject files without extensions', async () => {
    // Filename: "image" with no extension
  });

  // Vector 21: Reserved Windows filenames
  it('should reject reserved filenames', async () => {
    // CON, PRN, AUX, NUL.jpg
  });

  // Vector 22: Excessive filename length
  it('should reject overly long filenames', async () => {
    // 1000+ character filename
  });

  // Vector 23: Hidden file upload (.htaccess, .env)
  it('should reject hidden/config files', async () => {
    // .htaccess, .env, .git
  });

  // Vector 24: Storage quota bypass
  it('should enforce quota even with concurrent uploads', async () => {
    // Race condition in quota checking
  });

  // Vector 25: Rate limit bypass
  it('should prevent rate limit bypass with multiple accounts', async () => {
    // Test distributed attack simulation
  });
});
```

### 6.3 BDD Security Test Scenarios

```gherkin
# File: src/tests/security/features/file-upload-security.feature

Feature: Secure File Upload
  As a security-conscious platform
  I want to prevent malicious file uploads
  So that users and the platform remain safe

  Background:
    Given a user is authenticated
    And the user has available storage quota

  Scenario: Upload valid profile picture
    Given the user has a valid JPEG image "profile.jpg"
    When the user uploads the image as their profile picture
    Then the upload should succeed
    And the image should be scanned for malware
    And the image should be re-encoded
    And the image should be stored in S3
    And the user's quota should be updated

  Scenario: Reject malware upload
    Given the user has a file containing the EICAR test string
    When the user attempts to upload the file
    Then the upload should be rejected
    And the file should be quarantined
    And a security incident should be logged
    And the security team should be notified

  Scenario: Prevent extension spoofing
    Given the user has a Windows executable file
    And the file is renamed with a .jpg extension
    When the user attempts to upload the file
    Then the upload should be rejected
    And the error should mention "Invalid file type"

  Scenario: Enforce file size limits
    Given the user has a 10MB image file
    When the user attempts to upload the file as a profile picture
    Then the upload should be rejected
    And the error should mention "File size exceeds limit"

  Scenario: Enforce storage quota
    Given the user has used 99 MB of their 100 MB quota
    And the user has a 2 MB image file
    When the user attempts to upload the file
    Then the upload should be rejected
    And the error should mention "Storage quota exceeded"

  Scenario: Enforce rate limiting
    Given the user has uploaded 10 files in the last minute
    When the user attempts to upload another file
    Then the upload should be rejected
    And the error should mention "Rate limit exceeded"
    And the response should include a "Retry-After" header

  Scenario: Strip EXIF metadata
    Given the user has a JPEG image with GPS coordinates in EXIF
    When the user uploads the image
    Then the upload should succeed
    And the stored image should not contain EXIF data
    And the stored image should not contain GPS coordinates

  Scenario: Reject SVG files
    Given the user has an SVG file
    When the user attempts to upload the file
    Then the upload should be rejected
    And the error should mention "File type not allowed"

  Scenario: Prevent path traversal
    Given the user has a valid image
    And the filename contains "../../../etc/passwd"
    When the user attempts to upload the file
    Then the upload should be rejected
    And the error should mention "Invalid filename"

  Scenario: Handle concurrent uploads
    Given the user has 3 concurrent upload requests in progress
    When the user attempts a 4th concurrent upload
    Then the upload should be rejected
    And the error should mention "Too many concurrent uploads"
```

---

## 7. Incident Response Procedures

### 7.1 Detection Mechanisms

**Automated Detection:**
1. ClamAV malware signature match
2. VirusTotal positive detections
3. Anomalous file patterns (e.g., polyglots)
4. Rate limit violations
5. Quota bypass attempts
6. Failed validation attempts (>5 per hour per user)

**Alerting:**
```javascript
// File: src/security/alerting.js
async function alertSecurityTeam(incident) {
  const { severity, type, details, userId } = incident;

  // Log to security audit log
  await db.securityAuditLog.create({
    severity,
    type,
    details: JSON.stringify(details),
    userId,
    timestamp: new Date()
  });

  // Send to SIEM (e.g., Splunk, ELK)
  await siemClient.send({
    event_type: 'security_incident',
    severity,
    ...incident
  });

  // Critical alerts: Email + Slack
  if (severity === 'critical' || severity === 'high') {
    await sendEmail({
      to: process.env.SECURITY_EMAIL,
      subject: `[${severity.toUpperCase()}] Security Incident: ${type}`,
      body: JSON.stringify(details, null, 2)
    });

    await slackClient.chat.postMessage({
      channel: '#security-alerts',
      text: `🚨 *${severity.toUpperCase()} Security Alert*\n*Type:* ${type}\n*Details:* ${JSON.stringify(details)}`
    });
  }
}
```

### 7.2 Quarantine Procedures

**Automatic Quarantine:**
```javascript
// File: src/security/quarantine.js
async function quarantineFile(filePath, reason, metadata) {
  const quarantineId = uuidv4();
  const quarantinePath = `/var/quarantine/${quarantineId}`;

  // Move file to quarantine directory
  await fs.rename(filePath, quarantinePath);

  // Store quarantine record
  await db.quarantinedFiles.create({
    id: quarantineId,
    originalPath: filePath,
    quarantinePath,
    reason,
    metadata: JSON.stringify(metadata),
    userId: metadata.userId,
    quarantinedAt: new Date(),
    status: 'quarantined'
  });

  // Upload to secure S3 quarantine bucket
  const fileBuffer = await fs.readFile(quarantinePath);
  await uploadToS3(
    'csn-security-quarantine',
    `quarantine/${quarantineId}`,
    fileBuffer,
    {
      ...metadata,
      quarantineReason: reason
    }
  );

  // Delete local copy
  await fs.unlink(quarantinePath);

  logger.warn('File quarantined', { quarantineId, reason });
}
```

### 7.3 User Notification

```javascript
// File: src/services/incident-notifications.js
async function notifyUserOfQuarantine(userId, filename, reason) {
  const user = await db.users.findByPk(userId);

  await sendEmail({
    to: user.email,
    subject: 'File Upload Security Alert',
    template: 'security-quarantine',
    data: {
      filename,
      reason,
      supportLink: 'https://support.example.com/security'
    }
  });

  // In-app notification
  await db.notifications.create({
    userId,
    type: 'security_alert',
    title: 'File Upload Blocked',
    message: `Your upload "${filename}" was blocked for security reasons: ${reason}`,
    severity: 'warning',
    createdAt: new Date()
  });
}
```

### 7.4 Cleanup Process

**Daily Cleanup Job:**
```javascript
// File: src/jobs/security-cleanup.js
const cron = require('node-cron');

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  logger.info('Starting security cleanup job');

  // Delete quarantined files older than 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const expiredQuarantine = await db.quarantinedFiles.findAll({
    where: {
      quarantinedAt: { [Op.lt]: ninetyDaysAgo },
      status: 'quarantined'
    }
  });

  for (const file of expiredQuarantine) {
    // Delete from S3
    await s3.deleteObject({
      Bucket: 'csn-security-quarantine',
      Key: `quarantine/${file.id}`
    }).promise();

    // Mark as deleted
    await file.update({ status: 'deleted' });
  }

  logger.info(`Cleaned up ${expiredQuarantine.length} expired quarantine files`);

  // Archive old security incidents
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  await db.securityIncidents.update(
    { archived: true },
    { where: { timestamp: { [Op.lt]: sixMonthsAgo } } }
  );
});
```

### 7.5 Incident Response Checklist

**When Malware Detected:**
- [ ] File automatically quarantined
- [ ] Security incident logged in database
- [ ] Security team alerted (email + Slack)
- [ ] User notified of blocked upload
- [ ] User account flagged for review (if repeated attempts)
- [ ] File submitted to VirusTotal for analysis
- [ ] Incident added to weekly security report

**When Quota Abuse Detected:**
- [ ] Log abuse attempt with user details
- [ ] Temporarily rate-limit user (stricter limits)
- [ ] Send warning notification to user
- [ ] Escalate to security team if persistent
- [ ] Review user's uploaded files for policy violations

**When Rate Limit Exceeded:**
- [ ] Return 429 status with Retry-After header
- [ ] Log rate limit violation
- [ ] Track repeat offenders
- [ ] Implement progressive rate limiting (slower limits after violations)

---

## 8. Implementation Checklist

### Phase 1: Core Validation (Week 1)

- [ ] Install and configure file-type library for magic byte detection
- [ ] Implement magic byte validation middleware
- [ ] Implement MIME type verification
- [ ] Implement file size validation
- [ ] Implement image dimension validation
- [ ] Add filename sanitization (path traversal, null bytes)
- [ ] Create file validation test suite (10+ tests)

### Phase 2: Malware Scanning (Week 2)

- [ ] Install and configure ClamAV
- [ ] Implement ClamAV integration module
- [ ] Create quarantine directory with proper permissions
- [ ] Implement quarantine procedures
- [ ] Set up VirusTotal API integration (optional)
- [ ] Create security incident logging
- [ ] Implement security alerting (email + Slack)
- [ ] Add malware scanning tests (5+ tests)

### Phase 3: Storage Security (Week 2)

- [ ] Create three S3 buckets (quarantine, production, archive)
- [ ] Configure S3 bucket policies
- [ ] Enable S3 server-side encryption
- [ ] Implement pre-signed URL generation
- [ ] Configure CloudFront distribution
- [ ] Set up lifecycle policies for quarantine bucket
- [ ] Add S3 integration tests

### Phase 4: Image Processing (Week 3)

- [ ] Install Sharp library
- [ ] Implement image re-encoding pipeline
- [ ] Configure EXIF stripping
- [ ] Implement image dimension resizing
- [ ] Add decompression bomb detection
- [ ] Create image processing test suite
- [ ] Test with various image formats

### Phase 5: Rate Limiting & Quotas (Week 3)

- [ ] Install express-rate-limit and Redis
- [ ] Implement upload rate limiter middleware
- [ ] Create UserQuota database model
- [ ] Implement quota checking middleware
- [ ] Implement concurrent upload limiting
- [ ] Create quota notification system
- [ ] Add rate limiting tests

### Phase 6: Testing & Validation (Week 4)

- [ ] Create all 25 security test vectors
- [ ] Implement BDD security scenarios with Cucumber
- [ ] Run comprehensive penetration testing
- [ ] Test with EICAR malware sample
- [ ] Test polyglot file uploads
- [ ] Test rate limiting under load
- [ ] Test quota enforcement
- [ ] Security code review

### Phase 7: Monitoring & Incident Response (Week 4)

- [ ] Set up security audit logging
- [ ] Integrate with SIEM platform
- [ ] Configure alerting thresholds
- [ ] Create incident response runbook
- [ ] Set up daily cleanup cron job
- [ ] Create security dashboard
- [ ] Train team on incident response procedures

### Phase 8: Documentation & Training (Week 5)

- [ ] Complete security documentation
- [ ] Create API documentation for upload endpoints
- [ ] Write user-facing security guidelines
- [ ] Train development team on secure upload practices
- [ ] Create security awareness materials for users
- [ ] Document incident response procedures

---

## Appendix A: Configuration Examples

### Environment Variables
```bash
# .env.production
AWS_REGION=us-east-1
AWS_S3_BUCKET_PRODUCTION=csn-media-production
AWS_S3_BUCKET_QUARANTINE=csn-uploads-quarantine
AWS_S3_BUCKET_ARCHIVE=csn-security-quarantine

VIRUSTOTAL_API_KEY=your-virustotal-api-key
CLAMAV_SOCKET=/var/run/clamav/clamd.ctl

MAX_FILE_SIZE_MB=5
MAX_STORAGE_QUOTA_MB=100
MAX_CONCURRENT_UPLOADS=3

SECURITY_EMAIL=security@example.com
SLACK_SECURITY_WEBHOOK=https://hooks.slack.com/services/...
```

### Docker Compose (ClamAV)
```yaml
services:
  clamav:
    image: clamav/clamav:latest
    container_name: clamav
    ports:
      - "3310:3310"
    volumes:
      - clamav-data:/var/lib/clamav
    environment:
      - CLAMAV_NO_FRESHCLAMD=false
    restart: unless-stopped

volumes:
  clamav-data:
```

---

## Appendix B: Success Metrics

**Security Metrics:**
- Zero successful malware uploads
- <0.1% false positive rate on malware detection
- 100% MIME type validation coverage
- <1 second average validation time
- Zero path traversal incidents

**Operational Metrics:**
- 99.9% upload success rate (valid files)
- <5 second average upload time
- <1% quota limit violations
- <0.5% rate limit violations
- Zero S3 data breaches

**Compliance Metrics:**
- 100% encryption at rest
- 100% encryption in transit
- <24 hour incident response time
- 90 day quarantine retention
- Complete audit trail for all uploads

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-04 | QE Security Scanner Agent | Initial specification document |

---

## Approval & Review

**Technical Review:** [ ] Pending
**Security Review:** [ ] Pending
**Compliance Review:** [ ] Pending
**Final Approval:** [ ] Pending

---

**END OF DOCUMENT**

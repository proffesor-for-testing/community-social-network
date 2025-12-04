# File Upload Security Quick Reference
## Community Social Network - Developer Cheat Sheet

**Last Updated:** 2025-12-04

---

## 🚨 Critical Requirements (Must-Have)

1. **Magic Byte Validation** - NEVER trust file extensions
2. **ClamAV Scanning** - Every file, no exceptions
3. **Image Re-encoding** - Strip ALL metadata (EXIF, GPS)
4. **Private S3 Buckets** - Never use public-read
5. **Pre-signed URLs** - Short expiration (1 hour max)

---

## 📋 Upload Flow Checklist

```
[ ] Validate file signature (magic bytes)
[ ] Check MIME type consistency
[ ] Verify file size < 5 MB
[ ] Check image dimensions < 4096x4096
[ ] Scan with ClamAV (< 5 seconds)
[ ] Re-encode image with Sharp (strip EXIF)
[ ] Upload to S3 with encryption
[ ] Update user storage quota
[ ] Generate pre-signed URL
```

---

## 🔒 Allowed File Types ONLY

| Type | MIME | Max Size |
|------|------|----------|
| JPEG | image/jpeg | 5 MB |
| PNG | image/png | 5 MB |
| GIF | image/gif | 2 MB |
| WebP | image/webp | 3 MB |
| AVIF | image/avif | 3 MB |

**BLOCKED:** SVG, TIFF, BMP, ICO, PDF, EXE, ZIP, and ALL document formats

---

## 🛡️ Security Middleware Stack

```javascript
app.post('/api/upload',
  authenticate,                    // Auth required
  uploadRateLimiter,               // 10/minute per user
  concurrentUploadLimiter,         // 3 concurrent max
  checkStorageQuota,               // 100 MB free tier
  multer({ limits: { fileSize: 5MB } }).single('file'),
  validateFileSignature,           // Magic bytes
  verifyMimeConsistency,          // MIME cross-check
  validateImageDimensions,         // Dimensions + decompression bomb
  scanFileForMalware,              // ClamAV
  sanitizeAndProcessImage,         // Re-encode with Sharp
  uploadToProductionS3,            // Encrypted upload
  updateUserQuota,                 // Track usage
  respondWithPresignedUrl          // Return URL
);
```

---

## ⚡ Quick Code Snippets

### Magic Byte Validation
```javascript
const fileType = require('file-type');
const detectedType = await fileType.fromFile(filePath);
if (!ALLOWED_TYPES[detectedType.mime]) throw new Error('Invalid type');
```

### ClamAV Scan
```javascript
const { isInfected, viruses } = await clamScanner.isInfected(filePath);
if (isInfected) await quarantineFile(filePath, viruses);
```

### Image Re-encoding (Strip EXIF)
```javascript
await sharp(inputPath)
  .resize(2048, 2048, { fit: 'inside' })
  .withMetadata(false)  // Strips EXIF
  .toFile(outputPath);
```

### S3 Upload with Encryption
```javascript
await s3.upload({
  Bucket: 'csn-media-production',
  Key: key,
  Body: fileBuffer,
  ServerSideEncryption: 'AES256',
  ACL: 'private'
}).promise();
```

### Generate Pre-signed URL
```javascript
const url = s3.getSignedUrl('getObject', {
  Bucket: 'csn-media-production',
  Key: key,
  Expires: 3600  // 1 hour
});
```

---

## 🚫 Common Mistakes to AVOID

1. ❌ Trusting file extensions (`.jpg` means nothing)
2. ❌ Using `public-read` ACL on S3
3. ❌ Skipping malware scans "for performance"
4. ❌ Allowing SVG uploads (XSS risk)
5. ❌ Using ImageMagick (use Sharp instead)
6. ❌ Long-lived pre-signed URLs (>24 hours)
7. ❌ Not checking image dimensions (decompression bomb)
8. ❌ Storing original uploaded files (always re-encode)

---

## 📊 Rate Limits & Quotas

| Limit Type | Value |
|------------|-------|
| Uploads per minute | 10 |
| Uploads per hour | 100 |
| Uploads per day | 500 |
| Concurrent uploads | 3 |
| Storage quota (free) | 100 MB |
| Max file size | 5 MB |
| Max image dimensions | 4096x4096 |

---

## 🔍 Testing Checklist

### Manual Testing
- [ ] Upload valid JPEG (should succeed)
- [ ] Upload .exe renamed to .jpg (should reject)
- [ ] Upload EICAR test file (should quarantine)
- [ ] Upload 10 MB file (should reject)
- [ ] Upload 11 files in 1 minute (should rate limit)
- [ ] Check EXIF stripped from uploaded images

### Automated Testing
```bash
npm test -- --grep "security"
npm run test:integration -- --grep "malware"
```

---

## 🚨 Incident Response (Quick Actions)

### Malware Detected
1. File automatically quarantined to `/var/quarantine/`
2. Security team alerted via email + Slack
3. User notified of blocked upload
4. Incident logged in `security_incidents` table

### Rate Limit Exceeded
1. Return 429 status with `Retry-After` header
2. Log violation with user ID + IP
3. Track repeat offenders (flag account after 5 violations)

### Quota Exceeded
1. Return 413 status with quota details
2. Send email notification at 90% usage
3. Block uploads until user deletes files

---

## 📞 Security Contact

**Security Team:** security@example.com
**Slack Channel:** #security-alerts
**On-Call:** PagerDuty rotation

---

## 📚 Full Documentation

See: `/docs/security/FILE_UPLOAD_SECURITY_SPECIFICATIONS.md`

**1,584 lines** of comprehensive security specifications including:
- 25+ security test vectors
- BDD test scenarios
- Complete implementation checklist
- S3 bucket policies
- Incident response procedures

---

## 🔄 Version

**Document Version:** 1.0.0
**Specification Version:** 1.0.0
**Last Security Review:** Pending

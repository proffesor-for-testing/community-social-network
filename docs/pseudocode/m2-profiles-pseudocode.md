# M2 User Profiles & Media System - Pseudocode Specification

**Version:** 1.0.0
**Phase:** SPARC Phase 2 (Pseudocode)
**Module:** User Profiles, Media Upload, Security
**Last Updated:** 2025-12-16
**Status:** ✅ PSEUDOCODE COMPLETE

---

## Table of Contents

1. [Data Structures](#data-structures)
2. [Profile Management](#profile-management)
3. [File Upload Security](#file-upload-security)
4. [Image Processing Pipeline](#image-processing-pipeline)
5. [Storage Management](#storage-management)
6. [Profile Search](#profile-search)

---

## Data Structures

### Profile Model
```
STRUCTURE: UserProfile
    id: INTEGER (primary key, auto-increment)
    userId: INTEGER (foreign key -> User.id, unique)
    displayName: STRING (max 100 chars, nullable)
    bio: TEXT (max 500 chars, nullable)
    avatarUrl: STRING (S3 pre-signed URL, nullable)
    avatarS3Key: STRING (S3 object key, nullable)
    coverImageUrl: STRING (S3 pre-signed URL, nullable)
    coverImageS3Key: STRING (S3 object key, nullable)
    location: STRING (max 100 chars, nullable)
    website: STRING (max 200 chars, nullable)
    isPublic: BOOLEAN (default: true)
    createdAt: TIMESTAMP
    updatedAt: TIMESTAMP
END STRUCTURE

INDEXES:
    - PRIMARY: id
    - UNIQUE: userId
    - INDEX: displayName (for search)
    - INDEX: isPublic (for filtering)
```

### Media Model
```
STRUCTURE: Media
    id: INTEGER (primary key, auto-increment)
    userId: INTEGER (foreign key -> User.id)
    mediaType: ENUM('profile_picture', 'cover_image', 'post_image')
    originalFilename: STRING
    s3Bucket: STRING
    s3Key: STRING
    s3Region: STRING
    fileSize: BIGINT (bytes)
    mimeType: STRING
    width: INTEGER (pixels)
    height: INTEGER (pixels)
    scanStatus: ENUM('pending', 'scanning', 'clean', 'infected', 'failed')
    virusScanResult: JSON (nullable)
    uploadedFrom: STRING (IP address)
    uploadedAt: TIMESTAMP
    isDeleted: BOOLEAN (default: false)
    deletedAt: TIMESTAMP (nullable)
END STRUCTURE

INDEXES:
    - PRIMARY: id
    - INDEX: (userId, mediaType) (for user's media)
    - INDEX: scanStatus (for background scanning)
    - INDEX: uploadedAt (for cleanup jobs)
```

### User Storage Quota Model
```
STRUCTURE: UserQuota
    userId: INTEGER (primary key, foreign key -> User.id)
    usedBytes: BIGINT (default: 0)
    quotaBytes: BIGINT (default: 104857600) // 100 MB
    fileCount: INTEGER (default: 0)
    lastUpdated: TIMESTAMP
END STRUCTURE

INDEXES:
    - PRIMARY: userId
    - INDEX: usedBytes (for quota enforcement)
```

### Security Incident Model
```
STRUCTURE: SecurityIncident
    id: INTEGER (primary key, auto-increment)
    incidentType: ENUM('malware_upload', 'quota_abuse', 'invalid_file_type', 'suspicious_pattern')
    userId: INTEGER (foreign key -> User.id, nullable)
    mediaId: INTEGER (foreign key -> Media.id, nullable)
    severity: ENUM('low', 'medium', 'high', 'critical')
    details: JSON
    ipAddress: STRING
    userAgent: STRING
    status: ENUM('open', 'investigating', 'resolved', 'false_positive')
    createdAt: TIMESTAMP
    resolvedAt: TIMESTAMP (nullable)
END STRUCTURE

INDEXES:
    - PRIMARY: id
    - INDEX: (incidentType, status)
    - INDEX: userId
    - INDEX: createdAt
```

### Allowed File Types Configuration
```
CONSTANT: ALLOWED_FILE_TYPES = {
    'image/jpeg': {
        extensions: ['jpg', 'jpeg'],
        magicBytes: [0xFF, 0xD8, 0xFF],
        maxSize: 5 * 1024 * 1024,  // 5 MB
        description: 'JPEG Image'
    },
    'image/png': {
        extensions: ['png'],
        magicBytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
        maxSize: 5 * 1024 * 1024,  // 5 MB
        description: 'PNG Image'
    },
    'image/gif': {
        extensions: ['gif'],
        magicBytes: [0x47, 0x49, 0x46, 0x38],  // GIF8
        maxSize: 2 * 1024 * 1024,  // 2 MB
        description: 'GIF Image'
    },
    'image/webp': {
        extensions: ['webp'],
        magicBytes: [0x52, 0x49, 0x46, 0x46],  // RIFF
        maxSize: 3 * 1024 * 1024,  // 3 MB
        description: 'WebP Image'
    },
    'image/avif': {
        extensions: ['avif'],
        magicBytes: [0x00, 0x00, 0x00],
        maxSize: 3 * 1024 * 1024,  // 3 MB
        description: 'AVIF Image'
    }
}

CONSTANT: IMAGE_DIMENSION_LIMITS = {
    'profile_picture': {
        minWidth: 100,
        minHeight: 100,
        maxWidth: 4096,
        maxHeight: 4096,
        maxPixels: 25000000  // 25 megapixels
    },
    'cover_image': {
        minWidth: 400,
        minHeight: 200,
        maxWidth: 4096,
        maxHeight: 2048,
        maxPixels: 25000000
    },
    'post_image': {
        minWidth: 200,
        minHeight: 200,
        maxWidth: 4096,
        maxHeight: 4096,
        maxPixels: 25000000
    }
}
```

---

## Profile Management

### ALGORITHM: CreateUserProfile

```
ALGORITHM: CreateUserProfile
INPUT:
    userId (INTEGER)
    profileData (OBJECT) {
        displayName: STRING (optional)
        bio: STRING (optional)
        location: STRING (optional)
        website: STRING (optional)
        isPublic: BOOLEAN (default: true)
    }
OUTPUT:
    SUCCESS: { profile: UserProfile }
    ERROR: { error: STRING, code: STRING }

PRECONDITIONS:
    - User is authenticated
    - User does not already have a profile

POSTCONDITIONS:
    - Profile created in database
    - User quota record initialized
    - Profile searchable if public

STEPS:
1. Check Existing Profile
    1.1. existingProfile ← Database.FindProfileByUserId(userId)
    1.2. IF existingProfile EXISTS THEN
        RETURN ERROR("Profile already exists", "PROFILE_EXISTS")
    END IF

2. Validate Input Data
    2.1. IF profileData.displayName PROVIDED THEN
        IF Length(profileData.displayName) > 100 THEN
            RETURN ERROR("Display name too long (max 100 chars)", "INVALID_DISPLAY_NAME")
        END IF
        IF NOT IsValidDisplayName(profileData.displayName) THEN
            RETURN ERROR("Display name contains invalid characters", "INVALID_DISPLAY_NAME")
        END IF
    END IF

    2.2. IF profileData.bio PROVIDED THEN
        IF Length(profileData.bio) > 500 THEN
            RETURN ERROR("Bio too long (max 500 chars)", "INVALID_BIO")
        END IF
        bio ← SanitizeHTML(profileData.bio)
    END IF

    2.3. IF profileData.website PROVIDED THEN
        IF NOT IsValidURL(profileData.website) THEN
            RETURN ERROR("Invalid website URL", "INVALID_URL")
        END IF
    END IF

    2.4. IF profileData.location PROVIDED THEN
        IF Length(profileData.location) > 100 THEN
            RETURN ERROR("Location too long (max 100 chars)", "INVALID_LOCATION")
        END IF
    END IF

3. Create Profile Record
    3.1. BEGIN TRANSACTION

    3.2. profile ← Database.CreateProfile({
        userId: userId,
        displayName: profileData.displayName,
        bio: bio,
        location: profileData.location,
        website: profileData.website,
        isPublic: profileData.isPublic ?? true,
        avatarUrl: null,
        avatarS3Key: null,
        coverImageUrl: null,
        coverImageS3Key: null,
        createdAt: CurrentTimestamp(),
        updatedAt: CurrentTimestamp()
    })

    3.3. // Initialize user quota
    quota ← Database.CreateQuota({
        userId: userId,
        usedBytes: 0,
        quotaBytes: 100 * 1024 * 1024,  // 100 MB default
        fileCount: 0,
        lastUpdated: CurrentTimestamp()
    })

    3.4. COMMIT TRANSACTION

4. RETURN SUCCESS({ profile: profile })

COMPLEXITY: O(1)
ERROR HANDLING: Rollback transaction on database errors
```

### ALGORITHM: UpdateUserProfile

```
ALGORITHM: UpdateUserProfile
INPUT:
    userId (INTEGER)
    updates (OBJECT) {
        displayName: STRING (optional)
        bio: STRING (optional)
        location: STRING (optional)
        website: STRING (optional)
        isPublic: BOOLEAN (optional)
    }
OUTPUT:
    SUCCESS: { profile: UserProfile }
    ERROR: { error: STRING, code: STRING }

PRECONDITIONS:
    - User is authenticated
    - Profile exists

POSTCONDITIONS:
    - Profile updated in database
    - Search index updated if displayName changed

STEPS:
1. Fetch Existing Profile
    1.1. profile ← Database.FindProfileByUserId(userId)
    1.2. IF profile NOT EXISTS THEN
        RETURN ERROR("Profile not found", "PROFILE_NOT_FOUND")
    END IF

2. Validate Updates
    2.1. validatedUpdates ← {}

    2.2. IF updates.displayName PROVIDED THEN
        IF Length(updates.displayName) > 100 THEN
            RETURN ERROR("Display name too long", "INVALID_DISPLAY_NAME")
        END IF
        validatedUpdates.displayName ← updates.displayName
    END IF

    2.3. IF updates.bio PROVIDED THEN
        IF Length(updates.bio) > 500 THEN
            RETURN ERROR("Bio too long", "INVALID_BIO")
        END IF
        validatedUpdates.bio ← SanitizeHTML(updates.bio)
    END IF

    2.4. IF updates.website PROVIDED THEN
        IF NOT IsValidURL(updates.website) THEN
            RETURN ERROR("Invalid website URL", "INVALID_URL")
        END IF
        validatedUpdates.website ← updates.website
    END IF

    2.5. IF updates.location PROVIDED THEN
        validatedUpdates.location ← updates.location
    END IF

    2.6. IF updates.isPublic PROVIDED THEN
        validatedUpdates.isPublic ← updates.isPublic
    END IF

3. Update Profile
    3.1. validatedUpdates.updatedAt ← CurrentTimestamp()
    3.2. updatedProfile ← Database.UpdateProfile(userId, validatedUpdates)

4. Update Search Index (if displayName changed)
    4.1. IF validatedUpdates.displayName EXISTS THEN
        ASYNC UpdateSearchIndex(userId, validatedUpdates.displayName)
    END IF

5. RETURN SUCCESS({ profile: updatedProfile })

COMPLEXITY: O(1)
ERROR HANDLING: Validate all fields before database update
```

### ALGORITHM: GetUserProfile

```
ALGORITHM: GetUserProfile
INPUT:
    profileUserId (INTEGER)
    requestingUserId (INTEGER, optional)
OUTPUT:
    SUCCESS: { profile: UserProfile, presignedUrls: OBJECT }
    ERROR: { error: STRING, code: STRING }

STEPS:
1. Fetch Profile
    1.1. profile ← Database.FindProfileByUserId(profileUserId)
    1.2. IF profile NOT EXISTS THEN
        RETURN ERROR("Profile not found", "PROFILE_NOT_FOUND")
    END IF

2. Check Privacy Settings
    2.1. IF profile.isPublic = false THEN
        IF requestingUserId ≠ profileUserId THEN
            RETURN ERROR("Profile is private", "PRIVATE_PROFILE")
        END IF
    END IF

3. Generate Pre-signed URLs for Media
    3.1. presignedUrls ← {}

    3.2. IF profile.avatarS3Key EXISTS THEN
        presignedUrls.avatar ← GeneratePresignedURL(
            bucket: profile.avatarS3Bucket,
            key: profile.avatarS3Key,
            expiresIn: 3600  // 1 hour
        )
    END IF

    3.3. IF profile.coverImageS3Key EXISTS THEN
        presignedUrls.coverImage ← GeneratePresignedURL(
            bucket: profile.coverImageS3Bucket,
            key: profile.coverImageS3Key,
            expiresIn: 3600
        )
    END IF

4. RETURN SUCCESS({
    profile: profile,
    presignedUrls: presignedUrls
})

COMPLEXITY: O(1)
NOTE: Pre-signed URLs generated on-demand, not cached
```

---

## File Upload Security

### ALGORITHM: UploadProfileImage

```
ALGORITHM: UploadProfileImage
INPUT:
    userId (INTEGER)
    file (FILE_BUFFER)
    fileName (STRING)
    fileSize (INTEGER)
    mimeType (STRING)
    imageType (ENUM) // 'profile_picture' or 'cover_image'
    ipAddress (STRING)
    userAgent (STRING)
OUTPUT:
    SUCCESS: { media: Media, presignedUrl: STRING }
    ERROR: { error: STRING, code: STRING }

PRECONDITIONS:
    - User is authenticated
    - Rate limit not exceeded
    - User quota not exceeded
    - File meets security requirements

POSTCONDITIONS:
    - File validated and scanned
    - Image processed and optimized
    - File stored in S3
    - Media record created
    - User quota updated

STEPS:
1. Rate Limit Check
    1.1. CHECK RateLimit("user", userId, "api/upload", limit=10, window=3600)
    1.2. IF rate limit exceeded THEN
        RETURN ERROR("Upload rate limit exceeded", "RATE_LIMIT_EXCEEDED")
    END IF

2. Concurrent Upload Limit
    2.1. activeUploads ← Redis.GET("concurrent_uploads:" + userId)
    2.2. IF activeUploads >= 3 THEN
        RETURN ERROR("Too many concurrent uploads", "CONCURRENT_LIMIT_EXCEEDED")
    END IF
    2.3. Redis.INCR("concurrent_uploads:" + userId)
    2.4. Redis.EXPIRE("concurrent_uploads:" + userId, 300)  // 5 min timeout

3. File Size Validation
    3.1. allowedType ← ALLOWED_FILE_TYPES[mimeType]
    3.2. IF allowedType NOT EXISTS THEN
        RETURN ERROR("File type not allowed", "INVALID_FILE_TYPE")
    END IF

    3.3. IF fileSize > allowedType.maxSize THEN
        RETURN ERROR("File size exceeds limit (" + allowedType.maxSize + " bytes)", "FILE_TOO_LARGE")
    END IF

4. Storage Quota Check
    4.1. quota ← Database.GetUserQuota(userId)
    4.2. IF quota.usedBytes + fileSize > quota.quotaBytes THEN
        RETURN ERROR(
            "Storage quota exceeded. Used: " + quota.usedBytes + ", Limit: " + quota.quotaBytes,
            "QUOTA_EXCEEDED"
        )
    END IF

5. Filename Sanitization
    5.1. IF HasPathTraversal(fileName) THEN
        RETURN ERROR("Invalid filename - path traversal detected", "INVALID_FILENAME")
    END IF

    5.2. IF HasNullBytes(fileName) THEN
        RETURN ERROR("Invalid filename - null bytes detected", "INVALID_FILENAME")
    END IF

    5.3. sanitizedFilename ← SanitizeFilename(fileName)

6. Magic Byte Validation
    6.1. detectedMime ← ValidateMagicBytes(file)
    6.2. IF detectedMime NOT IN ALLOWED_FILE_TYPES THEN
        CreateSecurityIncident({
            type: "invalid_file_type",
            userId: userId,
            severity: "medium",
            details: {
                detectedMime: detectedMime,
                claimedMime: mimeType,
                filename: sanitizedFilename
            }
        })
        RETURN ERROR("File type validation failed", "INVALID_FILE_TYPE")
    END IF

    6.3. IF detectedMime ≠ mimeType THEN
        CreateSecurityIncident({
            type: "mime_type_mismatch",
            userId: userId,
            severity: "high",
            details: {
                detectedMime: detectedMime,
                claimedMime: mimeType
            }
        })
        RETURN ERROR("MIME type mismatch - possible spoofing", "MIME_MISMATCH")
    END IF

7. Image Dimension Validation
    7.1. dimensions ← GetImageDimensions(file)
    7.2. limits ← IMAGE_DIMENSION_LIMITS[imageType]

    7.3. IF dimensions.width < limits.minWidth OR dimensions.height < limits.minHeight THEN
        RETURN ERROR("Image dimensions too small", "IMAGE_TOO_SMALL")
    END IF

    7.4. IF dimensions.width > limits.maxWidth OR dimensions.height > limits.maxHeight THEN
        RETURN ERROR("Image dimensions too large", "IMAGE_TOO_LARGE")
    END IF

    7.5. pixelCount ← dimensions.width × dimensions.height
    7.6. IF pixelCount > limits.maxPixels THEN
        CreateSecurityIncident({
            type: "decompression_bomb",
            userId: userId,
            severity: "high",
            details: { pixelCount: pixelCount, limit: limits.maxPixels }
        })
        RETURN ERROR("Image has too many pixels - potential decompression bomb", "DECOMPRESSION_BOMB")
    END IF

8. Write to Temporary Storage
    8.1. tempFilePath ← "/tmp/upload_" + GenerateUUID() + "_" + sanitizedFilename
    8.2. WriteFileToTemp(tempFilePath, file)

9. Malware Scanning (ClamAV)
    9.1. scanResult ← ScanFileForMalware(tempFilePath)
    9.2. IF scanResult.infected = true THEN
        QuarantineFile(tempFilePath, scanResult.viruses, userId)
        DeleteFile(tempFilePath)
        RETURN ERROR("File failed security scan", "MALWARE_DETECTED")
    END IF

10. Image Processing and Re-encoding
    10.1. processedFilePath ← ProcessAndSanitizeImage(
        inputPath: tempFilePath,
        imageType: imageType,
        maxWidth: limits.maxWidth,
        maxHeight: limits.maxHeight,
        quality: 85,
        format: 'jpeg'
    )

    // Processing strips EXIF, re-encodes to prevent polyglots
    10.2. IF processedFilePath = ERROR THEN
        DeleteFile(tempFilePath)
        RETURN ERROR("Image processing failed", "PROCESSING_ERROR")
    END IF

    10.3. processedFileSize ← GetFileSize(processedFilePath)

11. Upload to S3 (Quarantine Bucket)
    11.1. s3Key ← GenerateS3Key(userId, imageType, sanitizedFilename)
    11.2. s3Result ← UploadToS3Quarantine({
        bucket: "csn-uploads-quarantine",
        key: s3Key,
        filePath: processedFilePath,
        contentType: detectedMime,
        metadata: {
            userId: userId,
            originalFilename: sanitizedFilename,
            scanStatus: "clean",
            uploadedAt: CurrentTimestamp()
        }
    })

12. Create Media Record
    12.1. BEGIN TRANSACTION

    12.2. media ← Database.CreateMedia({
        userId: userId,
        mediaType: imageType,
        originalFilename: sanitizedFilename,
        s3Bucket: "csn-uploads-quarantine",
        s3Key: s3Key,
        s3Region: "us-east-1",
        fileSize: processedFileSize,
        mimeType: detectedMime,
        width: dimensions.width,
        height: dimensions.height,
        scanStatus: "clean",
        virusScanResult: scanResult,
        uploadedFrom: ipAddress,
        uploadedAt: CurrentTimestamp(),
        isDeleted: false
    })

    12.3. // Update user quota
    Database.UpdateQuota(userId, {
        usedBytes: quota.usedBytes + processedFileSize,
        fileCount: quota.fileCount + 1,
        lastUpdated: CurrentTimestamp()
    })

    12.4. COMMIT TRANSACTION

13. Move to Production S3 (After Validation)
    13.1. ASYNC MoveToProductionS3({
        sourceKey: s3Key,
        mediaId: media.id,
        userId: userId
    })

14. Clean Up Temporary Files
    14.1. DeleteFile(tempFilePath)
    14.2. DeleteFile(processedFilePath)
    14.3. Redis.DECR("concurrent_uploads:" + userId)

15. Generate Pre-signed URL
    15.1. presignedUrl ← GeneratePresignedURL(
        bucket: "csn-media-production",
        key: s3Key,
        expiresIn: 3600
    )

16. RETURN SUCCESS({
    media: media,
    presignedUrl: presignedUrl
})

COMPLEXITY ANALYSIS:
    Time: O(n) where n = file size (for scanning and processing)
    Space: O(n) for temporary file storage

ERROR HANDLING:
    - Always clean up temporary files
    - Rollback transaction on database errors
    - Decrement concurrent upload counter on exit
    - Log all security incidents

SECURITY NOTES:
    - Multi-layer validation (magic bytes, MIME, dimensions)
    - Malware scanning before storage
    - Image re-encoding prevents polyglot attacks
    - Quarantine bucket for initial storage
    - All suspicious activity logged
```

### SUBROUTINE: ValidateMagicBytes

```
SUBROUTINE: ValidateMagicBytes
INPUT: fileBuffer (BINARY_DATA)
OUTPUT: detectedMimeType (STRING) or ERROR

STEPS:
1. Read File Header
    1.1. header ← fileBuffer[0:16]  // First 16 bytes

2. Check Against Known Signatures
    2.1. FOR EACH (mimeType, config) IN ALLOWED_FILE_TYPES DO
        2.2. magicBytes ← config.magicBytes
        2.3. IF header STARTS WITH magicBytes THEN
            RETURN mimeType
        END IF
    END FOR

3. Special Case: WebP (RIFF + WEBP)
    3.1. IF header[0:4] = [0x52, 0x49, 0x46, 0x46] THEN  // RIFF
        IF header[8:12] = [0x57, 0x45, 0x42, 0x50] THEN  // WEBP
            RETURN "image/webp"
        END IF
    END IF

4. Special Case: AVIF (ftyp avif)
    4.1. IF header[4:8] = [0x66, 0x74, 0x79, 0x70] THEN  // ftyp
        IF header[8:12] CONTAINS "avif" THEN
            RETURN "image/avif"
        END IF
    END IF

5. RETURN ERROR("Unknown or unsupported file type")

COMPLEXITY: O(1) - fixed number of checks
NOTE: Using magic bytes prevents extension-based spoofing
```

### SUBROUTINE: ScanFileForMalware

```
SUBROUTINE: ScanFileForMalware
INPUT: filePath (STRING)
OUTPUT: { infected: BOOLEAN, viruses: ARRAY<STRING> }

STEPS:
1. Check ClamAV Connection
    1.1. IF NOT ClamAV.IsConnected() THEN
        LogError("ClamAV not available - failing secure")
        THROW ERROR("Malware scanner unavailable - upload rejected")
    END IF

2. Execute Scan
    2.1. TRY
        scanResult ← ClamAV.ScanFile(filePath, timeout=60000)
    2.2. CATCH error
        LogError("ClamAV scan failed: " + error.message)
        THROW ERROR("Unable to verify file safety")
    END TRY

3. Parse Results
    3.1. IF scanResult.isInfected = true THEN
        RETURN {
            infected: true,
            viruses: scanResult.viruses
        }
    ELSE
        RETURN {
            infected: false,
            viruses: []
        }
    END IF

COMPLEXITY: O(n) where n = file size
TIMEOUT: 60 seconds (fail secure if timeout)
SECURITY: Fail secure - reject upload if scan fails
```

### SUBROUTINE: QuarantineFile

```
SUBROUTINE: QuarantineFile
INPUT:
    filePath (STRING)
    viruses (ARRAY<STRING>)
    userId (INTEGER)
OUTPUT: VOID

STEPS:
1. Generate Quarantine ID
    1.1. quarantineId ← GenerateUUID()
    1.2. quarantinePath ← "/var/quarantine/" + quarantineId

2. Move File to Quarantine
    2.1. MoveFile(filePath, quarantinePath)

3. Upload to Quarantine S3
    3.1. UploadToS3({
        bucket: "csn-security-quarantine",
        key: "quarantine/" + quarantineId,
        filePath: quarantinePath,
        metadata: {
            userId: userId,
            viruses: viruses.join(", "),
            quarantinedAt: CurrentTimestamp()
        }
    })

4. Create Security Incident
    4.1. Database.CreateSecurityIncident({
        incidentType: "malware_upload",
        userId: userId,
        severity: "high",
        details: {
            quarantineId: quarantineId,
            viruses: viruses,
            filePath: quarantinePath
        },
        status: "open",
        createdAt: CurrentTimestamp()
    })

5. Alert Security Team
    5.1. SendSecurityAlert({
        severity: "HIGH",
        type: "Malware Upload Attempt",
        userId: userId,
        viruses: viruses,
        quarantineId: quarantineId
    })

6. Delete Local Quarantine File
    6.1. DeleteFile(quarantinePath)

COMPLEXITY: O(1) + O(n) for file operations
SECURITY: Always alert security team for malware uploads
```

---

## Image Processing Pipeline

### ALGORITHM: ProcessAndSanitizeImage

```
ALGORITHM: ProcessAndSanitizeImage
INPUT:
    inputPath (STRING)
    imageType (ENUM)
    maxWidth (INTEGER)
    maxHeight (INTEGER)
    quality (INTEGER)  // 1-100
    format (STRING)    // 'jpeg', 'png', 'webp'
OUTPUT:
    outputPath (STRING) or ERROR

PRECONDITIONS:
    - Input file exists and is readable
    - Sharp library is initialized with security settings

POSTCONDITIONS:
    - Image re-encoded to strip EXIF metadata
    - Image resized if exceeds dimensions
    - Image optimized for web delivery
    - Output file written to temporary storage

STEPS:
1. Validate Input File
    1.1. IF NOT FileExists(inputPath) THEN
        RETURN ERROR("Input file not found")
    END IF

2. Initialize Sharp with Security Settings
    2.1. Sharp.Configure({
        limitInputPixels: 25000000,  // 25 megapixels max
        sequentialRead: true,
        density: 72  // Prevent high-density DoS
    })

3. Read Image Metadata
    3.1. TRY
        metadata ← Sharp(inputPath).Metadata()
    3.2. CATCH error
        LogError("Failed to read image metadata: " + error.message)
        RETURN ERROR("Image processing failed - invalid image")
    END TRY

4. Calculate Resize Dimensions
    4.1. targetWidth ← metadata.width
    4.2. targetHeight ← metadata.height

    4.3. IF targetWidth > maxWidth OR targetHeight > maxHeight THEN
        aspectRatio ← targetWidth / targetHeight

        IF targetWidth > maxWidth THEN
            targetWidth ← maxWidth
            targetHeight ← Floor(maxWidth / aspectRatio)
        END IF

        IF targetHeight > maxHeight THEN
            targetHeight ← maxHeight
            targetWidth ← Floor(maxHeight × aspectRatio)
        END IF
    END IF

5. Process Image
    5.1. outputPath ← "/tmp/processed_" + GenerateUUID() + "." + format

    5.2. TRY
        Sharp(inputPath)
            .rotate()  // Auto-rotate based on EXIF (before stripping)
            .resize({
                width: targetWidth,
                height: targetHeight,
                fit: 'inside',
                withoutEnlargement: true
            })
            .toFormat(format, {
                quality: quality,
                mozjpeg: true,       // Use mozjpeg for better JPEG compression
                progressive: true,   // Progressive JPEG
                chromaSubsampling: '4:4:4'  // Preserve quality
            })
            .withMetadata(false)  // CRITICAL: Strip all EXIF/metadata
            .toFile(outputPath)

    5.3. CATCH error
        LogError("Image processing failed: " + error.message)
        RETURN ERROR("Image processing failed")
    END TRY

6. Verify Output File
    6.1. IF NOT FileExists(outputPath) THEN
        RETURN ERROR("Processed file not created")
    END IF

    6.2. outputSize ← GetFileSize(outputPath)
    6.3. IF outputSize = 0 THEN
        DeleteFile(outputPath)
        RETURN ERROR("Processed file is empty")
    END IF

7. RETURN outputPath

COMPLEXITY: O(n × m) where n,m = image dimensions
TIME: ~100-500ms depending on image size
SECURITY BENEFITS:
    - EXIF stripping removes GPS coordinates, camera info
    - Re-encoding prevents polyglot file attacks
    - Dimension limiting prevents decompression bombs
    - Format conversion ensures safe image structure
```

### SUBROUTINE: GenerateImageThumbnail

```
SUBROUTINE: GenerateImageThumbnail
INPUT:
    sourcePath (STRING)
    thumbnailSize (INTEGER)  // e.g., 150 for 150x150
OUTPUT:
    thumbnailPath (STRING)

STEPS:
1. thumbnailPath ← "/tmp/thumb_" + GenerateUUID() + ".jpeg"

2. Sharp(sourcePath)
    .resize({
        width: thumbnailSize,
        height: thumbnailSize,
        fit: 'cover',  // Crop to fill square
        position: 'center'
    })
    .jpeg({ quality: 80 })
    .withMetadata(false)
    .toFile(thumbnailPath)

3. RETURN thumbnailPath

COMPLEXITY: O(thumbnailSize^2)
USE CASE: Generate avatar thumbnails for list views
```

---

## Storage Management

### ALGORITHM: MoveToProductionS3

```
ALGORITHM: MoveToProductionS3
INPUT:
    sourceKey (STRING)
    mediaId (INTEGER)
    userId (INTEGER)
OUTPUT: VOID

PRECONDITIONS:
    - File exists in quarantine bucket
    - Media record exists in database
    - File has passed all security scans

POSTCONDITIONS:
    - File copied to production bucket
    - File deleted from quarantine bucket
    - Media record updated with production location
    - Profile record updated with new media URL

STEPS:
1. Copy from Quarantine to Production
    1.1. productionKey ← sourceKey  // Same key structure

    1.2. TRY
        S3.CopyObject({
            sourceBucket: "csn-uploads-quarantine",
            sourceKey: sourceKey,
            destinationBucket: "csn-media-production",
            destinationKey: productionKey,
            serverSideEncryption: "AES256",
            metadata: {
                userId: userId,
                promotedAt: CurrentTimestamp()
            }
        })
    1.3. CATCH error
        LogError("Failed to copy to production: " + error.message)
        // Retry up to 3 times
        THROW error
    END TRY

2. Update Media Record
    2.1. Database.UpdateMedia(mediaId, {
        s3Bucket: "csn-media-production",
        scanStatus: "clean"
    })

3. Update Profile Record (if profile image)
    3.1. media ← Database.FindMediaById(mediaId)

    3.2. IF media.mediaType = "profile_picture" THEN
        // Delete old profile picture if exists
        oldProfile ← Database.FindProfileByUserId(userId)
        IF oldProfile.avatarS3Key EXISTS THEN
            ASYNC DeleteFromS3("csn-media-production", oldProfile.avatarS3Key)
        END IF

        // Update profile with new avatar
        Database.UpdateProfile(userId, {
            avatarS3Key: productionKey,
            updatedAt: CurrentTimestamp()
        })

    3.3. ELSE IF media.mediaType = "cover_image" THEN
        // Delete old cover image if exists
        IF oldProfile.coverImageS3Key EXISTS THEN
            ASYNC DeleteFromS3("csn-media-production", oldProfile.coverImageS3Key)
        END IF

        // Update profile with new cover image
        Database.UpdateProfile(userId, {
            coverImageS3Key: productionKey,
            updatedAt: CurrentTimestamp()
        })
    END IF

4. Delete from Quarantine Bucket
    4.1. S3.DeleteObject({
        bucket: "csn-uploads-quarantine",
        key: sourceKey
    })

COMPLEXITY: O(n) where n = file size (for S3 copy)
ERROR HANDLING: Retry failed S3 operations, log errors
```

### ALGORITHM: GeneratePresignedURL

```
ALGORITHM: GeneratePresignedURL
INPUT:
    bucket (STRING)
    key (STRING)
    expiresIn (INTEGER)  // seconds (default: 3600 = 1 hour)
OUTPUT:
    presignedUrl (STRING)

STEPS:
1. Validate Expiry Time
    1.1. IF expiresIn > 86400 THEN  // Max 24 hours
        expiresIn ← 86400
    END IF

    1.2. IF expiresIn < 300 THEN  // Min 5 minutes
        expiresIn ← 300
    END IF

2. Generate Pre-signed URL
    2.1. presignedUrl ← S3.GetSignedUrl('getObject', {
        Bucket: bucket,
        Key: key,
        Expires: expiresIn,
        ResponseContentDisposition: 'inline',  // Display, don't download
        ResponseContentType: 'image/jpeg'  // Force image MIME type
    })

3. RETURN presignedUrl

COMPLEXITY: O(1)
SECURITY:
    - Short expiry prevents URL sharing
    - HTTPS-only URLs
    - No sensitive metadata in URL
    - Regenerate on each request
```

### ALGORITHM: CleanupExpiredMedia

```
ALGORITHM: CleanupExpiredMedia (Cron Job)
INPUT: VOID
OUTPUT: cleanedCount (INTEGER)

DESCRIPTION: Daily job to clean up orphaned and expired media

STEPS:
1. Find Expired Quarantine Files
    1.1. twentyFourHoursAgo ← CurrentTimestamp() - 86400
    1.2. expiredMedia ← Database.FindMedia({
        s3Bucket: "csn-uploads-quarantine",
        uploadedAt: { lessThan: twentyFourHoursAgo },
        scanStatus: { notIn: ["infected"] }  // Keep infected for investigation
    })

2. Delete from S3 and Database
    2.1. cleanedCount ← 0
    2.2. FOR EACH media IN expiredMedia DO
        2.3. S3.DeleteObject({
            bucket: media.s3Bucket,
            key: media.s3Key
        })

        2.4. Database.UpdateMedia(media.id, {
            isDeleted: true,
            deletedAt: CurrentTimestamp()
        })

        2.5. cleanedCount ← cleanedCount + 1
    END FOR

3. Update User Quotas
    3.1. FOR EACH media IN expiredMedia DO
        3.2. Database.DecrementQuota(media.userId, {
            usedBytes: media.fileSize,
            fileCount: 1
        })
    END FOR

4. Log Cleanup Results
    4.1. LogInfo("Cleaned up " + cleanedCount + " expired media files")

5. RETURN cleanedCount

COMPLEXITY: O(n) where n = number of expired files
SCHEDULE: Run daily at 2 AM UTC
```

---

## Profile Search

### ALGORITHM: SearchProfiles

```
ALGORITHM: SearchProfiles
INPUT:
    query (STRING)
    requestingUserId (INTEGER, optional)
    limit (INTEGER, default: 20)
    offset (INTEGER, default: 0)
OUTPUT:
    profiles (ARRAY<UserProfile>)
    totalCount (INTEGER)

PRECONDITIONS:
    - Query is sanitized
    - Rate limit not exceeded

POSTCONDITIONS:
    - Only public profiles returned (unless own profile)
    - Results sorted by relevance

STEPS:
1. Rate Limit Check
    1.1. IF requestingUserId PROVIDED THEN
        CHECK RateLimit("user", requestingUserId, "api/search", limit=30, window=60)
    END IF

2. Sanitize Query
    2.1. query ← Trim(query)
    2.2. IF Length(query) < 2 THEN
        RETURN { profiles: [], totalCount: 0 }
    END IF

    2.3. query ← SanitizeSQL(query)

3. Build Search Query
    3.1. searchQuery ← "
        SELECT p.*, u.email
        FROM UserProfile p
        JOIN User u ON p.userId = u.id
        WHERE (
            p.displayName ILIKE '%' || $query || '%'
            OR u.email ILIKE '%' || $query || '%'
        )
        AND (p.isPublic = true OR p.userId = $requestingUserId)
        AND u.emailVerified = true
        ORDER BY
            CASE
                WHEN p.displayName ILIKE $query || '%' THEN 1
                WHEN p.displayName ILIKE '%' || $query THEN 2
                ELSE 3
            END,
            p.updatedAt DESC
        LIMIT $limit OFFSET $offset
    "

4. Execute Search
    4.1. profiles ← Database.ExecuteQuery(searchQuery, {
        query: query,
        requestingUserId: requestingUserId,
        limit: limit,
        offset: offset
    })

5. Get Total Count
    5.1. totalCount ← Database.Count("UserProfile", {
        displayName: { contains: query },
        isPublic: true
    })

6. Sanitize Results (Remove Sensitive Data)
    6.1. FOR EACH profile IN profiles DO
        6.2. IF profile.userId ≠ requestingUserId THEN
            DELETE profile.email  // Don't expose email in search
        END IF
    END FOR

7. RETURN { profiles: profiles, totalCount: totalCount }

COMPLEXITY: O(log n) with index on displayName
OPTIMIZATION: Use full-text search (PostgreSQL tsvector) for production
```

---

## Complexity Summary

### Overall System Complexity

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|----------------|------------------|-------|
| Create Profile | O(1) | O(1) | Database insert |
| Update Profile | O(1) | O(1) | Database update |
| Get Profile | O(1) | O(1) | Database lookup |
| Upload Image | O(n) | O(n) | File processing |
| Validate Magic Bytes | O(1) | O(1) | Fixed header check |
| Scan for Malware | O(n) | O(n) | ClamAV scan |
| Process Image | O(w × h) | O(w × h) | Sharp processing |
| Generate Pre-signed URL | O(1) | O(1) | S3 signature |
| Search Profiles | O(log n) | O(k) | Indexed search |

**File Size Limits:**
- Profile picture: 5 MB
- Cover image: 5 MB
- User quota: 100 MB total

**Processing Times (estimated):**
- Magic byte validation: < 1ms
- ClamAV scan: 100-1000ms (depending on file size)
- Image processing: 100-500ms
- S3 upload: 500-2000ms (depending on file size)
- Total upload time: 1-4 seconds

---

## Security Considerations

1. **Multi-Layer Validation:**
   - Magic byte verification (primary)
   - MIME type validation (secondary)
   - File extension check (tertiary)
   - All three must be consistent

2. **Malware Prevention:**
   - ClamAV scanning (synchronous)
   - Quarantine bucket (pre-production)
   - Image re-encoding (strips embedded code)
   - Polyglot attack prevention

3. **EXIF Data Removal:**
   - GPS coordinates stripped
   - Camera information removed
   - Timestamps removed
   - All metadata sanitized

4. **Decompression Bomb Prevention:**
   - Pixel count limit (25 megapixels)
   - Dimension limits enforced
   - Processing timeout (60 seconds)

5. **Storage Security:**
   - S3 encryption at rest (AES-256)
   - Pre-signed URLs (short-lived)
   - Private bucket ACLs
   - No public read access

6. **Rate Limiting:**
   - 10 uploads per hour per user
   - 3 concurrent uploads maximum
   - Search rate limited (30/minute)

7. **Quota Management:**
   - 100 MB per user (free tier)
   - Enforced before upload
   - Tracked in database
   - Notifications at 90% usage

---

**END OF M2 PROFILES PSEUDOCODE**

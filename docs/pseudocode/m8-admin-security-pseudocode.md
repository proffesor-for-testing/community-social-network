# M8 Admin Panel & Security - Pseudocode Documentation

**Project**: Community Social Network MVP
**Milestone**: M8 - Admin & Moderation
**Phase**: SPARC Phase 2 - Pseudocode
**Version**: 1.0.0
**Date**: 2025-12-16
**Status**: PSEUDOCODE COMPLETE

---

## Table of Contents

1. [Two-Factor Authentication (2FA)](#1-two-factor-authentication-2fa)
2. [IP Whitelisting](#2-ip-whitelisting)
3. [Session Security](#3-session-security)
4. [Sensitive Action Re-authentication](#4-sensitive-action-re-authentication)
5. [Audit Logging](#5-audit-logging)
6. [Rate Limiting](#6-rate-limiting)
7. [Permission Enforcement](#7-permission-enforcement)
8. [Data Structures](#8-data-structures)
9. [Complexity Analysis Summary](#9-complexity-analysis-summary)

---

## 1. Two-Factor Authentication (2FA)

### 1.1 TOTP Secret Generation

```
ALGORITHM: GenerateTOTPSecret
INPUT: userId (string), email (string)
OUTPUT: {secret: string, qrCodeUrl: string, backupCodes: array}
PRECONDITIONS: User must be authenticated as admin
POSTCONDITIONS: TOTP secret stored encrypted in database, backup codes hashed

BEGIN
    // Generate cryptographically secure secret (32 bytes = 256 bits)
    secret ← GENERATE_RANDOM_BYTES(32)
    secretBase32 ← ENCODE_BASE32(secret)

    // Create OTPAuth URL for QR code
    issuer ← "CommunityNetwork"
    otpAuthURL ← FORMAT("otpauth://totp/{0}:{1}?secret={2}&issuer={0}",
                         issuer, email, secretBase32)

    // Generate QR code as data URL
    qrCodeUrl ← GENERATE_QR_CODE(otpAuthURL)

    // Generate 10 backup codes (8 hex characters each)
    backupCodes ← []
    FOR i ← 1 TO 10 DO
        randomBytes ← GENERATE_RANDOM_BYTES(4)
        backupCode ← TO_HEX(randomBytes).TO_UPPERCASE()
        backupCodes.APPEND(backupCode)
    END FOR

    // Hash backup codes for secure storage
    hashedBackupCodes ← []
    FOR EACH code IN backupCodes DO
        hashedCode ← BCRYPT_HASH(code, cost=10)
        hashedBackupCodes.APPEND(hashedCode)
    END FOR

    // Encrypt secret before storage
    encryptedSecret ← AES_ENCRYPT(secretBase32, MASTER_KEY)

    // Store in database
    Database.INSERT INTO admin_two_factor (
        user_id: userId,
        secret: encryptedSecret,
        backup_codes: hashedBackupCodes,
        enabled: false,  // Enabled after first successful verification
        created_at: CURRENT_TIMESTAMP()
    )

    RETURN {
        secret: secretBase32,
        qrCodeUrl: qrCodeUrl,
        backupCodes: backupCodes
    }
END

COMPLEXITY: O(1) - constant time operations
SECURITY:
    - Secret must be at least 160 bits (NIST recommendation)
    - Use cryptographically secure random number generator
    - Encrypt secret at rest using AES-256
    - Hash backup codes with bcrypt (cost factor 10+)
    - Never log or transmit plain text secret after initial setup
```

### 1.2 TOTP Verification

```
ALGORITHM: VerifyTOTP
INPUT: userId (string), token (string, 6 digits)
OUTPUT: boolean (true if valid, false otherwise)
PRECONDITIONS: User has TOTP enabled
POSTCONDITIONS: If first verification, 2FA is marked as enabled

BEGIN
    // Retrieve user's TOTP configuration
    twoFactorConfig ← Database.SELECT FROM admin_two_factor
                      WHERE user_id = userId

    IF twoFactorConfig IS NULL THEN
        RETURN false
    END IF

    // Decrypt stored secret
    secret ← AES_DECRYPT(twoFactorConfig.secret, MASTER_KEY)

    // Get current timestamp (Unix time)
    currentTime ← UNIX_TIMESTAMP()

    // TOTP uses 30-second time steps
    timeStep ← 30

    // Allow one time step before and after (window = 1)
    // This accounts for clock drift and user delay
    window ← 1

    isValid ← false

    // Check token against current time and adjacent time windows
    FOR offset ← -window TO window DO
        timeCounter ← FLOOR((currentTime + (offset * timeStep)) / timeStep)

        // TOTP Algorithm: HMAC-SHA1 based OTP
        expectedToken ← ComputeTOTP(secret, timeCounter)

        IF token = expectedToken THEN
            isValid ← true
            BREAK
        END IF
    END FOR

    // Enable 2FA on first successful verification
    IF isValid AND NOT twoFactorConfig.enabled THEN
        Database.UPDATE admin_two_factor
        SET enabled = true, verified_at = CURRENT_TIMESTAMP()
        WHERE user_id = userId
    END IF

    // Log verification attempt
    IF NOT isValid THEN
        AuditLog.Record("2FA_VERIFICATION_FAILED", userId, {
            timestamp: CURRENT_TIMESTAMP(),
            ip_address: REQUEST_IP()
        })
    END IF

    RETURN isValid
END

SUBROUTINE: ComputeTOTP
INPUT: secret (string, base32), timeCounter (integer)
OUTPUT: token (string, 6 digits)

BEGIN
    // Convert base32 secret to bytes
    secretBytes ← BASE32_DECODE(secret)

    // Convert time counter to 8-byte big-endian format
    timeBytes ← INTEGER_TO_BYTES_BE(timeCounter, 8)

    // Compute HMAC-SHA1
    hmac ← HMAC_SHA1(secretBytes, timeBytes)

    // Dynamic truncation (RFC 4226)
    offset ← hmac[19] AND 0x0F

    binaryCode ← ((hmac[offset] AND 0x7F) << 24) OR
                 ((hmac[offset + 1] AND 0xFF) << 16) OR
                 ((hmac[offset + 2] AND 0xFF) << 8) OR
                 (hmac[offset + 3] AND 0xFF)

    // Generate 6-digit token
    token ← binaryCode MOD 1000000

    // Pad with leading zeros if necessary
    tokenString ← PAD_LEFT(TO_STRING(token), 6, '0')

    RETURN tokenString
END

COMPLEXITY: O(1) - constant time cryptographic operations
SECURITY:
    - Use constant-time comparison to prevent timing attacks
    - Window of ±1 step (90 seconds total) balances security and usability
    - Rate limit verification attempts (max 3 per 5 minutes)
    - Log failed attempts for security monitoring
    - Secret must be at least 160 bits per RFC 4226
```

### 1.3 Backup Code Verification

```
ALGORITHM: VerifyBackupCode
INPUT: userId (string), code (string, 8 hex characters)
OUTPUT: boolean (true if valid and not used, false otherwise)
PRECONDITIONS: User has backup codes configured
POSTCONDITIONS: Used backup code is removed from database

BEGIN
    // Normalize input (uppercase, remove spaces)
    normalizedCode ← REMOVE_SPACES(code).TO_UPPERCASE()

    // Validate format (8 hex characters)
    IF NOT MATCHES_PATTERN(normalizedCode, "^[0-9A-F]{8}$") THEN
        RETURN false
    END IF

    // Retrieve backup codes
    twoFactorConfig ← Database.SELECT FROM admin_two_factor
                      WHERE user_id = userId

    IF twoFactorConfig IS NULL THEN
        RETURN false
    END IF

    hashedBackupCodes ← twoFactorConfig.backup_codes

    IF LENGTH(hashedBackupCodes) = 0 THEN
        AuditLog.Record("BACKUP_CODES_EXHAUSTED", userId, {
            message: "User attempted to use backup code but none remain"
        })
        RETURN false
    END IF

    // Check against each hashed backup code
    foundIndex ← -1
    FOR i ← 0 TO LENGTH(hashedBackupCodes) - 1 DO
        isMatch ← BCRYPT_COMPARE(normalizedCode, hashedBackupCodes[i])
        IF isMatch THEN
            foundIndex ← i
            BREAK
        END IF
    END FOR

    IF foundIndex = -1 THEN
        AuditLog.Record("BACKUP_CODE_INVALID", userId, {
            remaining_codes: LENGTH(hashedBackupCodes)
        })
        RETURN false
    END IF

    // Remove used backup code (cannot be reused)
    updatedBackupCodes ← ARRAY_REMOVE_AT(hashedBackupCodes, foundIndex)

    Database.UPDATE admin_two_factor
    SET backup_codes = updatedBackupCodes,
        last_backup_code_used = CURRENT_TIMESTAMP()
    WHERE user_id = userId

    // Alert if running low on backup codes
    IF LENGTH(updatedBackupCodes) <= 2 THEN
        SendNotification(userId, "LOW_BACKUP_CODES", {
            remaining: LENGTH(updatedBackupCodes)
        })
    END IF

    AuditLog.Record("BACKUP_CODE_USED", userId, {
        remaining_codes: LENGTH(updatedBackupCodes)
    })

    RETURN true
END

COMPLEXITY: O(n) where n = number of backup codes (typically 10)
SECURITY:
    - Backup codes must be one-time use only
    - Use constant-time comparison to prevent timing attacks
    - Rate limit backup code attempts (max 3 per 5 minutes)
    - Alert user when backup codes are running low
    - Regenerate backup codes if all are exhausted
```

---

## 2. IP Whitelisting

### 2.1 IP Whitelist Validation

```
ALGORITHM: IsIPWhitelisted
INPUT: ipAddress (string, IPv4 or IPv6)
OUTPUT: boolean (true if whitelisted, false otherwise)
PRECONDITIONS: IP address is valid format
POSTCONDITIONS: None (read-only operation)

BEGIN
    // Normalize IP address
    normalizedIP ← NORMALIZE_IP(ipAddress)

    IF normalizedIP IS NULL THEN
        RETURN false  // Invalid IP format
    END IF

    // Query database for matching whitelist entries
    // Check both exact IP match and CIDR range match
    result ← Database.QUERY("
        SELECT COUNT(*) as count
        FROM admin_ip_whitelist
        WHERE (
            ip_address = INET($1)
            OR INET($1) <<= cidr_range
        )
        AND (expires_at IS NULL OR expires_at > NOW())
    ", normalizedIP)

    isWhitelisted ← result.count > 0

    RETURN isWhitelisted
END

SUBROUTINE: NORMALIZE_IP
INPUT: ipAddress (string)
OUTPUT: normalizedIP (string) or NULL if invalid

BEGIN
    // Remove whitespace
    trimmedIP ← TRIM(ipAddress)

    // Try to parse as IPv4
    IF MATCHES_PATTERN(trimmedIP, IPv4_REGEX) THEN
        RETURN trimmedIP
    END IF

    // Try to parse as IPv6
    IF MATCHES_PATTERN(trimmedIP, IPv6_REGEX) THEN
        // Expand abbreviated IPv6 notation
        RETURN EXPAND_IPv6(trimmedIP)
    END IF

    RETURN NULL  // Invalid format
END

COMPLEXITY: O(log n) - database index lookup on IP address
SECURITY:
    - Validate IP format before database query
    - Support both IPv4 and IPv6
    - Check expiration timestamps for temporary whitelist entries
    - Log non-whitelisted access attempts
```

### 2.2 CIDR Range Matching

```
ALGORITHM: MatchesCIDRRange
INPUT: ipAddress (string), cidrRange (string, e.g., "192.168.1.0/24")
OUTPUT: boolean (true if IP is within CIDR range)
PRECONDITIONS: IP address and CIDR range are valid formats
POSTCONDITIONS: None (pure function)

BEGIN
    // Parse CIDR notation
    parts ← SPLIT(cidrRange, "/")
    networkAddress ← parts[0]
    prefixLength ← INTEGER(parts[1])

    // Convert IP addresses to 32-bit integers (IPv4)
    ipInt ← IP_TO_INTEGER(ipAddress)
    networkInt ← IP_TO_INTEGER(networkAddress)

    // Create subnet mask
    // Example: /24 = 11111111.11111111.11111111.00000000
    mask ← (0xFFFFFFFF << (32 - prefixLength)) AND 0xFFFFFFFF

    // Apply mask to both IPs and compare
    ipNetwork ← ipInt AND mask
    expectedNetwork ← networkInt AND mask

    RETURN ipNetwork = expectedNetwork
END

SUBROUTINE: IP_TO_INTEGER
INPUT: ipAddress (string, IPv4)
OUTPUT: integer (32-bit)

BEGIN
    octets ← SPLIT(ipAddress, ".")

    result ← (INTEGER(octets[0]) << 24) OR
             (INTEGER(octets[1]) << 16) OR
             (INTEGER(octets[2]) << 8) OR
             INTEGER(octets[3])

    RETURN result
END

COMPLEXITY: O(1) - bitwise operations
SECURITY:
    - Validate CIDR range format (prefix length 0-32 for IPv4)
    - For IPv6, use 128-bit arithmetic
    - Consider using database native CIDR matching (PostgreSQL inet type)
```

### 2.3 Dynamic Whitelist Management

```
ALGORITHM: AddIPToWhitelist
INPUT: ipAddress (string), description (string), addedBy (string), expiresAt (Date, optional)
OUTPUT: whitelistEntry (object) or error
PRECONDITIONS: Requester has Super Admin privileges
POSTCONDITIONS: IP is whitelisted, audit log created

BEGIN
    // Validate IP address format
    IF NOT IS_VALID_IP(ipAddress) AND NOT IS_VALID_CIDR(ipAddress) THEN
        THROW ERROR("Invalid IP address or CIDR range format")
    END IF

    // Check for duplicate entries
    existingEntry ← Database.SELECT FROM admin_ip_whitelist
                    WHERE ip_address = ipAddress OR cidr_range = ipAddress

    IF existingEntry IS NOT NULL THEN
        THROW ERROR("IP or range already whitelisted")
    END IF

    // Determine if CIDR range or single IP
    isCIDR ← CONTAINS(ipAddress, "/")

    // Create whitelist entry
    entry ← Database.INSERT INTO admin_ip_whitelist (
        id: GENERATE_UUID(),
        ip_address: IF isCIDR THEN NULL ELSE ipAddress,
        cidr_range: IF isCIDR THEN ipAddress ELSE NULL,
        description: description,
        added_by: addedBy,
        added_at: CURRENT_TIMESTAMP(),
        expires_at: expiresAt
    )

    // Audit log
    AuditLog.Record("IP_WHITELIST_ADD", addedBy, {
        ip: ipAddress,
        description: description,
        expires_at: expiresAt
    })

    // Send notification to security team
    SendNotification("SECURITY_TEAM", "IP_WHITELIST_MODIFIED", {
        action: "ADD",
        ip: ipAddress,
        added_by: addedBy
    })

    RETURN entry
END

ALGORITHM: RemoveIPFromWhitelist
INPUT: whitelistId (string), removedBy (string)
OUTPUT: boolean (success)
PRECONDITIONS: Requester has Super Admin privileges
POSTCONDITIONS: IP is removed from whitelist, audit log created

BEGIN
    // Retrieve entry before deletion
    entry ← Database.SELECT FROM admin_ip_whitelist
            WHERE id = whitelistId

    IF entry IS NULL THEN
        THROW ERROR("Whitelist entry not found")
    END IF

    // Delete entry
    Database.DELETE FROM admin_ip_whitelist
    WHERE id = whitelistId

    // Audit log
    AuditLog.Record("IP_WHITELIST_REMOVE", removedBy, {
        ip: entry.ip_address OR entry.cidr_range,
        reason: "Manual removal"
    })

    // Invalidate all active admin sessions from this IP
    InvalidateSessionsByIP(entry.ip_address OR entry.cidr_range)

    RETURN true
END

COMPLEXITY: O(log n) - database operations with indexes
SECURITY:
    - Only Super Admins can modify whitelist
    - Audit all whitelist changes
    - Support expiration for temporary access
    - Invalidate sessions when IP is removed
```

---

## 3. Session Security

### 3.1 Admin Session Creation

```
ALGORITHM: CreateAdminSession
INPUT: userId (string), ipAddress (string), userAgent (string)
OUTPUT: session (object with token)
PRECONDITIONS: User authenticated with password + 2FA, IP is whitelisted
POSTCONDITIONS: New session created, old sessions invalidated (single session enforcement)

CONSTANTS:
    SESSION_MAX_AGE = 4 * 60 * 60 * 1000       // 4 hours in milliseconds
    SESSION_IDLE_TIMEOUT = 30 * 60 * 1000      // 30 minutes in milliseconds
    SINGLE_SESSION_ENFORCEMENT = true

BEGIN
    // Single session enforcement: invalidate existing sessions
    IF SINGLE_SESSION_ENFORCEMENT THEN
        existingSessions ← Database.SELECT FROM admin_sessions
                           WHERE user_id = userId

        FOR EACH session IN existingSessions DO
            Database.DELETE FROM admin_sessions
            WHERE id = session.id

            AuditLog.Record("SESSION_INVALIDATED", userId, {
                session_id: session.id,
                reason: "New login (single session enforcement)"
            })
        END FOR
    END IF

    // Generate cryptographically secure session token
    tokenBytes ← GENERATE_RANDOM_BYTES(32)
    token ← TO_HEX(tokenBytes)

    // Hash token for storage (prevent token theft from database)
    hashedToken ← SHA256(token)

    currentTime ← CURRENT_TIMESTAMP()
    expiresAt ← currentTime + SESSION_MAX_AGE

    // Create session record
    session ← Database.INSERT INTO admin_sessions (
        id: GENERATE_UUID(),
        user_id: userId,
        token: hashedToken,
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: currentTime,
        last_activity: currentTime,
        expires_at: expiresAt
    )

    // Audit log
    AuditLog.Record("ADMIN_SESSION_CREATED", userId, {
        ip_address: ipAddress,
        user_agent: TRUNCATE(userAgent, 100),
        expires_at: expiresAt
    })

    // Return session with plain text token (only time it's available)
    RETURN {
        id: session.id,
        token: token,  // Plain text, must be stored securely by client
        expires_at: expiresAt,
        idle_timeout: SESSION_IDLE_TIMEOUT
    }
END

COMPLEXITY: O(n) where n = number of existing sessions (typically 1)
SECURITY:
    - Generate 256-bit cryptographically secure token
    - Hash token before storage (SHA-256)
    - Bind session to IP address and User-Agent
    - Single session enforcement prevents session sharing
    - Log session creation for audit trail
```

### 3.2 Session Validation

```
ALGORITHM: ValidateAdminSession
INPUT: token (string), ipAddress (string), userAgent (string)
OUTPUT: session (object) or NULL if invalid
PRECONDITIONS: Token provided by authenticated admin
POSTCONDITIONS: Session activity timestamp updated if valid

CONSTANTS:
    SESSION_IDLE_TIMEOUT = 30 * 60 * 1000  // 30 minutes

BEGIN
    // Hash token for lookup
    hashedToken ← SHA256(token)

    // Retrieve session from database
    session ← Database.SELECT FROM admin_sessions
              WHERE token = hashedToken
              AND expires_at > CURRENT_TIMESTAMP()

    IF session IS NULL THEN
        RETURN NULL  // Session not found or expired
    END IF

    currentTime ← CURRENT_TIMESTAMP()

    // Check idle timeout
    idleTime ← currentTime - session.last_activity
    IF idleTime > SESSION_IDLE_TIMEOUT THEN
        // Session expired due to inactivity
        Database.DELETE FROM admin_sessions WHERE id = session.id

        AuditLog.Record("SESSION_EXPIRED", session.user_id, {
            session_id: session.id,
            reason: "Idle timeout exceeded",
            idle_time: idleTime
        })

        RETURN NULL
    END IF

    // Verify IP address binding
    IF session.ip_address != ipAddress THEN
        // Potential session hijacking
        Database.DELETE FROM admin_sessions WHERE id = session.id

        AuditLog.Record("SESSION_HIJACK_ATTEMPT", session.user_id, {
            session_id: session.id,
            original_ip: session.ip_address,
            attempted_ip: ipAddress,
            severity: "CRITICAL"
        })

        // Alert security team
        SendSecurityAlert("SESSION_HIJACK_DETECTED", {
            user_id: session.user_id,
            original_ip: session.ip_address,
            suspicious_ip: ipAddress
        })

        RETURN NULL
    END IF

    // Verify User-Agent binding
    IF session.user_agent != userAgent THEN
        // Potential session hijacking
        Database.DELETE FROM admin_sessions WHERE id = session.id

        AuditLog.Record("SESSION_HIJACK_ATTEMPT", session.user_id, {
            session_id: session.id,
            reason: "User-Agent mismatch",
            original_ua: session.user_agent,
            attempted_ua: userAgent,
            severity: "CRITICAL"
        })

        SendSecurityAlert("SESSION_HIJACK_DETECTED", {
            user_id: session.user_id,
            details: "User-Agent mismatch"
        })

        RETURN NULL
    END IF

    // Update last activity timestamp
    Database.UPDATE admin_sessions
    SET last_activity = currentTime
    WHERE id = session.id

    RETURN session
END

COMPLEXITY: O(log n) - database index lookup on hashed token
SECURITY:
    - Constant-time token comparison to prevent timing attacks
    - Detect session hijacking via IP and User-Agent binding
    - Automatic session invalidation on suspicious activity
    - Real-time security alerts for critical events
    - Idle timeout prevents abandoned session exploitation
```

### 3.3 Session Hijacking Detection

```
ALGORITHM: DetectSessionHijacking
INPUT: session (object), currentIP (string), currentUserAgent (string)
OUTPUT: {isLegitimate: boolean, riskScore: number, details: object}
PRECONDITIONS: Session exists and not expired
POSTCONDITIONS: Risk assessment logged

BEGIN
    riskScore ← 0
    anomalies ← []

    // Check IP address change
    IF session.ip_address != currentIP THEN
        // Check if IPs are in same subnet (might be load balancer)
        IF NOT IN_SAME_SUBNET(session.ip_address, currentIP, "/24") THEN
            riskScore ← riskScore + 50
            anomalies.APPEND({
                type: "IP_CHANGE",
                severity: "HIGH",
                original: session.ip_address,
                current: currentIP
            })
        ELSE
            riskScore ← riskScore + 10
            anomalies.APPEND({
                type: "IP_CHANGE_SAME_SUBNET",
                severity: "LOW"
            })
        END IF
    END IF

    // Check User-Agent change
    IF session.user_agent != currentUserAgent THEN
        riskScore ← riskScore + 30
        anomalies.APPEND({
            type: "USER_AGENT_CHANGE",
            severity: "MEDIUM",
            original: session.user_agent,
            current: currentUserAgent
        })
    END IF

    // Check geographic location change (requires GeoIP lookup)
    originalLocation ← GEOIP_LOOKUP(session.ip_address)
    currentLocation ← GEOIP_LOOKUP(currentIP)

    IF originalLocation.country != currentLocation.country THEN
        riskScore ← riskScore + 40
        anomalies.APPEND({
            type: "COUNTRY_CHANGE",
            severity: "HIGH",
            original: originalLocation.country,
            current: currentLocation.country
        })
    END IF

    // Check for impossible travel
    distance ← CALCULATE_DISTANCE(originalLocation, currentLocation)
    timeDiff ← (CURRENT_TIMESTAMP() - session.last_activity) / 1000  // seconds
    requiredSpeed ← distance / timeDiff  // km/s

    // Human travel speed threshold: ~250 m/s (900 km/h - commercial jet)
    IF requiredSpeed > 0.25 THEN
        riskScore ← riskScore + 60
        anomalies.APPEND({
            type: "IMPOSSIBLE_TRAVEL",
            severity: "CRITICAL",
            distance_km: distance,
            time_seconds: timeDiff,
            required_speed_kmh: requiredSpeed * 3600
        })
    END IF

    // Determine if legitimate based on risk score
    isLegitimate ← riskScore < 50  // Threshold for session invalidation

    // Log risk assessment
    AuditLog.Record("SESSION_RISK_ASSESSMENT", session.user_id, {
        session_id: session.id,
        risk_score: riskScore,
        anomalies: anomalies,
        action: IF isLegitimate THEN "ALLOWED" ELSE "BLOCKED"
    })

    RETURN {
        isLegitimate: isLegitimate,
        riskScore: riskScore,
        details: anomalies
    }
END

COMPLEXITY: O(1) - constant time checks (assuming O(1) GeoIP lookup)
SECURITY:
    - Multi-factor risk assessment (IP, location, User-Agent, travel speed)
    - Configurable risk score threshold
    - Detailed anomaly logging for investigation
    - Real-time alerts for high-risk sessions
```

---

## 4. Sensitive Action Re-authentication

### 4.1 Re-authentication Flow

```
ALGORITHM: RequireReauthentication
INPUT: userId (string), action (string), password (string)
OUTPUT: boolean (true if re-auth successful, false otherwise)
PRECONDITIONS: User has active admin session
POSTCONDITIONS: Re-auth attempt logged, password verified

CONSTANTS:
    SENSITIVE_ACTIONS = [
        "DELETE_USER",
        "BAN_USER",
        "CREATE_ADMIN",
        "MODIFY_SYSTEM_SETTINGS",
        "EXPORT_USER_DATA",
        "MODIFY_IP_WHITELIST",
        "RESET_2FA"
    ]
    REAUTH_VALID_DURATION = 5 * 60 * 1000  // 5 minutes

BEGIN
    // Check if action requires re-authentication
    IF NOT action IN SENSITIVE_ACTIONS THEN
        RETURN true  // No re-auth needed
    END IF

    // Check if recently re-authenticated (within last 5 minutes)
    recentReauth ← Cache.GET("reauth:" + userId + ":" + action)
    IF recentReauth IS NOT NULL THEN
        recentReauthTime ← PARSE_TIMESTAMP(recentReauth)
        IF (CURRENT_TIMESTAMP() - recentReauthTime) < REAUTH_VALID_DURATION THEN
            RETURN true  // Recent re-auth still valid
        END IF
    END IF

    // Retrieve user's password hash
    user ← Database.SELECT FROM users
           WHERE id = userId

    IF user IS NULL THEN
        RETURN false
    END IF

    // Verify password
    isPasswordValid ← BCRYPT_COMPARE(password, user.password_hash)

    IF NOT isPasswordValid THEN
        // Log failed re-authentication
        AuditLog.Record("REAUTH_FAILED", userId, {
            attempted_action: action,
            timestamp: CURRENT_TIMESTAMP(),
            ip_address: REQUEST_IP()
        })

        // Increment failed attempt counter
        failedAttempts ← Cache.INCREMENT("reauth_failed:" + userId)

        // Lock account if too many failed attempts (3 in 5 minutes)
        IF failedAttempts >= 3 THEN
            LockAdminAccount(userId, duration=60*60*1000)  // 1 hour

            AuditLog.Record("ADMIN_ACCOUNT_LOCKED", userId, {
                reason: "Too many failed re-auth attempts",
                attempts: failedAttempts
            })

            SendSecurityAlert("ADMIN_ACCOUNT_LOCKED", {
                user_id: userId,
                reason: "Multiple failed re-authentication attempts"
            })
        END IF

        RETURN false
    END IF

    // Cache successful re-authentication
    Cache.SET("reauth:" + userId + ":" + action,
              CURRENT_TIMESTAMP(),
              expire=REAUTH_VALID_DURATION)

    // Reset failed attempt counter
    Cache.DELETE("reauth_failed:" + userId)

    // Log successful re-authentication
    AuditLog.Record("REAUTH_SUCCESS", userId, {
        action: action,
        timestamp: CURRENT_TIMESTAMP()
    })

    RETURN true
END

COMPLEXITY: O(1) - password verification and cache operations
SECURITY:
    - Require re-auth for all sensitive actions
    - Cache re-auth for 5 minutes to prevent UI friction
    - Rate limit re-auth attempts (max 3 failures in 5 minutes)
    - Lock account on repeated failures
    - Use bcrypt for password verification (timing attack resistant)
```

### 4.2 Sensitive Action Classification

```
ALGORITHM: ClassifySensitiveAction
INPUT: action (string), targetType (string), targetId (string)
OUTPUT: {isSensitive: boolean, requiredRole: string, requiresReauth: boolean}
PRECONDITIONS: Action and target are valid
POSTCONDITIONS: None (pure function)

BEGIN
    // Define action sensitivity levels
    sensitivityMatrix ← {
        // User Management
        "VIEW_USER": {isSensitive: false, requiredRole: "moderator", requiresReauth: false},
        "WARN_USER": {isSensitive: false, requiredRole: "moderator", requiresReauth: false},
        "SUSPEND_USER": {isSensitive: true, requiredRole: "moderator", requiresReauth: false},
        "BAN_USER": {isSensitive: true, requiredRole: "admin", requiresReauth: true},
        "DELETE_USER": {isSensitive: true, requiredRole: "admin", requiresReauth: true},

        // Content Management
        "DELETE_CONTENT": {isSensitive: false, requiredRole: "moderator", requiresReauth: false},
        "RESTORE_CONTENT": {isSensitive: false, requiredRole: "moderator", requiresReauth: false},

        // Admin Management
        "CREATE_MODERATOR": {isSensitive: true, requiredRole: "admin", requiresReauth: false},
        "CREATE_ADMIN": {isSensitive: true, requiredRole: "super_admin", requiresReauth: true},
        "MODIFY_ADMIN_ROLE": {isSensitive: true, requiredRole: "super_admin", requiresReauth: true},
        "REMOVE_ADMIN": {isSensitive: true, requiredRole: "super_admin", requiresReauth: true},

        // System Configuration
        "VIEW_SETTINGS": {isSensitive: false, requiredRole: "admin", requiresReauth: false},
        "MODIFY_SETTINGS": {isSensitive: true, requiredRole: "super_admin", requiresReauth: true},
        "MODIFY_IP_WHITELIST": {isSensitive: true, requiredRole: "super_admin", requiresReauth: true},

        // Data Export
        "EXPORT_USER_DATA": {isSensitive: true, requiredRole: "admin", requiresReauth: true},
        "EXPORT_AUDIT_LOGS": {isSensitive: true, requiredRole: "admin", requiresReauth: true},

        // Security
        "RESET_2FA": {isSensitive: true, requiredRole: "super_admin", requiresReauth: true},
        "VIEW_AUDIT_LOGS": {isSensitive: false, requiredRole: "admin", requiresReauth: false}
    }

    // Lookup action in sensitivity matrix
    IF action IN sensitivityMatrix THEN
        classification ← sensitivityMatrix[action]
    ELSE
        // Default to most restrictive if action not found
        classification ← {
            isSensitive: true,
            requiredRole: "super_admin",
            requiresReauth: true
        }
    END IF

    RETURN classification
END

COMPLEXITY: O(1) - hash table lookup
SECURITY:
    - Default deny for unknown actions
    - Separate sensitivity from required role
    - Explicit re-auth requirement per action
    - Easily auditable and maintainable
```

---

## 5. Audit Logging

### 5.1 Audit Log Creation

```
ALGORITHM: RecordAuditLog
INPUT: action (string), actorId (string), targetType (string, optional),
       targetId (string, optional), details (object, optional)
OUTPUT: auditLogId (string)
PRECONDITIONS: Action is valid, actor is authenticated
POSTCONDITIONS: Audit log entry created, critical actions trigger alerts

BEGIN
    currentTime ← CURRENT_TIMESTAMP()
    ipAddress ← REQUEST_IP()
    userAgent ← REQUEST_USER_AGENT()

    // Create audit log entry
    auditLog ← Database.INSERT INTO admin_audit_logs (
        id: GENERATE_UUID(),
        action: action,
        actor_id: actorId,
        target_type: targetType,
        target_id: targetId,
        ip_address: ipAddress,
        user_agent: TRUNCATE(userAgent, 500),
        details: JSON_STRINGIFY(details),
        created_at: currentTime
    )

    // Check if action is critical and requires alert
    IF IsCriticalAction(action) THEN
        SendCriticalActionAlert(auditLog)
    END IF

    // Check for suspicious patterns
    suspiciousPattern ← DetectSuspiciousPattern(actorId, action)
    IF suspiciousPattern.detected THEN
        SendSecurityAlert("SUSPICIOUS_ACTIVITY", {
            actor_id: actorId,
            pattern: suspiciousPattern.pattern,
            audit_log_id: auditLog.id
        })
    END IF

    RETURN auditLog.id
END

SUBROUTINE: IsCriticalAction
INPUT: action (string)
OUTPUT: boolean

BEGIN
    criticalActions ← [
        "USER_BANNED",
        "USER_DELETED",
        "ADMIN_CREATED",
        "ADMIN_REMOVED",
        "ADMIN_ROLE_CHANGED",
        "SETTING_CHANGED",
        "SESSION_HIJACK_ATTEMPT",
        "IP_WHITELIST_ADD",
        "IP_WHITELIST_REMOVE",
        "DATA_EXPORTED",
        "RESET_2FA"
    ]

    RETURN action IN criticalActions
END

SUBROUTINE: DetectSuspiciousPattern
INPUT: actorId (string), action (string)
OUTPUT: {detected: boolean, pattern: string}

BEGIN
    currentTime ← CURRENT_TIMESTAMP()
    oneHourAgo ← currentTime - (60 * 60 * 1000)

    // Count recent actions by this actor
    recentActions ← Database.SELECT COUNT(*) as count
                    FROM admin_audit_logs
                    WHERE actor_id = actorId
                    AND created_at > oneHourAgo

    // Pattern 1: Excessive activity (>100 actions/hour)
    IF recentActions.count > 100 THEN
        RETURN {detected: true, pattern: "EXCESSIVE_ACTIVITY"}
    END IF

    // Pattern 2: Multiple failed login attempts
    IF action = "ADMIN_LOGIN_FAILED" THEN
        failedLogins ← Database.SELECT COUNT(*) as count
                       FROM admin_audit_logs
                       WHERE actor_id = actorId
                       AND action = "ADMIN_LOGIN_FAILED"
                       AND created_at > oneHourAgo

        IF failedLogins.count >= 3 THEN
            RETURN {detected: true, pattern: "MULTIPLE_FAILED_LOGINS"}
        END IF
    END IF

    // Pattern 3: Bulk deletions
    IF action IN ["DELETE_USER", "DELETE_CONTENT"] THEN
        deletions ← Database.SELECT COUNT(*) as count
                    FROM admin_audit_logs
                    WHERE actor_id = actorId
                    AND action IN ("DELETE_USER", "DELETE_CONTENT")
                    AND created_at > oneHourAgo

        IF deletions.count > 20 THEN
            RETURN {detected: true, pattern: "BULK_DELETION"}
        END IF
    END IF

    // Pattern 4: After-hours access (outside 6 AM - 10 PM)
    currentHour ← GET_HOUR(currentTime)
    IF currentHour < 6 OR currentHour >= 22 THEN
        RETURN {detected: true, pattern: "AFTER_HOURS_ACCESS"}
    END IF

    RETURN {detected: false, pattern: NULL}
END

COMPLEXITY: O(1) for log creation, O(log n) for pattern detection (indexed queries)
SECURITY:
    - Log all admin actions without exception
    - Include IP and User-Agent for forensics
    - Detect and alert on suspicious patterns
    - Immutable logs (no DELETE or UPDATE allowed)
    - Partition by month for performance and archival
```

### 5.2 Audit Log Querying

```
ALGORITHM: QueryAuditLogs
INPUT: filters (object: {actorId, action, targetType, targetId, from, to, limit, offset})
OUTPUT: {logs: array, total: number, hasMore: boolean}
PRECONDITIONS: Requester has admin privileges
POSTCONDITIONS: Query results logged for audit trail

BEGIN
    // Build WHERE clause dynamically
    whereConditions ← []
    parameters ← []

    IF filters.actorId IS NOT NULL THEN
        whereConditions.APPEND("actor_id = ?")
        parameters.APPEND(filters.actorId)
    END IF

    IF filters.action IS NOT NULL THEN
        whereConditions.APPEND("action = ?")
        parameters.APPEND(filters.action)
    END IF

    IF filters.targetType IS NOT NULL THEN
        whereConditions.APPEND("target_type = ?")
        parameters.APPEND(filters.targetType)
    END IF

    IF filters.targetId IS NOT NULL THEN
        whereConditions.APPEND("target_id = ?")
        parameters.APPEND(filters.targetId)
    END IF

    IF filters.from IS NOT NULL THEN
        whereConditions.APPEND("created_at >= ?")
        parameters.APPEND(filters.from)
    END IF

    IF filters.to IS NOT NULL THEN
        whereConditions.APPEND("created_at <= ?")
        parameters.APPEND(filters.to)
    END IF

    whereClause ← JOIN(whereConditions, " AND ")
    IF LENGTH(whereClause) = 0 THEN
        whereClause ← "1=1"  // Return all if no filters
    END IF

    // Set pagination defaults
    limit ← filters.limit OR 100
    offset ← filters.offset OR 0

    // Enforce maximum limit (prevent excessive data retrieval)
    IF limit > 1000 THEN
        limit ← 1000
    END IF

    // Get total count (for pagination)
    countQuery ← "SELECT COUNT(*) as total FROM admin_audit_logs WHERE " + whereClause
    totalResult ← Database.QUERY(countQuery, parameters)
    total ← totalResult.total

    // Get paginated logs
    logsQuery ← "
        SELECT id, action, actor_id, target_type, target_id,
               ip_address, user_agent, details, created_at
        FROM admin_audit_logs
        WHERE " + whereClause + "
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    "
    parameters.APPEND(limit)
    parameters.APPEND(offset)

    logs ← Database.QUERY(logsQuery, parameters)

    hasMore ← (offset + limit) < total

    // Log the audit query itself (meta-audit)
    RecordAuditLog("AUDIT_LOGS_QUERIED", REQUEST_USER_ID(), NULL, NULL, {
        filters: filters,
        results_count: LENGTH(logs)
    })

    RETURN {
        logs: logs,
        total: total,
        hasMore: hasMore
    }
END

COMPLEXITY: O(log n + k) where n = total logs, k = returned results
SECURITY:
    - Enforce maximum page size to prevent DoS
    - Log all audit queries (who looked at audit logs)
    - Use parameterized queries to prevent SQL injection
    - Index on actor_id, action, created_at for performance
```

### 5.3 Critical Action Alerting

```
ALGORITHM: SendCriticalActionAlert
INPUT: auditLog (object)
OUTPUT: none (sends alert)
PRECONDITIONS: Audit log is for critical action
POSTCONDITIONS: Alert sent via Slack/email, alert logged

BEGIN
    // Retrieve actor details
    actor ← Database.SELECT username, email, role
            FROM users
            WHERE id = auditLog.actor_id

    // Retrieve target details (if applicable)
    targetInfo ← NULL
    IF auditLog.target_type IS NOT NULL THEN
        targetInfo ← GetTargetInfo(auditLog.target_type, auditLog.target_id)
    END IF

    // Format alert message
    alertMessage ← FORMAT("
        🚨 Critical Admin Action Alert

        Action: {0}
        Actor: {1} ({2})
        Role: {3}
        Time: {4}
        IP: {5}

        {6}

        Details: {7}
    ",
        auditLog.action,
        actor.username,
        actor.email,
        actor.role,
        FORMAT_TIMESTAMP(auditLog.created_at),
        auditLog.ip_address,
        IF targetInfo THEN "Target: " + targetInfo ELSE "",
        JSON_STRINGIFY(auditLog.details, pretty=true)
    )

    // Send Slack notification
    SlackAPI.SendMessage({
        channel: "#admin-alerts",
        text: alertMessage,
        attachments: [{
            color: IF auditLog.action CONTAINS "HIJACK" THEN "danger" ELSE "warning",
            fields: [
                {title: "Audit Log ID", value: auditLog.id, short: true},
                {title: "Severity", value: GetSeverity(auditLog.action), short: true}
            ],
            footer: "Admin Audit System",
            ts: UNIX_TIMESTAMP(auditLog.created_at)
        }]
    })

    // Send email to security team (for critical actions only)
    IF GetSeverity(auditLog.action) = "CRITICAL" THEN
        EmailAPI.Send({
            to: ["security@example.com"],
            subject: FORMAT("CRITICAL: Admin Action - {0}", auditLog.action),
            body: alertMessage,
            priority: "HIGH"
        })
    END IF

    // Log alert sent
    RecordAuditLog("ALERT_SENT", "SYSTEM", "audit_log", auditLog.id, {
        action: auditLog.action,
        channels: ["slack", IF GetSeverity(auditLog.action) = "CRITICAL" THEN "email" ELSE NULL]
    })
END

SUBROUTINE: GetSeverity
INPUT: action (string)
OUTPUT: severity (string: "LOW", "MEDIUM", "HIGH", "CRITICAL")

BEGIN
    severityMap ← {
        "SESSION_HIJACK_ATTEMPT": "CRITICAL",
        "USER_DELETED": "CRITICAL",
        "ADMIN_REMOVED": "CRITICAL",
        "IP_WHITELIST_REMOVE": "CRITICAL",
        "USER_BANNED": "HIGH",
        "ADMIN_CREATED": "HIGH",
        "SETTING_CHANGED": "HIGH",
        "DATA_EXPORTED": "MEDIUM",
        "USER_SUSPENDED": "MEDIUM",
        "IP_WHITELIST_ADD": "MEDIUM"
    }

    IF action IN severityMap THEN
        RETURN severityMap[action]
    ELSE
        RETURN "LOW"
    END IF
END

COMPLEXITY: O(1) - alert sending is asynchronous
SECURITY:
    - Alert on all critical actions immediately
    - Include full context (actor, target, details, IP)
    - Multi-channel alerts (Slack + email for critical)
    - Log all alerts sent for accountability
```

---

## 6. Rate Limiting

### 6.1 Admin Endpoint Rate Limiting

```
ALGORITHM: CheckAdminRateLimit
INPUT: userId (string), action (string), endpoint (string)
OUTPUT: {allowed: boolean, remaining: number, resetAt: timestamp}
PRECONDITIONS: User is authenticated as admin
POSTCONDITIONS: Rate limit counter incremented if allowed

CONSTANTS:
    RATE_LIMITS = {
        "LOGIN_ATTEMPT": {points: 5, duration: 15*60, blockDuration: 60*60},
        "2FA_ATTEMPT": {points: 3, duration: 5*60, blockDuration: 60*60},
        "USER_MODERATION": {points: 50, duration: 60*60, blockDuration: 0},
        "CONTENT_DELETION": {points: 100, duration: 60*60, blockDuration: 0},
        "BULK_OPERATION": {points: 10, duration: 60*60, blockDuration: 0},
        "DATA_EXPORT": {points: 5, duration: 24*60*60, blockDuration: 0}
    }

BEGIN
    // Determine rate limit category
    category ← MapActionToCategory(action)

    IF category NOT IN RATE_LIMITS THEN
        category ← "DEFAULT"
        RATE_LIMITS["DEFAULT"] ← {points: 50, duration: 60*60, blockDuration: 0}
    END IF

    limits ← RATE_LIMITS[category]

    // Generate rate limit key
    rateLimitKey ← FORMAT("admin_rl:{0}:{1}:{2}", category, userId,
                          FLOOR(CURRENT_TIMESTAMP() / limits.duration))

    // Get current count from Redis
    currentCount ← Redis.GET(rateLimitKey)
    IF currentCount IS NULL THEN
        currentCount ← 0
    END IF

    // Check if blocked
    blockKey ← FORMAT("admin_rl_block:{0}:{1}", category, userId)
    isBlocked ← Redis.EXISTS(blockKey)

    IF isBlocked THEN
        blockExpiry ← Redis.TTL(blockKey)

        AuditLog.Record("RATE_LIMIT_BLOCKED", userId, {
            action: action,
            category: category,
            block_remaining: blockExpiry
        })

        RETURN {
            allowed: false,
            remaining: 0,
            resetAt: CURRENT_TIMESTAMP() + (blockExpiry * 1000)
        }
    END IF

    // Check if limit exceeded
    IF currentCount >= limits.points THEN
        remaining ← 0

        // Apply block if specified
        IF limits.blockDuration > 0 THEN
            Redis.SETEX(blockKey, limits.blockDuration, "1")
        END IF

        AuditLog.Record("RATE_LIMIT_EXCEEDED", userId, {
            action: action,
            category: category,
            current_count: currentCount,
            limit: limits.points
        })

        SendNotification(userId, "RATE_LIMIT_EXCEEDED", {
            action: action,
            limit: limits.points,
            duration: limits.duration
        })

        RETURN {
            allowed: false,
            remaining: 0,
            resetAt: CURRENT_TIMESTAMP() + (limits.duration * 1000)
        }
    END IF

    // Increment counter
    newCount ← Redis.INCR(rateLimitKey)

    // Set expiry if first request in window
    IF newCount = 1 THEN
        Redis.EXPIRE(rateLimitKey, limits.duration)
    END IF

    remaining ← limits.points - newCount
    resetAt ← CURRENT_TIMESTAMP() + (Redis.TTL(rateLimitKey) * 1000)

    RETURN {
        allowed: true,
        remaining: remaining,
        resetAt: resetAt
    }
END

SUBROUTINE: MapActionToCategory
INPUT: action (string)
OUTPUT: category (string)

BEGIN
    categoryMap ← {
        "ADMIN_LOGIN": "LOGIN_ATTEMPT",
        "ADMIN_LOGIN_FAILED": "LOGIN_ATTEMPT",
        "2FA_VERIFY": "2FA_ATTEMPT",
        "WARN_USER": "USER_MODERATION",
        "SUSPEND_USER": "USER_MODERATION",
        "BAN_USER": "USER_MODERATION",
        "DELETE_CONTENT": "CONTENT_DELETION",
        "CREATE_ADMIN": "BULK_OPERATION",
        "DELETE_USER": "BULK_OPERATION",
        "EXPORT_USER_DATA": "DATA_EXPORT",
        "EXPORT_AUDIT_LOGS": "DATA_EXPORT"
    }

    IF action IN categoryMap THEN
        RETURN categoryMap[action]
    ELSE
        RETURN "DEFAULT"
    END IF
END

COMPLEXITY: O(1) - Redis operations are constant time
SECURITY:
    - Different rate limits per action category
    - Temporary blocks for security-critical endpoints (login, 2FA)
    - Sliding window prevents burst attacks
    - Alert on rate limit violations
    - Use Redis for distributed rate limiting
```

### 6.2 Login Attempt Limiting with Account Lockout

```
ALGORITHM: CheckLoginRateLimit
INPUT: identifier (string, email or username), ipAddress (string)
OUTPUT: {allowed: boolean, remainingAttempts: number, lockedUntil: timestamp}
PRECONDITIONS: Login attempt initiated
POSTCONDITIONS: Failed attempt counted, account locked if threshold exceeded

CONSTANTS:
    MAX_ATTEMPTS = 5
    LOCKOUT_DURATION = 60 * 60  // 1 hour in seconds
    WINDOW = 15 * 60  // 15 minutes in seconds

BEGIN
    currentTime ← UNIX_TIMESTAMP()

    // Check both per-account and per-IP rate limits
    accountKey ← FORMAT("login_attempts:account:{0}", identifier)
    ipKey ← FORMAT("login_attempts:ip:{0}", ipAddress)

    accountAttempts ← Redis.GET(accountKey) OR 0
    ipAttempts ← Redis.GET(ipKey) OR 0

    // Check if account is locked
    accountLockKey ← FORMAT("account_locked:{0}", identifier)
    isAccountLocked ← Redis.EXISTS(accountLockKey)

    IF isAccountLocked THEN
        lockExpiry ← Redis.TTL(accountLockKey)
        lockedUntil ← currentTime + lockExpiry

        AuditLog.Record("LOGIN_ATTEMPT_BLOCKED", NULL, {
            identifier: identifier,
            reason: "Account locked",
            locked_until: lockedUntil,
            ip_address: ipAddress
        })

        RETURN {
            allowed: false,
            remainingAttempts: 0,
            lockedUntil: lockedUntil
        }
    END IF

    // Check if IP is rate limited (prevents brute force across accounts)
    IF ipAttempts >= MAX_ATTEMPTS * 3 THEN
        AuditLog.Record("LOGIN_ATTEMPT_BLOCKED", NULL, {
            reason: "IP rate limit exceeded",
            ip_address: ipAddress,
            attempts: ipAttempts
        })

        RETURN {
            allowed: false,
            remainingAttempts: 0,
            lockedUntil: currentTime + WINDOW
        }
    END IF

    // Check account-specific rate limit
    IF accountAttempts >= MAX_ATTEMPTS THEN
        // Lock account
        Redis.SETEX(accountLockKey, LOCKOUT_DURATION, "1")

        lockedUntil ← currentTime + LOCKOUT_DURATION

        AuditLog.Record("ACCOUNT_LOCKED", NULL, {
            identifier: identifier,
            reason: "Too many failed login attempts",
            attempts: accountAttempts,
            locked_until: lockedUntil,
            ip_address: ipAddress
        })

        // Send notification to account email
        user ← Database.SELECT id, email FROM users
               WHERE email = identifier OR username = identifier

        IF user IS NOT NULL THEN
            SendEmail(user.email, "ACCOUNT_LOCKED_NOTIFICATION", {
                locked_until: FORMAT_TIMESTAMP(lockedUntil),
                reason: "Multiple failed login attempts",
                ip_address: ipAddress
            })
        END IF

        RETURN {
            allowed: false,
            remainingAttempts: 0,
            lockedUntil: lockedUntil
        }
    END IF

    // Allow attempt but track it
    remainingAttempts ← MAX_ATTEMPTS - accountAttempts

    RETURN {
        allowed: true,
        remainingAttempts: remainingAttempts,
        lockedUntil: NULL
    }
END

ALGORITHM: RecordFailedLoginAttempt
INPUT: identifier (string), ipAddress (string)
OUTPUT: none
PRECONDITIONS: Login attempt failed
POSTCONDITIONS: Failure counted, potential account lock triggered

BEGIN
    accountKey ← FORMAT("login_attempts:account:{0}", identifier)
    ipKey ← FORMAT("login_attempts:ip:{0}", ipAddress)

    // Increment counters
    accountAttempts ← Redis.INCR(accountKey)
    ipAttempts ← Redis.INCR(ipKey)

    // Set expiry on first attempt
    IF accountAttempts = 1 THEN
        Redis.EXPIRE(accountKey, WINDOW)
    END IF

    IF ipAttempts = 1 THEN
        Redis.EXPIRE(ipKey, WINDOW)
    END IF

    AuditLog.Record("ADMIN_LOGIN_FAILED", NULL, {
        identifier: identifier,
        ip_address: ipAddress,
        attempts: accountAttempts
    })
END

ALGORITHM: ResetLoginAttempts
INPUT: identifier (string)
OUTPUT: none
PRECONDITIONS: Successful login
POSTCONDITIONS: Attempt counters cleared

BEGIN
    accountKey ← FORMAT("login_attempts:account:{0}", identifier)
    Redis.DELETE(accountKey)

    AuditLog.Record("LOGIN_ATTEMPTS_RESET", NULL, {
        identifier: identifier,
        reason: "Successful login"
    })
END

COMPLEXITY: O(1) - Redis operations
SECURITY:
    - Rate limit by account AND IP address
    - Progressive delay (account lockout increases with repeated violations)
    - Email notification on account lock
    - Audit all failed attempts
    - Prevent brute force across multiple accounts from same IP
```

---

## 7. Permission Enforcement

### 7.1 Role-Based Access Control (RBAC)

```
ALGORITHM: CheckPermission
INPUT: userId (string), action (string), resourceType (string), resourceId (string)
OUTPUT: {allowed: boolean, reason: string}
PRECONDITIONS: User is authenticated
POSTCONDITIONS: Permission check logged

BEGIN
    // Retrieve user role
    user ← Database.SELECT role FROM users WHERE id = userId

    IF user IS NULL THEN
        RETURN {allowed: false, reason: "User not found"}
    END IF

    userRole ← user.role

    // Define permission matrix
    permissions ← GetPermissionMatrix()

    // Get required role for action
    actionInfo ← ClassifySensitiveAction(action, resourceType, resourceId)
    requiredRole ← actionInfo.requiredRole

    // Check if user's role has sufficient privileges
    roleHierarchy ← {
        "super_admin": 3,
        "admin": 2,
        "moderator": 1,
        "user": 0
    }

    userLevel ← roleHierarchy[userRole] OR 0
    requiredLevel ← roleHierarchy[requiredRole] OR 0

    allowed ← userLevel >= requiredLevel

    IF NOT allowed THEN
        reason ← FORMAT("Insufficient permissions. Required: {0}, User has: {1}",
                        requiredRole, userRole)

        AuditLog.Record("PERMISSION_DENIED", userId, resourceType, resourceId, {
            action: action,
            required_role: requiredRole,
            user_role: userRole
        })
    ELSE
        reason ← "Permission granted"
    END IF

    RETURN {allowed: allowed, reason: reason}
END

SUBROUTINE: GetPermissionMatrix
OUTPUT: permissions (nested object)

BEGIN
    RETURN {
        "VIEW_USER": {
            moderator: true,
            admin: true,
            super_admin: true
        },
        "WARN_USER": {
            moderator: true,
            admin: true,
            super_admin: true
        },
        "SUSPEND_USER": {
            moderator: true,
            admin: true,
            super_admin: true
        },
        "BAN_USER": {
            moderator: false,
            admin: true,
            super_admin: true
        },
        "DELETE_USER": {
            moderator: false,
            admin: true,
            super_admin: true
        },
        "DELETE_CONTENT": {
            moderator: true,
            admin: true,
            super_admin: true
        },
        "VIEW_AUDIT_LOGS": {
            moderator: false,
            admin: true,
            super_admin: true
        },
        "CREATE_MODERATOR": {
            moderator: false,
            admin: true,
            super_admin: true
        },
        "CREATE_ADMIN": {
            moderator: false,
            admin: false,
            super_admin: true
        },
        "MODIFY_SYSTEM_SETTINGS": {
            moderator: false,
            admin: false,
            super_admin: true
        },
        "MODIFY_IP_WHITELIST": {
            moderator: false,
            admin: false,
            super_admin: true
        },
        "EXPORT_USER_DATA": {
            moderator: false,
            admin: true,
            super_admin: true
        }
    }
END

COMPLEXITY: O(1) - hash table lookups
SECURITY:
    - Explicit permission matrix (deny by default)
    - Role hierarchy prevents privilege escalation
    - Log all permission denials
    - Centralized permission logic for consistency
```

### 7.2 Resource-Level Authorization

```
ALGORITHM: CheckResourceAccess
INPUT: userId (string), action (string), resource (object)
OUTPUT: {allowed: boolean, reason: string}
PRECONDITIONS: User has role-level permission for action
POSTCONDITIONS: Resource-level access verified

BEGIN
    // First check role-level permission
    rolePermission ← CheckPermission(userId, action, resource.type, resource.id)

    IF NOT rolePermission.allowed THEN
        RETURN rolePermission
    END IF

    // Additional resource-level checks

    // Rule 1: Admins cannot modify their own role
    IF action = "MODIFY_ADMIN_ROLE" AND resource.id = userId THEN
        RETURN {
            allowed: false,
            reason: "Cannot modify your own role"
        }
    END IF

    // Rule 2: Admins cannot remove themselves
    IF action = "REMOVE_ADMIN" AND resource.id = userId THEN
        RETURN {
            allowed: false,
            reason: "Cannot remove your own admin access"
        }
    END IF

    // Rule 3: Admins cannot delete themselves
    IF action = "DELETE_USER" AND resource.id = userId THEN
        RETURN {
            allowed: false,
            reason: "Cannot delete your own account"
        }
    END IF

    // Rule 4: Only Super Admins can modify other Super Admins
    IF action IN ["MODIFY_ADMIN_ROLE", "REMOVE_ADMIN", "BAN_USER"] THEN
        targetUser ← Database.SELECT role FROM users WHERE id = resource.id

        IF targetUser.role = "super_admin" THEN
            currentUser ← Database.SELECT role FROM users WHERE id = userId

            IF currentUser.role != "super_admin" THEN
                RETURN {
                    allowed: false,
                    reason: "Only Super Admins can modify other Super Admins"
                }
            END IF
        END IF
    END IF

    // Rule 5: Prevent privilege escalation
    IF action = "MODIFY_ADMIN_ROLE" THEN
        currentUser ← Database.SELECT role FROM users WHERE id = userId
        targetRole ← resource.new_role

        roleHierarchy ← {
            "super_admin": 3,
            "admin": 2,
            "moderator": 1
        }

        currentLevel ← roleHierarchy[currentUser.role]
        targetLevel ← roleHierarchy[targetRole]

        // Cannot grant a role higher than your own
        IF targetLevel >= currentLevel THEN
            RETURN {
                allowed: false,
                reason: "Cannot grant a role equal to or higher than your own"
            }
        END IF
    END IF

    RETURN {allowed: true, reason: "Resource access granted"}
END

COMPLEXITY: O(1) - database lookups on indexed fields
SECURITY:
    - Prevent self-modification attacks
    - Enforce role hierarchy for privilege escalation prevention
    - Protect Super Admin accounts from lower-privileged admins
    - Explicit rules for sensitive operations
```

---

## 8. Data Structures

### 8.1 Admin Two-Factor Authentication

```
DATA STRUCTURE: AdminTwoFactor

Fields:
    id: UUID (primary key)
    user_id: UUID (foreign key to users table, unique)
    secret: TEXT (encrypted TOTP secret)
    backup_codes: TEXT[] (array of bcrypt hashed backup codes)
    enabled: BOOLEAN (2FA is active)
    verified_at: TIMESTAMP (when 2FA was first verified)
    created_at: TIMESTAMP
    last_backup_code_used: TIMESTAMP

Indexes:
    PRIMARY KEY (id)
    UNIQUE (user_id)
    INDEX (enabled)

Storage:
    - Secret encrypted with AES-256 using master encryption key
    - Backup codes hashed with bcrypt (cost factor 10)
    - Average size: ~2 KB per record

Operations:
    CREATE: O(1) - single INSERT
    READ by user_id: O(1) - unique index lookup
    UPDATE: O(1) - primary key update
    DELETE: O(1) - primary key delete
```

### 8.2 Admin IP Whitelist

```
DATA STRUCTURE: AdminIPWhitelist

Fields:
    id: UUID (primary key)
    ip_address: INET (single IP, nullable)
    cidr_range: CIDR (IP range, nullable)
    description: VARCHAR(255)
    added_by: UUID (foreign key to users table)
    added_at: TIMESTAMP
    expires_at: TIMESTAMP (nullable, for temporary access)

Constraints:
    CHECK (ip_address IS NOT NULL OR cidr_range IS NOT NULL)

Indexes:
    PRIMARY KEY (id)
    INDEX (ip_address)
    INDEX (cidr_range) USING GIST
    INDEX (expires_at)

Storage:
    - Use PostgreSQL INET and CIDR types for efficient IP matching
    - GIST index for CIDR range queries
    - Average size: ~500 bytes per record

Operations:
    CREATE: O(1) - single INSERT
    CHECK IP: O(log n) - B-tree or GIST index lookup
    CHECK CIDR: O(log n) - GIST index with <<= operator
    DELETE expired: O(m) where m = expired entries

Query Performance:
    - Exact IP match: ~0.1ms for millions of entries (B-tree index)
    - CIDR match: ~0.5ms (GIST index)
    - Cleanup expired entries: Run daily cron job
```

### 8.3 Admin Sessions

```
DATA STRUCTURE: AdminSessions

Fields:
    id: UUID (primary key)
    user_id: UUID (foreign key to users table)
    token: TEXT (SHA-256 hashed token)
    ip_address: INET
    user_agent: TEXT
    created_at: TIMESTAMP
    last_activity: TIMESTAMP
    expires_at: TIMESTAMP

Indexes:
    PRIMARY KEY (id)
    UNIQUE (token)
    INDEX (user_id, expires_at)
    INDEX (expires_at)

Storage:
    - Token stored as SHA-256 hash (64 hex characters)
    - User-Agent truncated to 500 characters
    - Average size: ~1 KB per record

Operations:
    CREATE: O(1) - single INSERT
    VALIDATE: O(1) - unique index lookup on token
    UPDATE activity: O(1) - primary key update
    DELETE expired: O(m) where m = expired sessions
    DELETE by user: O(k) where k = user's sessions (typically 1)

Cleanup:
    - Run cleanup job every 5 minutes to delete expired sessions
    - Query: DELETE FROM admin_sessions WHERE expires_at < NOW()
```

### 8.4 Audit Logs

```
DATA STRUCTURE: AdminAuditLogs

Fields:
    id: UUID (primary key)
    action: VARCHAR(100) (indexed)
    actor_id: UUID (foreign key to users table, nullable for system actions)
    target_type: VARCHAR(50) (indexed)
    target_id: UUID
    ip_address: INET
    user_agent: TEXT
    details: JSONB (flexible structure)
    created_at: TIMESTAMP (indexed)

Indexes:
    PRIMARY KEY (id)
    INDEX (actor_id, created_at DESC)
    INDEX (action, created_at DESC)
    INDEX (target_type, target_id, created_at DESC)
    INDEX (created_at DESC)
    GIN INDEX (details) for JSONB queries

Partitioning:
    - Partition by month for performance and archival
    - Example: admin_audit_logs_y2025m12, admin_audit_logs_y2026m01
    - Automatic partition creation via cron job
    - Archive partitions older than 2 years to cold storage

Storage:
    - Average size: ~2 KB per log entry
    - Estimate: 10,000 admin actions/month = 20 MB/month
    - Retention: 2 years online, 5 years archived

Operations:
    INSERT: O(1) - append-only
    QUERY by actor: O(log n + k) where k = results
    QUERY by action: O(log n + k)
    QUERY by time range: O(log n + k) - benefits from partition pruning
    EXPORT: O(n) for full scan, use COPY TO CSV

Query Performance:
    - Recent queries (last 30 days): <100ms
    - Historical queries (last year): <1s with partition pruning
    - Full scan (2 years): ~30s, use async exports
```

### 8.5 Rate Limit Cache (Redis)

```
DATA STRUCTURE: RateLimitCache

Key Patterns:
    admin_rl:{category}:{user_id}:{time_window}
    admin_rl_block:{category}:{user_id}
    login_attempts:account:{identifier}
    login_attempts:ip:{ip_address}
    account_locked:{identifier}

Value Types:
    Counter: INTEGER (incremented on each action)
    Block flag: "1" (with TTL for expiration)

TTL (Time To Live):
    Rate limit counters: Duration of time window (e.g., 3600s for 1 hour)
    Block flags: Block duration (e.g., 3600s for 1 hour lockout)
    Login attempts: 900s (15 minutes)

Storage:
    - Redis in-memory for sub-millisecond performance
    - Persistence: RDB snapshots + AOF for durability
    - Average memory: ~100 bytes per key
    - Estimate: 1000 active admins × 5 categories = 5000 keys = 500 KB

Operations:
    GET: O(1) - ~0.1ms
    SET: O(1) - ~0.1ms
    INCR: O(1) - ~0.1ms
    EXPIRE: O(1) - ~0.1ms
    DELETE: O(1) - ~0.1ms

Distributed Setup:
    - Redis Cluster for horizontal scaling
    - Sentinel for high availability
    - Consistent hashing for key distribution
```

---

## 9. Complexity Analysis Summary

### 9.1 Authentication Operations

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| Generate TOTP Secret | O(1) | O(1) | Constant-time crypto ops |
| Verify TOTP | O(1) | O(1) | Check 3 time windows (±1) |
| Verify Backup Code | O(n) | O(1) | n = backup codes (typ. 10) |
| Setup 2FA | O(1) | O(1) | Database insert |

### 9.2 IP Whitelisting

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| Check IP Whitelist | O(log n) | O(1) | B-tree index on IP |
| Check CIDR Range | O(log n) | O(1) | GIST index for ranges |
| Add IP to Whitelist | O(log n) | O(1) | Insert with index update |
| Remove IP | O(log n) | O(1) | Delete with index update |

n = total whitelist entries (expected: <1000)

### 9.3 Session Management

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| Create Session | O(k) | O(1) | k = existing sessions (typ. 1) |
| Validate Session | O(1) | O(1) | Hash table lookup on token |
| Detect Hijacking | O(1) | O(1) | IP/UA comparison |
| Cleanup Expired | O(m) | O(1) | m = expired sessions |

### 9.4 Audit Logging

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| Record Log | O(1) | O(1) | Append-only insert |
| Query by Actor | O(log n + k) | O(k) | k = result size |
| Query by Action | O(log n + k) | O(k) | Indexed search |
| Query by Time Range | O(log n + k) | O(k) | Partition pruning |
| Detect Suspicious Pattern | O(log n) | O(1) | Count queries on indexed fields |

n = total audit logs (millions), k = query results (<1000)

### 9.5 Rate Limiting

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| Check Rate Limit | O(1) | O(1) | Redis counter lookup |
| Increment Counter | O(1) | O(1) | Redis INCR |
| Apply Block | O(1) | O(1) | Redis SET with TTL |
| Check Login Attempts | O(1) | O(1) | Redis multi-key GET |

### 9.6 Permission Checks

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| Check Role Permission | O(1) | O(1) | Hash table lookup |
| Check Resource Access | O(1) | O(1) | Index lookup on user ID |
| Get Permission Matrix | O(1) | O(1) | Constant data structure |

### 9.7 Overall System Performance

**Expected Load:**
- 50 concurrent admin users
- 10,000 admin actions/day
- 100 audit queries/day

**Performance Targets:**
- Authentication: <200ms (including 2FA verification)
- Session validation: <10ms
- Permission check: <5ms
- Rate limit check: <2ms (Redis)
- Audit log write: <50ms (async)
- Audit log query: <500ms (recent data)

**Scalability:**
- Handles up to 500 concurrent admins
- 1M audit logs/month (~32 MB)
- 10K IP whitelist entries (edge case)
- Sub-second response for all admin operations

---

## 10. Security Considerations

### 10.1 Cryptographic Standards

```
SECURITY STANDARDS:

TOTP:
    - Algorithm: HMAC-SHA1 (RFC 6238)
    - Secret length: 256 bits (32 bytes)
    - Time step: 30 seconds
    - Window: ±1 step (90 seconds total)
    - Token length: 6 digits

Password Hashing:
    - Algorithm: bcrypt
    - Cost factor: 10 (can be increased over time)
    - Salt: Generated per password (included in hash)

Session Tokens:
    - Length: 256 bits (32 bytes)
    - Encoding: Hexadecimal (64 characters)
    - Storage: SHA-256 hash
    - Transmission: HTTPS only, HttpOnly cookie

Encryption at Rest:
    - Algorithm: AES-256-GCM
    - Key management: External KMS or encrypted master key
    - What to encrypt: TOTP secrets, backup codes

Secure Comparison:
    - Use constant-time comparison for tokens, passwords, codes
    - Prevents timing attacks that leak information
```

### 10.2 Threat Mitigation

| Threat | Mitigation | Implementation |
|--------|------------|----------------|
| Brute force login | Rate limiting + account lockout | Redis counters, exponential backoff |
| Session hijacking | IP + User-Agent binding | Session validation algorithm |
| TOTP bypass | Rate limit 2FA attempts | 3 attempts per 5 minutes |
| Privilege escalation | Role hierarchy + resource checks | Permission enforcement algorithms |
| Insider threat | Audit logging + critical action alerts | Comprehensive audit log system |
| Account compromise | 2FA mandatory | TOTP setup flow |
| IP spoofing | Cloudflare proxy, trust CF headers | IP extraction logic |
| SQL injection | Parameterized queries | All database operations |
| XSS | Output encoding, CSP headers | Frontend security |
| CSRF | SameSite cookies, CSRF tokens | Session cookies |

### 10.3 Compliance

**GDPR:**
- Audit logs include data access tracking
- Data export endpoint for subject access requests
- Audit log retention policy (2 years online, 5 years archived)

**SOC 2:**
- Comprehensive audit trail
- Access control enforcement
- Security incident detection and alerting

**NIST Cybersecurity Framework:**
- Identify: Risk-based access control
- Protect: 2FA, IP whitelisting, encryption
- Detect: Audit logging, suspicious pattern detection
- Respond: Automated alerts, session termination
- Recover: Backup codes, 2FA reset procedures

---

**Document Status**: PSEUDOCODE COMPLETE
**Created By**: SPARC Pseudocode Agent
**Date**: 2025-12-16
**Next Phase**: M8 Architecture Design (SPARC Phase 3)

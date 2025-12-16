# M1 Authentication System - Pseudocode Specification

**Version:** 1.0.0
**Phase:** SPARC Phase 2 (Pseudocode)
**Module:** Authentication & Security
**Last Updated:** 2025-12-16
**Status:** ✅ PSEUDOCODE COMPLETE

---

## Table of Contents

1. [Data Structures](#data-structures)
2. [User Registration](#user-registration)
3. [User Login](#user-login)
4. [Token Management](#token-management)
5. [Password Reset Flow](#password-reset-flow)
6. [Rate Limiting](#rate-limiting)
7. [Account Lockout](#account-lockout)
8. [Email Verification](#email-verification)

---

## Data Structures

### User Model
```
STRUCTURE: User
    id: INTEGER (primary key, auto-increment)
    email: STRING (unique, indexed)
    passwordHash: STRING (bcrypt, cost factor 12)
    emailVerified: BOOLEAN (default: false)
    emailVerificationToken: STRING (nullable, indexed)
    emailVerificationExpiry: TIMESTAMP (nullable)
    passwordResetToken: STRING (nullable, indexed)
    passwordResetExpiry: TIMESTAMP (nullable)
    accountLocked: BOOLEAN (default: false)
    lockoutExpiry: TIMESTAMP (nullable)
    failedLoginAttempts: INTEGER (default: 0)
    lastFailedLogin: TIMESTAMP (nullable)
    createdAt: TIMESTAMP
    updatedAt: TIMESTAMP
END STRUCTURE

INDEXES:
    - PRIMARY: id
    - UNIQUE: email
    - INDEX: emailVerificationToken (for fast lookup)
    - INDEX: passwordResetToken (for fast lookup)
    - INDEX: emailVerified (for analytics)
```

### JWT Token Model
```
STRUCTURE: RefreshToken
    id: INTEGER (primary key, auto-increment)
    userId: INTEGER (foreign key -> User.id)
    tokenHash: STRING (SHA-256 hash of token)
    expiresAt: TIMESTAMP
    isRevoked: BOOLEAN (default: false)
    createdAt: TIMESTAMP
    lastUsedAt: TIMESTAMP
    ipAddress: STRING
    userAgent: STRING
END STRUCTURE

INDEXES:
    - PRIMARY: id
    - INDEX: (userId, isRevoked) (for active token lookup)
    - INDEX: tokenHash (for validation)
    - INDEX: expiresAt (for cleanup job)
```

### Rate Limit Counter (Redis)
```
DATA STRUCTURE: RateLimitCounter
    Type: Redis String (counter)
    Key Pattern: "ratelimit:{type}:{identifier}:{endpoint}:{window_timestamp}"
    Value: INTEGER (request count)
    TTL: 2 × window_size (seconds)

    Example Keys:
        - "ratelimit:ip:192.168.1.1:auth/login:1702742400"
        - "ratelimit:account:user_123:auth/login:1702742400"
        - "ratelimit:global:auth/register:1702742400"
END STRUCTURE

DATA STRUCTURE: AccountLockout
    Type: Redis String (lockout status)
    Key Pattern: "lockout:account:{user_id}"
    Value: JSON { lockedUntil: TIMESTAMP, reason: STRING, attemptCount: INTEGER }
    TTL: lockout_duration (seconds)
END STRUCTURE
```

---

## User Registration

### ALGORITHM: RegisterUser

```
ALGORITHM: RegisterUser
INPUT:
    email (STRING)
    password (STRING)
    ipAddress (STRING)
    userAgent (STRING)
OUTPUT:
    SUCCESS: { user: User, message: STRING }
    ERROR: { error: STRING, code: STRING }

PRECONDITIONS:
    - Email is valid format
    - Password meets security requirements (min 8 chars, complexity)
    - Rate limits not exceeded

POSTCONDITIONS:
    - User record created in database
    - Email verification sent
    - Registration counted in rate limiter

STEPS:
1. Rate Limit Check
    1.1. CHECK RateLimit("ip", ipAddress, "auth/register", limit=5, window=3600)
    1.2. IF rate limit exceeded THEN
        RETURN ERROR("Rate limit exceeded. Try again later.", "RATE_LIMIT_EXCEEDED")
    END IF

    1.3. CHECK RateLimit("global", "all", "auth/register", limit=100, window=3600)
    1.4. IF global limit exceeded THEN
        RETURN ERROR("Service temporarily unavailable.", "GLOBAL_LIMIT_EXCEEDED")
    END IF

2. Input Validation
    2.1. email ← Trim(Lowercase(email))
    2.2. IF NOT IsValidEmail(email) THEN
        RETURN ERROR("Invalid email format.", "INVALID_EMAIL")
    END IF

    2.3. IF Length(password) < 8 THEN
        RETURN ERROR("Password must be at least 8 characters.", "PASSWORD_TOO_SHORT")
    END IF

    2.4. IF NOT HasPasswordComplexity(password) THEN
        RETURN ERROR("Password must contain uppercase, lowercase, number, and special char.", "PASSWORD_WEAK")
    END IF

3. Duplicate Check
    3.1. existingUser ← Database.FindUserByEmail(email)
    3.2. IF existingUser EXISTS THEN
        IF existingUser.emailVerified = false THEN
            // Allow re-sending verification email
            GOTO Step 5 (Generate Verification Token)
        ELSE
            RETURN ERROR("Email already registered.", "EMAIL_EXISTS")
        END IF
    END IF

4. Password Hashing
    4.1. salt ← GenerateRandomSalt(rounds=12)
    4.2. passwordHash ← Bcrypt.Hash(password, salt)

    COMPLEXITY: O(2^12) bcrypt rounds for security
    TIME: ~300ms (intentionally slow to prevent brute force)

5. Generate Verification Token
    5.1. verificationToken ← GenerateSecureRandomToken(32 bytes)
    5.2. tokenExpiry ← CurrentTimestamp() + 24 hours

6. Create User Record
    6.1. BEGIN TRANSACTION

    6.2. user ← Database.CreateUser({
        email: email,
        passwordHash: passwordHash,
        emailVerified: false,
        emailVerificationToken: SHA256(verificationToken),
        emailVerificationExpiry: tokenExpiry,
        accountLocked: false,
        failedLoginAttempts: 0,
        createdAt: CurrentTimestamp(),
        updatedAt: CurrentTimestamp()
    })

    6.3. IF user creation fails THEN
        ROLLBACK TRANSACTION
        RETURN ERROR("Registration failed. Please try again.", "DATABASE_ERROR")
    END IF

    6.4. COMMIT TRANSACTION

7. Send Verification Email
    7.1. verificationLink ← BuildURL("https://app.example.com/verify-email", {
        token: verificationToken
    })

    7.2. ASYNC SendEmail({
        to: email,
        subject: "Verify your email address",
        template: "email-verification",
        data: { verificationLink: verificationLink, expiryHours: 24 }
    })

    NOTE: Use async queue (e.g., Bull, RabbitMQ) for email sending
          Do not block registration on email delivery

8. Log Security Event
    8.1. SecurityLog.Create({
        event: "USER_REGISTERED",
        userId: user.id,
        ipAddress: ipAddress,
        userAgent: userAgent,
        timestamp: CurrentTimestamp()
    })

9. Return Success
    RETURN SUCCESS({
        user: {
            id: user.id,
            email: user.email,
            emailVerified: false
        },
        message: "Registration successful. Please check your email to verify your account."
    })

COMPLEXITY ANALYSIS:
    Time: O(1) database operations + O(2^12) bcrypt hashing
    Space: O(1) - constant user record size

ERROR HANDLING:
    - Database errors: Rollback transaction, return generic error
    - Email service errors: Log error, continue (user can resend)
    - Redis errors: Fail open (allow registration if rate limiter down)
```

### SUBROUTINE: HasPasswordComplexity

```
SUBROUTINE: HasPasswordComplexity
INPUT: password (STRING)
OUTPUT: isValid (BOOLEAN)

STEPS:
1. hasUppercase ← password MATCHES /[A-Z]/
2. hasLowercase ← password MATCHES /[a-z]/
3. hasNumber ← password MATCHES /[0-9]/
4. hasSpecial ← password MATCHES /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/

5. RETURN hasUppercase AND hasLowercase AND hasNumber AND hasSpecial

COMPLEXITY: O(n) where n = password length
```

### SUBROUTINE: GenerateSecureRandomToken

```
SUBROUTINE: GenerateSecureRandomToken
INPUT: byteLength (INTEGER)
OUTPUT: token (STRING, hex-encoded)

STEPS:
1. randomBytes ← CryptoSecureRandom(byteLength)
2. token ← HexEncode(randomBytes)
3. RETURN token

COMPLEXITY: O(n) where n = byteLength
SECURITY: Uses crypto.randomBytes() or equivalent
```

---

## User Login

### ALGORITHM: LoginUser

```
ALGORITHM: LoginUser
INPUT:
    email (STRING)
    password (STRING)
    ipAddress (STRING)
    userAgent (STRING)
OUTPUT:
    SUCCESS: { accessToken: STRING, refreshToken: STRING, user: User }
    ERROR: { error: STRING, code: STRING }

PRECONDITIONS:
    - Email format is valid
    - Password is not empty
    - Account is not locked

POSTCONDITIONS:
    - Access token (JWT) generated with 15-minute expiry
    - Refresh token stored in database with 7-day expiry
    - Failed login counter reset on success
    - Login event logged

STEPS:
1. Rate Limit Check (Multi-Tier)
    1.1. CHECK RateLimit("ip", ipAddress, "auth/login", limit=5, window=900)
    1.2. IF rate limit exceeded THEN
        lockoutDuration ← CalculateProgressiveLockout(ipAddress)
        RETURN ERROR("Too many login attempts. Try again in " + lockoutDuration + " minutes.", "RATE_LIMIT_EXCEEDED")
    END IF

2. Input Sanitization
    2.1. email ← Trim(Lowercase(email))
    2.2. IF NOT IsValidEmail(email) THEN
        RETURN ERROR("Invalid credentials.", "INVALID_CREDENTIALS")
        NOTE: Generic error to prevent email enumeration
    END IF

3. User Lookup
    3.1. user ← Database.FindUserByEmail(email)
    3.2. IF user NOT EXISTS THEN
        // Perform fake hash to prevent timing attacks
        Bcrypt.Hash("dummy_password", 12)
        RETURN ERROR("Invalid credentials.", "INVALID_CREDENTIALS")
    END IF

4. Account Status Check
    4.1. IF user.accountLocked = true THEN
        IF user.lockoutExpiry > CurrentTimestamp() THEN
            remainingTime ← user.lockoutExpiry - CurrentTimestamp()
            RETURN ERROR("Account locked. Try again in " + FormatDuration(remainingTime), "ACCOUNT_LOCKED")
        ELSE
            // Auto-unlock expired lockout
            Database.UpdateUser(user.id, {
                accountLocked: false,
                lockoutExpiry: null,
                failedLoginAttempts: 0
            })
        END IF
    END IF

    4.2. IF user.emailVerified = false THEN
        RETURN ERROR("Please verify your email before logging in.", "EMAIL_NOT_VERIFIED")
    END IF

5. Password Verification
    5.1. isPasswordValid ← Bcrypt.Compare(password, user.passwordHash)

    COMPLEXITY: O(2^12) bcrypt comparison (intentionally slow)
    TIME: ~300ms

    5.2. IF NOT isPasswordValid THEN
        GOTO Step 6 (Handle Failed Login)
    END IF

6. Handle Failed Login (if password incorrect)
    6.1. failedAttempts ← user.failedLoginAttempts + 1

    6.2. Database.UpdateUser(user.id, {
        failedLoginAttempts: failedAttempts,
        lastFailedLogin: CurrentTimestamp()
    })

    6.3. SecurityLog.Create({
        event: "LOGIN_FAILED",
        userId: user.id,
        ipAddress: ipAddress,
        reason: "Invalid password",
        timestamp: CurrentTimestamp()
    })

    6.4. // Account lockout policy (see Account Lockout section)
    IF failedAttempts >= 10 THEN
        lockoutDuration ← 24 hours
        Database.UpdateUser(user.id, {
            accountLocked: true,
            lockoutExpiry: CurrentTimestamp() + lockoutDuration
        })

        SendEmail({
            to: user.email,
            subject: "Account locked due to suspicious activity",
            template: "account-locked"
        })

        RETURN ERROR("Account locked due to too many failed login attempts.", "ACCOUNT_LOCKED")
    END IF

    6.5. RETURN ERROR("Invalid credentials.", "INVALID_CREDENTIALS")

7. Generate Access Token (JWT)
    7.1. accessTokenPayload ← {
        userId: user.id,
        email: user.email,
        iat: CurrentTimestamp(),
        exp: CurrentTimestamp() + 15 minutes (900 seconds)
    }

    7.2. accessToken ← JWT.Sign(accessTokenPayload, SECRET_KEY, algorithm="HS256")

    COMPLEXITY: O(1)
    SIZE: ~200-300 bytes

8. Generate Refresh Token
    8.1. refreshTokenValue ← GenerateSecureRandomToken(32 bytes)
    8.2. refreshTokenHash ← SHA256(refreshTokenValue)

    8.3. BEGIN TRANSACTION

    8.4. refreshTokenRecord ← Database.CreateRefreshToken({
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: CurrentTimestamp() + 7 days,
        isRevoked: false,
        ipAddress: ipAddress,
        userAgent: userAgent,
        createdAt: CurrentTimestamp(),
        lastUsedAt: CurrentTimestamp()
    })

    8.5. COMMIT TRANSACTION

9. Reset Failed Login Counter
    9.1. Database.UpdateUser(user.id, {
        failedLoginAttempts: 0,
        lastFailedLogin: null
    })

10. Log Successful Login
    10.1. SecurityLog.Create({
        event: "LOGIN_SUCCESS",
        userId: user.id,
        ipAddress: ipAddress,
        userAgent: userAgent,
        timestamp: CurrentTimestamp()
    })

11. Return Success
    RETURN SUCCESS({
        accessToken: accessToken,
        refreshToken: refreshTokenValue,
        user: {
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified
        }
    })

COMPLEXITY ANALYSIS:
    Time: O(1) database lookups + O(2^12) bcrypt comparison
    Space: O(1) - constant token size

ERROR HANDLING:
    - Timing attack prevention: Always perform bcrypt operation
    - Generic error messages: Prevent email enumeration
    - Database failures: Rollback transaction, return error
    - Rate limiter failures: Fail open (allow login if Redis down)

SECURITY NOTES:
    - Access token: 15-minute expiry (short-lived, in-memory)
    - Refresh token: 7-day expiry (long-lived, database-backed)
    - All errors return "Invalid credentials" to prevent enumeration
    - Bcrypt timing is consistent whether password correct or not
```

---

## Token Management

### ALGORITHM: RefreshAccessToken

```
ALGORITHM: RefreshAccessToken
INPUT:
    refreshToken (STRING)
    ipAddress (STRING)
    userAgent (STRING)
OUTPUT:
    SUCCESS: { accessToken: STRING, refreshToken: STRING }
    ERROR: { error: STRING, code: STRING }

PRECONDITIONS:
    - Refresh token is not empty
    - Rate limit for token refresh not exceeded

POSTCONDITIONS:
    - New access token generated
    - Optional: New refresh token issued (token rotation)
    - Old refresh token revoked (if rotation enabled)

STEPS:
1. Rate Limit Check
    1.1. CHECK RateLimit("ip", ipAddress, "auth/refresh", limit=10, window=60)
    1.2. IF rate limit exceeded THEN
        RETURN ERROR("Too many refresh attempts.", "RATE_LIMIT_EXCEEDED")
    END IF

2. Token Validation
    2.1. refreshTokenHash ← SHA256(refreshToken)
    2.2. tokenRecord ← Database.FindRefreshToken(refreshTokenHash)

    2.3. IF tokenRecord NOT EXISTS THEN
        SecurityLog.Create({
            event: "INVALID_REFRESH_TOKEN",
            ipAddress: ipAddress,
            timestamp: CurrentTimestamp()
        })
        RETURN ERROR("Invalid refresh token.", "INVALID_TOKEN")
    END IF

3. Token Status Check
    3.1. IF tokenRecord.isRevoked = true THEN
        // Possible token reuse attack - revoke all user tokens
        Database.RevokeAllUserTokens(tokenRecord.userId)

        SecurityLog.Create({
            event: "TOKEN_REUSE_DETECTED",
            userId: tokenRecord.userId,
            ipAddress: ipAddress,
            severity: "HIGH"
        })

        RETURN ERROR("Token has been revoked.", "TOKEN_REVOKED")
    END IF

    3.2. IF tokenRecord.expiresAt < CurrentTimestamp() THEN
        RETURN ERROR("Refresh token expired.", "TOKEN_EXPIRED")
    END IF

4. User Lookup
    4.1. user ← Database.FindUserById(tokenRecord.userId)
    4.2. IF user NOT EXISTS OR user.accountLocked = true THEN
        RETURN ERROR("User account not available.", "ACCOUNT_UNAVAILABLE")
    END IF

5. Generate New Access Token
    5.1. accessTokenPayload ← {
        userId: user.id,
        email: user.email,
        iat: CurrentTimestamp(),
        exp: CurrentTimestamp() + 15 minutes
    }

    5.2. accessToken ← JWT.Sign(accessTokenPayload, SECRET_KEY, algorithm="HS256")

6. Token Rotation (Optional, Recommended)
    6.1. IF TOKEN_ROTATION_ENABLED = true THEN
        6.2. newRefreshTokenValue ← GenerateSecureRandomToken(32 bytes)
        6.3. newRefreshTokenHash ← SHA256(newRefreshTokenValue)

        6.4. BEGIN TRANSACTION

        6.5. // Revoke old token
        Database.UpdateRefreshToken(tokenRecord.id, {
            isRevoked: true
        })

        6.6. // Create new token
        newTokenRecord ← Database.CreateRefreshToken({
            userId: user.id,
            tokenHash: newRefreshTokenHash,
            expiresAt: CurrentTimestamp() + 7 days,
            isRevoked: false,
            ipAddress: ipAddress,
            userAgent: userAgent,
            createdAt: CurrentTimestamp(),
            lastUsedAt: CurrentTimestamp()
        })

        6.7. COMMIT TRANSACTION

        6.8. responseRefreshToken ← newRefreshTokenValue
    ELSE
        6.9. // Update last used timestamp
        Database.UpdateRefreshToken(tokenRecord.id, {
            lastUsedAt: CurrentTimestamp()
        })

        6.10. responseRefreshToken ← refreshToken
    END IF

7. Return Success
    RETURN SUCCESS({
        accessToken: accessToken,
        refreshToken: responseRefreshToken
    })

COMPLEXITY ANALYSIS:
    Time: O(1) database operations
    Space: O(1)

ERROR HANDLING:
    - Token reuse detection triggers full account token revocation
    - Invalid tokens logged for security monitoring
    - Database errors rollback transaction

SECURITY NOTES:
    - Token rotation prevents token replay attacks
    - Token reuse detection indicates possible token theft
    - Short access token lifetime limits damage from token theft
```

### ALGORITHM: RevokeRefreshToken (Logout)

```
ALGORITHM: RevokeRefreshToken
INPUT:
    refreshToken (STRING)
    userId (INTEGER)
OUTPUT:
    SUCCESS: { message: STRING }
    ERROR: { error: STRING }

STEPS:
1. Rate Limit Check
    1.1. CHECK RateLimit("user", userId, "auth/logout", limit=20, window=60)
    1.2. IF rate limit exceeded THEN
        RETURN ERROR("Too many logout requests.", "RATE_LIMIT_EXCEEDED")
    END IF

2. Revoke Token
    2.1. IF refreshToken PROVIDED THEN
        refreshTokenHash ← SHA256(refreshToken)
        Database.UpdateRefreshToken(refreshTokenHash, { isRevoked: true })
    ELSE
        // Logout all sessions
        Database.RevokeAllUserTokens(userId)
    END IF

3. Log Logout Event
    3.1. SecurityLog.Create({
        event: "USER_LOGGED_OUT",
        userId: userId,
        timestamp: CurrentTimestamp()
    })

4. RETURN SUCCESS({ message: "Logged out successfully" })

COMPLEXITY: O(1) for single token, O(n) for all user tokens
```

---

## Password Reset Flow

### ALGORITHM: RequestPasswordReset

```
ALGORITHM: RequestPasswordReset
INPUT:
    email (STRING)
    ipAddress (STRING)
OUTPUT:
    SUCCESS: { message: STRING }
    ERROR: { error: STRING }

PRECONDITIONS:
    - Email format is valid
    - Rate limit not exceeded

POSTCONDITIONS:
    - Password reset email sent (if user exists)
    - Reset token stored with expiry
    - Generic success message returned (prevent enumeration)

STEPS:
1. Rate Limit Check
    1.1. CHECK RateLimit("ip", ipAddress, "auth/forgot-password", limit=3, window=3600)
    1.2. IF rate limit exceeded THEN
        RETURN ERROR("Too many password reset requests. Try again in 1 hour.", "RATE_LIMIT_EXCEEDED")
    END IF

2. Input Sanitization
    2.1. email ← Trim(Lowercase(email))

3. User Lookup
    3.1. user ← Database.FindUserByEmail(email)
    3.2. IF user NOT EXISTS THEN
        // Return success anyway to prevent email enumeration
        GOTO Step 7 (Return Generic Success)
    END IF

4. Generate Reset Token
    4.1. resetToken ← GenerateSecureRandomToken(32 bytes)
    4.2. resetTokenHash ← SHA256(resetToken)
    4.3. tokenExpiry ← CurrentTimestamp() + 1 hour

5. Store Reset Token
    5.1. Database.UpdateUser(user.id, {
        passwordResetToken: resetTokenHash,
        passwordResetExpiry: tokenExpiry
    })

6. Send Reset Email
    6.1. resetLink ← BuildURL("https://app.example.com/reset-password", {
        token: resetToken
    })

    6.2. ASYNC SendEmail({
        to: email,
        subject: "Password reset request",
        template: "password-reset",
        data: {
            resetLink: resetLink,
            expiryMinutes: 60
        }
    })

7. Return Generic Success
    RETURN SUCCESS({
        message: "If an account with that email exists, a password reset link has been sent."
    })

    NOTE: Always return success, even if user doesn't exist
          This prevents email enumeration attacks

COMPLEXITY: O(1)
ERROR HANDLING: Always return generic success message
SECURITY: Email enumeration prevention is critical
```

### ALGORITHM: ResetPassword

```
ALGORITHM: ResetPassword
INPUT:
    resetToken (STRING)
    newPassword (STRING)
    ipAddress (STRING)
OUTPUT:
    SUCCESS: { message: STRING }
    ERROR: { error: STRING, code: STRING }

PRECONDITIONS:
    - Reset token is valid and not expired
    - New password meets complexity requirements

POSTCONDITIONS:
    - Password hash updated in database
    - Reset token invalidated
    - All refresh tokens revoked (security measure)
    - User notified of password change

STEPS:
1. Rate Limit Check
    1.1. CHECK RateLimit("token", SHA256(resetToken), "auth/reset-password", limit=3, window=900)
    1.2. IF rate limit exceeded THEN
        RETURN ERROR("Too many reset attempts.", "RATE_LIMIT_EXCEEDED")
    END IF

2. Input Validation
    2.1. IF Length(newPassword) < 8 THEN
        RETURN ERROR("Password must be at least 8 characters.", "PASSWORD_TOO_SHORT")
    END IF

    2.2. IF NOT HasPasswordComplexity(newPassword) THEN
        RETURN ERROR("Password must meet complexity requirements.", "PASSWORD_WEAK")
    END IF

3. Token Validation
    3.1. resetTokenHash ← SHA256(resetToken)
    3.2. user ← Database.FindUserByResetToken(resetTokenHash)

    3.3. IF user NOT EXISTS THEN
        RETURN ERROR("Invalid or expired reset token.", "INVALID_TOKEN")
    END IF

    3.4. IF user.passwordResetExpiry < CurrentTimestamp() THEN
        RETURN ERROR("Reset token has expired.", "TOKEN_EXPIRED")
    END IF

4. Hash New Password
    4.1. salt ← GenerateRandomSalt(rounds=12)
    4.2. newPasswordHash ← Bcrypt.Hash(newPassword, salt)

5. Update User Record
    5.1. BEGIN TRANSACTION

    5.2. Database.UpdateUser(user.id, {
        passwordHash: newPasswordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
        accountLocked: false,
        failedLoginAttempts: 0,
        updatedAt: CurrentTimestamp()
    })

    5.3. // Revoke all refresh tokens (force re-login)
    Database.RevokeAllUserTokens(user.id)

    5.4. COMMIT TRANSACTION

6. Send Confirmation Email
    6.1. ASYNC SendEmail({
        to: user.email,
        subject: "Password changed successfully",
        template: "password-changed",
        data: {
            timestamp: CurrentTimestamp(),
            ipAddress: ipAddress
        }
    })

7. Log Security Event
    7.1. SecurityLog.Create({
        event: "PASSWORD_RESET",
        userId: user.id,
        ipAddress: ipAddress,
        timestamp: CurrentTimestamp()
    })

8. RETURN SUCCESS({ message: "Password reset successful. Please log in with your new password." })

COMPLEXITY: O(1) + O(2^12) for bcrypt
ERROR HANDLING: Transaction rollback on database errors
SECURITY: All sessions terminated after password reset
```

---

## Rate Limiting

### ALGORITHM: CheckRateLimit (Sliding Window Counter)

```
ALGORITHM: CheckRateLimit
INPUT:
    keyType (STRING)        // "ip", "account", "token", "global"
    identifier (STRING)     // IP address, user ID, etc.
    endpoint (STRING)       // "auth/login", "auth/register", etc.
    limit (INTEGER)         // Max requests allowed
    windowSize (INTEGER)    // Window size in seconds (e.g., 900 for 15 min)
OUTPUT:
    allowed (BOOLEAN)
    remaining (INTEGER)
    resetTime (TIMESTAMP)

PRECONDITIONS:
    - Redis connection is available (or fallback to in-memory)
    - Window size > 0
    - Limit > 0

POSTCONDITIONS:
    - Counter incremented if request allowed
    - Rate limit state updated in Redis
    - Metrics logged for monitoring

STEPS:
1. Calculate Window Timestamps
    1.1. currentTime ← CurrentUnixTimestamp()
    1.2. currentWindow ← Floor(currentTime / windowSize) × windowSize
    1.3. previousWindow ← currentWindow - windowSize

2. Build Redis Keys
    2.1. keyPrefix ← "ratelimit:" + keyType + ":" + identifier + ":" + endpoint
    2.2. currentKey ← keyPrefix + ":" + currentWindow
    2.3. previousKey ← keyPrefix + ":" + previousWindow

3. Execute Lua Script (Atomic Operation)
    3.1. luaScript ← "
        local currentKey = KEYS[1]
        local previousKey = KEYS[2]
        local windowSize = tonumber(ARGV[1])
        local limit = tonumber(ARGV[2])
        local currentTime = tonumber(ARGV[3])
        local currentWindow = tonumber(ARGV[4])

        -- Get current and previous window counts
        local currentCount = tonumber(redis.call('GET', currentKey) or '0')
        local previousCount = tonumber(redis.call('GET', previousKey) or '0')

        -- Calculate progress through current window (0.0 to 1.0)
        local progress = (currentTime - currentWindow) / windowSize

        -- Weighted count using sliding window algorithm
        local weightedCount = math.floor((previousCount * (1 - progress)) + currentCount)

        -- Check if request allowed
        if weightedCount < limit then
            -- Increment counter
            redis.call('INCR', currentKey)
            redis.call('EXPIRE', currentKey, windowSize * 2)

            return {
                1,                              -- allowed (true)
                limit,                          -- total limit
                limit - weightedCount - 1,      -- remaining
                currentWindow + windowSize      -- reset time
            }
        else
            return {
                0,                              -- allowed (false)
                limit,
                0,                              -- no remaining
                currentWindow + windowSize      -- reset time
            }
        end
    "

    3.2. result ← Redis.EVAL(luaScript,
        KEYS=[currentKey, previousKey],
        ARGV=[windowSize, limit, currentTime, currentWindow]
    )

    3.3. allowed ← result[1] = 1
    3.4. totalLimit ← result[2]
    3.5. remaining ← result[3]
    3.6. resetTime ← result[4]

4. Handle Redis Failure (Fallback)
    4.1. IF Redis.IsConnected() = false THEN
        // Fail open: Allow request but log error
        MonitoringLog.Error("Rate limiter Redis unavailable - failing open")
        RETURN { allowed: true, remaining: limit, resetTime: currentTime + windowSize }
    END IF

5. Log Rate Limit Event (if denied)
    5.1. IF NOT allowed THEN
        MetricsCollector.Increment("rate_limit_exceeded", {
            keyType: keyType,
            endpoint: endpoint
        })

        SecurityLog.Create({
            event: "RATE_LIMIT_EXCEEDED",
            keyType: keyType,
            identifier: identifier,
            endpoint: endpoint,
            timestamp: currentTime
        })
    END IF

6. Return Result
    RETURN {
        allowed: allowed,
        remaining: remaining,
        resetTime: resetTime
    }

COMPLEXITY ANALYSIS:
    Time: O(1) - Redis operations are atomic and constant time
    Space: O(1) - Two counter keys per window
    Memory: ~100 bytes per active window

ACCURACY:
    - Sliding window provides ~99% accuracy
    - Max 1% error at window boundaries
    - Better than fixed window (prevents burst attacks)

ERROR HANDLING:
    - Redis connection failure: Fail open (allow request)
    - Lua script error: Fail open and alert
    - Always log errors for investigation

MONITORING:
    - Track rate limit denials per endpoint
    - Alert on unusual patterns (DDoS detection)
    - Monitor Redis latency and availability
```

---

## Account Lockout

### ALGORITHM: CheckAccountLockout

```
ALGORITHM: CheckAccountLockout
INPUT:
    userId (INTEGER)
OUTPUT:
    isLocked (BOOLEAN)
    lockoutExpiry (TIMESTAMP or null)
    reason (STRING or null)

STEPS:
1. Check Database Lockout Status
    1.1. user ← Database.FindUserById(userId)
    1.2. IF user.accountLocked = true THEN
        IF user.lockoutExpiry > CurrentTimestamp() THEN
            RETURN {
                isLocked: true,
                lockoutExpiry: user.lockoutExpiry,
                reason: "Too many failed login attempts"
            }
        ELSE
            // Auto-unlock expired lockout
            Database.UpdateUser(userId, {
                accountLocked: false,
                lockoutExpiry: null,
                failedLoginAttempts: 0
            })
            RETURN { isLocked: false }
        END IF
    END IF

2. Check Redis Temporary Lockout
    2.1. redisKey ← "lockout:account:" + userId
    2.2. lockoutData ← Redis.GET(redisKey)
    2.3. IF lockoutData EXISTS THEN
        RETURN {
            isLocked: true,
            lockoutExpiry: lockoutData.lockedUntil,
            reason: lockoutData.reason
        }
    END IF

3. RETURN { isLocked: false }

COMPLEXITY: O(1)
```

### ALGORITHM: EnforceAccountLockout

```
ALGORITHM: EnforceAccountLockout
INPUT:
    userId (INTEGER)
    failedAttempts (INTEGER)
    ipAddress (STRING)
OUTPUT:
    lockoutDuration (INTEGER in seconds)
    lockoutType (STRING)    // "temporary" or "permanent"

PRECONDITIONS:
    - User exists in database
    - Failed attempt count is accurate

POSTCONDITIONS:
    - Account locked in database or Redis
    - User notified via email
    - Security team alerted if suspicious

STEPS:
1. Determine Lockout Policy
    1.1. IF failedAttempts = 5 THEN
        lockoutDuration ← 5 minutes (300 seconds)
        lockoutType ← "temporary"

    1.2. ELSE IF failedAttempts = 7 THEN
        lockoutDuration ← 15 minutes (900 seconds)
        lockoutType ← "temporary"

    1.3. ELSE IF failedAttempts >= 10 THEN
        lockoutDuration ← 24 hours (86400 seconds)
        lockoutType ← "permanent"  // Requires manual unlock or email verification

    ELSE
        RETURN { lockoutDuration: 0, lockoutType: "none" }
    END IF

2. Apply Lockout
    2.1. IF lockoutType = "temporary" THEN
        // Store in Redis (auto-expires)
        redisKey ← "lockout:account:" + userId
        Redis.SETEX(redisKey, lockoutDuration, JSON({
            lockedUntil: CurrentTimestamp() + lockoutDuration,
            reason: "Too many failed login attempts",
            attemptCount: failedAttempts
        }))

    2.2. ELSE IF lockoutType = "permanent" THEN
        // Store in database (requires manual intervention)
        Database.UpdateUser(userId, {
            accountLocked: true,
            lockoutExpiry: CurrentTimestamp() + lockoutDuration,
            failedLoginAttempts: failedAttempts
        })
    END IF

3. Send Notification Email
    3.1. user ← Database.FindUserById(userId)
    3.2. ASYNC SendEmail({
        to: user.email,
        subject: "Account security alert",
        template: "account-locked",
        data: {
            lockoutDuration: FormatDuration(lockoutDuration),
            failedAttempts: failedAttempts,
            unlockTime: CurrentTimestamp() + lockoutDuration,
            supportLink: "https://support.example.com/account-locked"
        }
    })

4. Alert Security Team (if >= 10 attempts)
    4.1. IF failedAttempts >= 10 THEN
        SecurityAlert.Send({
            severity: "HIGH",
            event: "ACCOUNT_LOCKOUT",
            userId: userId,
            email: user.email,
            ipAddress: ipAddress,
            failedAttempts: failedAttempts
        })
    END IF

5. Log Lockout Event
    5.1. SecurityLog.Create({
        event: "ACCOUNT_LOCKED",
        userId: userId,
        lockoutType: lockoutType,
        lockoutDuration: lockoutDuration,
        failedAttempts: failedAttempts,
        ipAddress: ipAddress,
        timestamp: CurrentTimestamp()
    })

6. RETURN { lockoutDuration: lockoutDuration, lockoutType: lockoutType }

COMPLEXITY: O(1)
ERROR HANDLING: Email/alert failures logged but don't block lockout
```

---

## Email Verification

### ALGORITHM: VerifyEmail

```
ALGORITHM: VerifyEmail
INPUT:
    verificationToken (STRING)
    ipAddress (STRING)
OUTPUT:
    SUCCESS: { message: STRING, user: User }
    ERROR: { error: STRING, code: STRING }

PRECONDITIONS:
    - Verification token is not empty
    - Rate limit not exceeded

POSTCONDITIONS:
    - User email marked as verified
    - Verification token invalidated
    - Welcome email sent

STEPS:
1. Rate Limit Check
    1.1. CHECK RateLimit("ip", ipAddress, "auth/verify-email", limit=5, window=3600)
    1.2. IF rate limit exceeded THEN
        RETURN ERROR("Too many verification attempts.", "RATE_LIMIT_EXCEEDED")
    END IF

2. Token Validation
    2.1. tokenHash ← SHA256(verificationToken)
    2.2. user ← Database.FindUserByVerificationToken(tokenHash)

    2.3. IF user NOT EXISTS THEN
        RETURN ERROR("Invalid verification token.", "INVALID_TOKEN")
    END IF

    2.4. IF user.emailVerificationExpiry < CurrentTimestamp() THEN
        RETURN ERROR("Verification token has expired. Please request a new one.", "TOKEN_EXPIRED")
    END IF

    2.5. IF user.emailVerified = true THEN
        RETURN SUCCESS({ message: "Email already verified.", user: user })
    END IF

3. Mark Email as Verified
    3.1. Database.UpdateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
        updatedAt: CurrentTimestamp()
    })

4. Send Welcome Email
    4.1. ASYNC SendEmail({
        to: user.email,
        subject: "Welcome to Community Social Network!",
        template: "welcome",
        data: {
            userName: user.email,
            loginLink: "https://app.example.com/login"
        }
    })

5. Log Verification Event
    5.1. SecurityLog.Create({
        event: "EMAIL_VERIFIED",
        userId: user.id,
        ipAddress: ipAddress,
        timestamp: CurrentTimestamp()
    })

6. RETURN SUCCESS({
    message: "Email verified successfully! You can now log in.",
    user: { id: user.id, email: user.email, emailVerified: true }
})

COMPLEXITY: O(1)
ERROR HANDLING: Email failure logged but doesn't block verification
```

### ALGORITHM: ResendVerificationEmail

```
ALGORITHM: ResendVerificationEmail
INPUT:
    email (STRING)
    ipAddress (STRING)
OUTPUT:
    SUCCESS: { message: STRING }
    ERROR: { error: STRING }

STEPS:
1. Rate Limit Check
    1.1. CHECK RateLimit("ip", ipAddress, "auth/resend-verification", limit=3, window=3600)
    1.2. IF rate limit exceeded THEN
        RETURN ERROR("Too many resend requests.", "RATE_LIMIT_EXCEEDED")
    END IF

2. User Lookup
    2.1. email ← Trim(Lowercase(email))
    2.2. user ← Database.FindUserByEmail(email)

    2.3. IF user NOT EXISTS OR user.emailVerified = true THEN
        // Return generic success to prevent enumeration
        RETURN SUCCESS({ message: "Verification email sent if account exists." })
    END IF

3. Generate New Token
    3.1. verificationToken ← GenerateSecureRandomToken(32 bytes)
    3.2. tokenHash ← SHA256(verificationToken)
    3.3. tokenExpiry ← CurrentTimestamp() + 24 hours

4. Update User Record
    4.1. Database.UpdateUser(user.id, {
        emailVerificationToken: tokenHash,
        emailVerificationExpiry: tokenExpiry
    })

5. Send Verification Email
    5.1. verificationLink ← BuildURL("https://app.example.com/verify-email", {
        token: verificationToken
    })

    5.2. ASYNC SendEmail({
        to: email,
        subject: "Verify your email address",
        template: "email-verification",
        data: {
            verificationLink: verificationLink,
            expiryHours: 24
        }
    })

6. RETURN SUCCESS({ message: "Verification email sent if account exists." })

COMPLEXITY: O(1)
SECURITY: Generic message prevents email enumeration
```

---

## Complexity Summary

### Overall System Complexity

| Operation | Time Complexity | Space Complexity | Notes |
|-----------|----------------|------------------|-------|
| Register User | O(2^12) | O(1) | Bcrypt dominates |
| Login User | O(2^12) | O(1) | Bcrypt dominates |
| Refresh Token | O(1) | O(1) | Database lookup |
| Request Password Reset | O(1) | O(1) | Database lookup |
| Reset Password | O(2^12) | O(1) | Bcrypt dominates |
| Verify Email | O(1) | O(1) | Database lookup |
| Check Rate Limit | O(1) | O(1) | Redis Lua script |
| Check Account Lockout | O(1) | O(1) | Database/Redis lookup |

**Memory Requirements:**
- User record: ~500 bytes
- Refresh token record: ~300 bytes
- Rate limit counter: ~100 bytes per window
- Redis total: ~10 MB for 100,000 active rate limit windows

**Performance Targets:**
- Registration: < 500ms (excluding email)
- Login: < 500ms (excluding rate limit check)
- Token refresh: < 50ms
- Rate limit check: < 10ms
- Email verification: < 100ms

---

## Security Considerations

1. **Timing Attack Prevention:**
   - Always perform bcrypt operation even on invalid email
   - Consistent response times for success/failure
   - No early returns that leak information

2. **Enumeration Prevention:**
   - Generic error messages for login/password reset
   - Same response time for existing/non-existing users
   - No indication if email is registered

3. **Rate Limiting:**
   - Multi-tier rate limiting (IP, account, global)
   - Sliding window algorithm prevents burst attacks
   - Progressive lockout policies

4. **Token Security:**
   - Cryptographically secure random tokens (32 bytes)
   - SHA-256 hashing for storage
   - Short expiry times (15 min access, 1 hour reset)
   - Token rotation on refresh

5. **Password Security:**
   - Bcrypt with cost factor 12 (2^12 iterations)
   - Complexity requirements enforced
   - No password hints or recovery
   - All sessions terminated on password change

---

**END OF M1 AUTHENTICATION PSEUDOCODE**

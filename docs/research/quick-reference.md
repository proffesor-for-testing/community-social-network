# 🚀 Community Social Network - Quick Reference Card

## 📋 Tech Stack (1-Page Cheat Sheet)

### Backend
```
Node.js 20 + Express 4 + TypeScript 5
PostgreSQL 15 + Redis 7 + Prisma ORM
JWT Auth + bcrypt + Zod validation
```

### Frontend
```
React 18 + TypeScript + Vite 5
Tailwind CSS + shadcn/ui
React Query + Context API
React Router v6
```

### DevOps
```
Railway.app (MVP hosting)
Docker + Docker Compose
GitHub Actions (CI/CD)
Sentry + UptimeRobot
```

---

## 🎯 MVP Features (Must Have - Week 1-7)

| Week | Feature | Status |
|------|---------|--------|
| 1-2 | User Auth (register, login, JWT) | P0 |
| 2-3 | User Profiles (avatar, bio) | P0 |
| 3-5 | Interest Groups (create, join, discover) | P0 |
| 4-6 | Group Posts (text, feed) | P0 |
| 5-7 | Interactions (likes, reactions) | P0 |
| 6 | Comments | P1 |
| 7 | Group Moderation | P1 |
| 8 | Search (users, groups) | P1 |
| 9 | Notifications | P1 |
| 10 | Real-time updates | P1 |

---

## 🗄️ Core Data Models

### Users
```typescript
id, username, email, password_hash
display_name, bio, avatar_url, location
role (user/moderator/admin)
created_at, updated_at
```

### Groups
```typescript
id, name, slug, description
avatar_url, category
privacy (public/private)
member_count, post_count
creator_id, created_at
```

### Posts
```typescript
id, author_id, group_id
content, post_type (text/link)
reaction_count, comment_count, view_count
created_at, updated_at
```

### Relationships
```typescript
group_memberships (user_id, group_id, role)
post_reactions (user_id, post_id, type)
comments (post_id, author_id, content)
```

---

## 🔐 Security Checklist

- ✅ Passwords: bcrypt with 12 rounds
- ✅ JWT: 15min access, 7d refresh tokens
- ✅ Rate limiting: 100 req/15min (API), 5 req/15min (auth)
- ✅ Input validation: Zod schemas for all inputs
- ✅ SQL injection: Parameterized queries (Prisma)
- ✅ XSS: DOMPurify sanitization
- ✅ CSRF: CSRF tokens on state-changing requests
- ✅ HTTPS: Force SSL in production
- ✅ CORS: Whitelist frontend origin only

---

## 📊 Key Metrics

### Technical (MVP)
```
API response: <200ms (P95)
Page load: <2s (LCP)
Uptime: >99.5%
Test coverage: >70%
Lighthouse: >90
```

### Product (Week 1-4)
```
Signups: 100+ users
Active (WAU): 50+ users
Groups: 20+ created
Posts: 200+ published
Retention (D1): >50%
```

---

## 💰 Cost Breakdown

### MVP (Month 1-3)
```
Railway.app: $20-30/month
Domain: $1.25/month
Email: $0-5/month (free tier)
Total: ~$25-40/month
```

### Growth (1K+ users)
```
Infrastructure: $105-205/month
Monitoring: $46-76/month
Total: ~$150-280/month
```

---

## 🔗 Essential API Endpoints

### Auth
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
```

### Users
```
GET  /api/v1/users/me
PUT  /api/v1/users/me
POST /api/v1/users/me/avatar
```

### Groups
```
GET  /api/v1/groups
POST /api/v1/groups
POST /api/v1/groups/:id/join
GET  /api/v1/groups/:id/posts
```

### Posts
```
GET  /api/v1/groups/:id/posts
POST /api/v1/groups/:id/posts
POST /api/v1/posts/:id/react
```

---

## 📁 Project Structure

```
/backend
  /src
    /domains (users, groups, posts, auth)
    /middleware (auth, validation, errors)
    /utils (logger, validators)
  /prisma (schema, migrations)

/frontend
  /src
    /features (auth, profile, groups, feed)
    /components (ui, layout, common)
    /hooks (custom React hooks)
    /services (api, socket)

/shared
  /types (TypeScript shared types)
```

---

## 🧪 Testing Strategy

```
Unit Tests: 60% (Jest) - Business logic
Integration: 30% (Supertest) - API + DB
E2E: 10% (Playwright) - Critical flows
```

**Critical Flows**:
1. Register → Verify → Login
2. Create Group → Join → Post → React
3. View Feed → Comment
4. Search → View Profile

---

## 🚀 12-Week Timeline

| Phase | Weeks | Focus |
|-------|-------|-------|
| Foundation | 1-3 | Auth, Profiles, Groups |
| Core Features | 4-7 | Posts, Interactions, Comments |
| Enhancement | 8-10 | Search, Notifications, Real-time |
| Launch | 11-12 | Testing, Deployment, Beta |

---

## ⚠️ Top Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Security vulnerabilities | Audit, dependency scanning, rate limiting |
| DB performance | Indexing, Redis cache, query optimization |
| Low adoption | Beta testing, feedback, rapid iteration |
| Feature creep | Strict MVP scope, prioritization matrix |

---

## 📚 Research Documents

1. **comprehensive-mvp-research.md** (12,000+ words)
   - Full technical specifications
   - Complete database schema
   - API documentation
   - Security implementation

2. **tech-stack-decision.md** (6,000+ words)
   - Architecture Decision Records (ADRs)
   - Stack comparison matrices
   - Performance targets
   - Migration paths

3. **executive-summary.md** (2,000+ words)
   - Quick overview
   - Key recommendations
   - Timeline and costs

4. **quick-reference.md** (this file)
   - 1-page cheat sheet
   - Essential info only

---

## 🎓 Next Actions

### Week 0 (Setup)
- [ ] Create PRD from research
- [ ] Setup Git repositories
- [ ] Initialize Node.js + TypeScript
- [ ] Configure Docker Compose (PostgreSQL + Redis)
- [ ] Setup CI/CD (GitHub Actions)

### Week 1 (Development Start)
- [ ] Database schema (Prisma)
- [ ] User registration API
- [ ] Login/logout API
- [ ] JWT authentication
- [ ] Basic React setup

---

## 📞 Support & Resources

- **Research Base**: `/docs/research/`
- **Full Documentation**: See comprehensive-mvp-research.md
- **Tech Decisions**: See tech-stack-decision.md
- **Community**: Serbian Agentics Foundation + StartIT

---

**Version**: 1.0
**Last Updated**: 2025-11-14
**Status**: ✅ Ready for PRD Creation

**Print this card and keep it visible during development!** 🎯

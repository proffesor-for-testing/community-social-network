# Quick Start Guide - Community Social Network

## Get Started in 5 Minutes

This guide will get you from zero to coding in under 5 minutes using Claude Flow and SPARC methodology.

---

## Step 1: Review the Plan (1 minute)

Three key documents created:

1. **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Complete roadmap with 8 milestones
2. **[MVP_SUMMARY.md](./MVP_SUMMARY.md)** - Quick reference and checklists
3. **[SPARC_GOAP_ROADMAP.md](./SPARC_GOAP_ROADMAP.md)** - SPARC methodology integration

**Key Facts**:
- **Timeline**: 18 sprints (~4.5 months)
- **First Milestone**: Authentication System (2 weeks)
- **MVP Features**: User profiles, posts, comments, groups, notifications
- **Tech Stack**: Node.js/NestJS + React + PostgreSQL + Redis

---

## Step 2: Initialize Project Structure (2 minutes)

```bash
# Create directory structure
mkdir -p backend/{src,tests} frontend/{src,tests} docs/api

# Initialize backend
cd backend
npm init -y
npm install --save \
  @nestjs/core @nestjs/common @nestjs/platform-express \
  @nestjs/typeorm typeorm pg \
  @nestjs/jwt @nestjs/passport passport passport-jwt \
  bcrypt class-validator class-transformer

npm install --save-dev \
  @types/node @types/jest \
  jest ts-jest @types/bcrypt \
  supertest @types/supertest

# Initialize frontend
cd ../frontend
npm create vite@latest . -- --template react-ts
npm install --save \
  react-router-dom \
  @tanstack/react-query \
  axios \
  zustand \
  react-hook-form zod @hookform/resolvers

npm install --save-dev \
  tailwindcss postcss autoprefixer \
  @testing-library/react @testing-library/jest-dom \
  vitest
```

---

## Step 3: Setup Development Environment (2 minutes)

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: community_network
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://dev:dev_password@postgres:5432/community_network
      REDIS_URL: redis://redis:6379
      JWT_SECRET: development_secret_change_in_production
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

Start services:
```bash
docker-compose up -d
```

---

## Step 4: Launch Milestone 1 with SPARC (1 minute)

### Option A: Full SPARC Pipeline (Automated)

```bash
# Run complete SPARC pipeline for authentication
npx claude-flow sparc pipeline "user authentication system with JWT and email verification"
```

This will automatically:
1. Generate specifications
2. Create pseudocode
3. Design architecture
4. Implement with TDD
5. Deploy and integrate

### Option B: Step-by-Step SPARC (Manual Control)

```bash
# Phase 1: Specification
npx claude-flow sparc run spec-pseudocode "authentication system"

# Phase 2: Architecture
npx claude-flow sparc run architect "auth service design"

# Phase 3: TDD Implementation
npx claude-flow sparc tdd "authentication feature"

# Phase 4: Integration
npx claude-flow sparc run integration "deploy auth system"
```

### Option C: Agent Orchestration (Recommended)

Initialize swarm and spawn agents:

```bash
# Initialize coordination
npx claude-flow@alpha swarm init --topology hierarchical --max-agents 6

# Agents will spawn automatically via Claude Code's Task tool
# See coordination in: .claude-flow/swarms/
```

Then spawn agents via Claude Code (not MCP):

```javascript
// Claude Code will execute these in parallel:
Task("Specification Agent",
  "Create complete authentication specification with security requirements. Use hooks for coordination.",
  "specification")

Task("Architecture Agent",
  "Design authentication service architecture with database schema and API contracts.",
  "architecture")

Task("Backend Developer",
  "Implement NestJS authentication module with JWT and email verification using TDD.",
  "backend-dev")

Task("Test Engineer",
  "Generate comprehensive test suite with 90%+ coverage for auth module.",
  "qe-test-generator")

Task("Security Auditor",
  "Review authentication implementation for security vulnerabilities.",
  "security-manager")
```

---

## Step 5: Monitor Progress

### Check Agent Status
```bash
# View active agents
npx claude-flow@alpha agent list

# View swarm status
npx claude-flow@alpha swarm status --verbose

# View task progress
npx claude-flow@alpha task status
```

### Check Test Coverage
```bash
# Backend coverage
cd backend
npm test -- --coverage

# Frontend coverage
cd frontend
npm test -- --coverage
```

### View Coordination Memory
```bash
# Check agent coordination
npx claude-flow@alpha memory retrieve --namespace "aqe/swarm/coordination"

# View test plans
npx claude-flow@alpha memory retrieve --namespace "aqe/test-plan"
```

---

## What Happens Next?

### Automated Workflow

1. **Specification Agent** creates:
   - Authentication requirements
   - API endpoint specifications
   - Security requirements
   - Test scenarios

2. **Architecture Agent** designs:
   - Database schema (users, tokens)
   - Service architecture
   - API layer design
   - Caching strategy

3. **Backend Developer** implements:
   - User registration endpoint
   - Login with JWT
   - Email verification
   - Password reset
   - All with tests (TDD)

4. **Test Engineer** generates:
   - Unit tests (90%+ coverage)
   - Integration tests
   - E2E test scenarios
   - Performance tests

5. **Security Auditor** reviews:
   - Password hashing (bcrypt)
   - Token security
   - Rate limiting
   - OWASP compliance

### Expected Timeline

- **Day 1-2**: Specification and architecture complete
- **Day 3-7**: Backend implementation with TDD
- **Day 8-10**: Frontend integration
- **Day 11-12**: Testing and refinement
- **Day 13-14**: Security audit and deployment

---

## Milestone Completion Checklist

### Authentication System (Milestone 1)

Backend:
- [ ] User registration endpoint (`POST /api/auth/register`)
- [ ] Email verification (`POST /api/auth/verify-email`)
- [ ] Login endpoint (`POST /api/auth/login`)
- [ ] Token refresh (`POST /api/auth/refresh`)
- [ ] Password reset flow (forgot + reset)
- [ ] JWT middleware for protected routes
- [ ] Rate limiting configured
- [ ] 90%+ test coverage

Frontend:
- [ ] Registration form with validation
- [ ] Login form
- [ ] Email verification page
- [ ] Password reset flow
- [ ] Token storage and refresh logic
- [ ] Protected route component
- [ ] Error handling and user feedback

Infrastructure:
- [ ] PostgreSQL database running
- [ ] Redis for sessions
- [ ] Email service configured
- [ ] Environment variables set
- [ ] HTTPS enforced
- [ ] CORS configured

Testing:
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests for critical flows
- [ ] Load test: 1000 req/s on login
- [ ] Security scan passed

---

## Common Commands Reference

### SPARC Commands
```bash
# List available SPARC modes
npx claude-flow sparc modes

# Get mode details
npx claude-flow sparc info tdd

# Run specific mode
npx claude-flow sparc run <mode> "<task>"

# Full pipeline
npx claude-flow sparc pipeline "<feature>"

# Batch processing
npx claude-flow sparc batch spec,arch,refine "<feature>"

# Verify completion
npx claude-flow sparc verify "<milestone>"
```

### Agent Commands
```bash
# Initialize swarm
npx claude-flow@alpha swarm init --topology hierarchical

# List agents
npx claude-flow@alpha agent list

# Agent metrics
npx claude-flow@alpha agent metrics

# Task orchestration (via MCP for coordination only)
# Actual execution via Claude Code's Task tool
```

### Memory Commands
```bash
# Store pattern
npx claude-flow@alpha memory store \
  --namespace "sparc-patterns" \
  --key "auth-flow" \
  --value '{"pattern": "jwt-with-refresh"}'

# Retrieve pattern
npx claude-flow@alpha memory retrieve \
  --namespace "sparc-patterns" \
  --key "auth-flow"

# List memory
npx claude-flow@alpha memory list --namespace "aqe"
```

### Hooks Commands
```bash
# Pre-task hook
npx claude-flow@alpha hooks pre-task --description "implement auth"

# Post-edit hook (auto-format, store in memory)
npx claude-flow@alpha hooks post-edit \
  --file "src/auth/auth.service.ts" \
  --memory-key "swarm/backend/auth-service"

# Session management
npx claude-flow@alpha hooks session-restore --session-id "milestone-1"
npx claude-flow@alpha hooks session-end --export-metrics true
```

### Testing Commands
```bash
# Run tests
npm test

# Coverage report
npm test -- --coverage

# Watch mode
npm test -- --watch

# E2E tests
npm run test:e2e

# Load tests
k6 run tests/load/auth-load-test.js
```

---

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

### Agent Not Responding
```bash
# Check swarm status
npx claude-flow@alpha swarm status

# Restart swarm
npx claude-flow@alpha swarm destroy
npx claude-flow@alpha swarm init --topology hierarchical
```

### Test Failures
```bash
# Clear test cache
npm test -- --clearCache

# Run specific test
npm test -- auth.service.test.ts

# Debug mode
npm test -- --runInBand --detectOpenHandles
```

---

## Next Steps After Milestone 1

Once authentication is complete:

1. **Milestone 2: User Profiles**
   ```bash
   npx claude-flow sparc pipeline "user profiles with image upload"
   ```

2. **Milestone 3: Posts**
   ```bash
   npx claude-flow sparc pipeline "post creation with reactions and feed"
   ```

3. **Milestone 4: Comments**
   ```bash
   npx claude-flow sparc pipeline "nested comments with mentions"
   ```

---

## Resources

**Documentation**:
- [Full Implementation Plan](./IMPLEMENTATION_PLAN.md)
- [MVP Summary](./MVP_SUMMARY.md)
- [SPARC-GOAP Roadmap](./SPARC_GOAP_ROADMAP.md)

**Claude Flow**:
- [GitHub Repository](https://github.com/ruvnet/claude-flow)
- [SPARC Methodology](https://github.com/ruvnet/claude-flow#sparc)

**Tech Stack Docs**:
- [NestJS Documentation](https://docs.nestjs.com)
- [React Documentation](https://react.dev)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TypeORM Documentation](https://typeorm.io)

---

## Support & Community

**Serbian Agentics Foundation**:
- Share progress in community Slack/Discord
- Weekly demos and reviews
- Pair programming sessions

**StartIT Community**:
- Technical workshops
- Code reviews
- Knowledge sharing

**Claude Flow Support**:
- GitHub Issues: https://github.com/ruvnet/claude-flow/issues
- Agentic QE: https://github.com/ruvnet/agentic-qe-cf

---

**Ready to Start?**

Run this single command to begin:

```bash
npx claude-flow sparc pipeline "user authentication system with JWT and email verification"
```

Watch as SPARC methodology guides the development from specification to deployment with automated testing and quality assurance.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-14
**Estimated Time to First Code**: < 5 minutes

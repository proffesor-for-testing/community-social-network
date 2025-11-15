# Community Social Network

A modern social network platform for the **Serbian Agentics Foundation** and **StartIT community**, built with SPARC methodology and orchestrated by Claude Flow.

## Project Overview

Create a community-driven social network application that enables members to connect, share content, and participate in interest-based groups. The platform focuses on building strong community bonds through profiles, posts, discussions, and collaborative spaces.

## Core Features

- **User Profiles**: Complete profiles with pictures, bios, and customization
- **Content Creation**: Posts with text, images, and rich media
- **Engagement**: Likes, reactions, comments, and shares
- **Interest Groups**: Community-organized groups with moderation
- **Social Graph**: Follow users, personalized feeds
- **Notifications**: Real-time updates and email notifications
- **Administration**: Content moderation and user management

## Documentation

### Getting Started
- **[Quick Start Guide](./docs/QUICK_START.md)** - Get coding in 5 minutes
- **[Installation Guide](#installation)** - Detailed setup instructions
- **[Contributing Guidelines](#contributing)** - How to contribute

### Planning & Roadmap
- **[Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)** - Comprehensive 8-milestone roadmap
- **[MVP Summary](./docs/MVP_SUMMARY.md)** - Quick reference and checklists
- **[SPARC-GOAP Roadmap](./docs/SPARC_GOAP_ROADMAP.md)** - Methodology integration
- **[Visual Roadmap](./docs/ROADMAP_VISUAL.md)** - Timeline and dependencies

### Technical Documentation
- **[API Documentation](./docs/api/)** - API endpoints and contracts (coming soon)
- **[Database Schema](./docs/IMPLEMENTATION_PLAN.md#database-schema-overview)** - Data models
- **[Architecture](./docs/IMPLEMENTATION_PLAN.md#technology-stack-details)** - System design

## Technology Stack

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Authentication**: JWT with refresh tokens
- **Real-time**: Socket.io
- **Storage**: AWS S3 / MinIO

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod
- **HTTP Client**: TanStack Query

### Infrastructure
- **Containers**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston + ELK Stack
- **Error Tracking**: Sentry

## Development Methodology

This project uses **SPARC** (Specification, Pseudocode, Architecture, Refinement, Completion) methodology with **GOAP** (Goal-Oriented Action Planning) for systematic, test-driven development.

### SPARC Workflow
```bash
# Full pipeline for any feature
npx claude-flow sparc pipeline "feature-name"

# Individual phases
npx claude-flow sparc run spec-pseudocode "feature description"
npx claude-flow sparc run architect "system design"
npx claude-flow sparc tdd "feature implementation"
npx claude-flow sparc run integration "deploy feature"
```

### Agent Orchestration
Development is accelerated using Claude Flow's agent orchestration:
- **54 specialized agents** for parallel development
- **37 quality engineering skills** for comprehensive testing
- **Automated test generation** with 85%+ coverage target
- **Continuous integration** with GitHub Actions

## Quick Start

### Prerequisites
- Node.js 20+
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/community-social-network.git
   cd community-social-network
   ```

2. **Start development environment**
   ```bash
   docker-compose up -d
   ```

3. **Install dependencies**
   ```bash
   # Backend
   cd backend && npm install

   # Frontend
   cd ../frontend && npm install
   ```

4. **Run database migrations**
   ```bash
   cd backend
   npm run migration:run
   ```

5. **Start development servers**
   ```bash
   # Backend (in one terminal)
   cd backend && npm run start:dev

   # Frontend (in another terminal)
   cd frontend && npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API Docs: http://localhost:3000/api/docs

### Launch First Milestone

```bash
# Initialize development with SPARC
npx claude-flow sparc pipeline "user authentication system with JWT and email verification"
```

See [Quick Start Guide](./docs/QUICK_START.md) for detailed instructions.

## Project Timeline

**Total Duration**: 18 sprints (~4.5 months)

| Milestone | Features | Duration | Status |
|-----------|----------|----------|--------|
| M1: Foundation & Auth | Registration, JWT, Email verification | 2 weeks | 🟢 Ready |
| M2: Profiles & Media | User profiles, image upload, CDN | 2 weeks | 🟡 Planned |
| M3: Posts & Content | Posts, feed, reactions | 2-3 weeks | 🟡 Planned |
| M4: Comments | Nested comments, mentions | 2 weeks | 🟡 Planned |
| M5: Groups | Communities, moderation | 3 weeks | 🟡 Planned |
| M6: Social Graph | Follow system, personalized feed | 2 weeks | 🟡 Planned |
| M7: Notifications | Real-time, email, WebSocket | 2 weeks | 🟡 Planned |
| M8: Administration | Admin dashboard, analytics | 1-2 weeks | 🟡 Planned |

See [Visual Roadmap](./docs/ROADMAP_VISUAL.md) for dependencies and detailed timeline.

## Testing

### Running Tests

```bash
# Backend tests
cd backend
npm test                 # Run all tests
npm test -- --coverage   # With coverage report
npm run test:e2e         # E2E tests

# Frontend tests
cd frontend
npm test                 # Run all tests
npm test -- --coverage   # With coverage report
```

### Testing Strategy
- **Unit Tests**: 85%+ coverage target
- **Integration Tests**: API endpoints with Supertest
- **E2E Tests**: Critical user flows with Playwright
- **Load Tests**: Performance validation with K6

### Automated Test Generation
```bash
# Generate comprehensive test suite
npx claude-flow sparc tdd "feature-name"

# QE agent for test coverage analysis
Task("Coverage Analysis", "Find test gaps using O(log n) algorithm", "qe-coverage-analyzer")
```

## Contributing

We welcome contributions from the Serbian Agentics Foundation and StartIT community!

### Development Workflow

1. **Pick a milestone** from the [roadmap](./docs/IMPLEMENTATION_PLAN.md)
2. **Create feature branch**
   ```bash
   git checkout -b feature/milestone-1-auth
   ```
3. **Use SPARC for development**
   ```bash
   npx claude-flow sparc pipeline "your feature"
   ```
4. **Ensure tests pass**
   ```bash
   npm test
   ```
5. **Submit pull request**

### Code Standards
- TypeScript for all code
- 85%+ test coverage
- ESLint and Prettier configured
- Conventional commits
- Code review required

See [CLAUDE.md](./CLAUDE.md) for detailed development guidelines.

## Community

### Serbian Agentics Foundation
- Weekly progress updates
- Technical workshops
- Pair programming sessions

### StartIT Community
- Code reviews
- Knowledge sharing
- Community events

### Support
- GitHub Issues: [Report bugs and feature requests](https://github.com/your-org/community-social-network/issues)
- Discussions: [Community forum](https://github.com/your-org/community-social-network/discussions)

## Success Metrics

### Technical Goals
- 99.5% uptime
- API response time p95 < 500ms
- 85%+ test coverage
- Zero critical security vulnerabilities

### User Engagement Goals
- 500 DAU by month 3
- 2+ posts per active user
- 40%+ 7-day retention
- 60%+ users join at least one group

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Acknowledgments

- **Serbian Agentics Foundation** - Project vision and community
- **StartIT** - Community support and resources
- **Claude Flow** - Development orchestration platform
- **Agentic QE Fleet** - Automated quality engineering

---

## Next Steps

1. Review the [Quick Start Guide](./docs/QUICK_START.md)
2. Read the [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)
3. Run the first SPARC pipeline:
   ```bash
   npx claude-flow sparc pipeline "user authentication system with JWT and email verification"
   ```
4. Join our community channels for updates and collaboration

---

**Status**: Planning Complete, Ready for Development
**Last Updated**: 2025-11-14
**Version**: 1.0.0-alpha

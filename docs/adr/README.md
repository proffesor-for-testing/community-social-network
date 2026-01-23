# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the Community Social Network platform.

## ADR Index

### Foundation Decisions (System Architecture)

| ADR | Title | Status | Summary |
|-----|-------|--------|---------|
| [ADR-001](./ADR-001-monorepo-vs-multi-repo.md) | Monorepo vs Multi-Repo | Accepted | **Monorepo** - Single repository with NX for better code sharing |
| [ADR-002](./ADR-002-microservices-vs-monolith.md) | Microservices vs Monolith | Accepted | **Modular Monolith** - Monolith with clear module boundaries for MVP |
| [ADR-003](./ADR-003-rest-vs-graphql.md) | REST vs GraphQL | Accepted | **REST** - Simpler implementation, better caching for MVP |
| [ADR-004](./ADR-004-session-vs-token-auth.md) | Session-based vs Token-based Auth | Accepted | **JWT** - Stateless, mobile-friendly authentication |
| [ADR-005](./ADR-005-sql-vs-nosql.md) | SQL vs NoSQL | Accepted | **PostgreSQL** - Relational DB for complex queries and joins |

### Domain-Driven Design Decisions

| ADR | Title | Status | Summary |
|-----|-------|--------|---------|
| [ADR-006](./ADR-006-domain-driven-design-architecture.md) | Domain-Driven Design Architecture | Accepted | Adoption of DDD as primary architectural approach |
| [ADR-007](./ADR-007-bounded-contexts-definition.md) | Bounded Contexts Definition | Accepted | 7 bounded contexts aligned with business capabilities |
| [ADR-008](./ADR-008-aggregate-design-patterns.md) | Aggregate Design Patterns | Accepted | Aggregate catalog with invariants and boundaries |
| [ADR-009](./ADR-009-domain-events-strategy.md) | Domain Events Strategy | Accepted | Hybrid event strategy (in-process + queue + WebSocket) |
| [ADR-010](./ADR-010-repository-pattern-implementation.md) | Repository Pattern Implementation | Accepted | Repository pattern with 3-tier caching |

## Bounded Contexts Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Community Social Network Contexts                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────────┐  │
│  │  IDENTITY   │  │   PROFILE   │  │              CONTENT                │  │
│  │   (M1)      │  │    (M2)     │  │           (M3 + M4)                 │  │
│  ├─────────────┤  ├─────────────┤  ├─────────────────────────────────────┤  │
│  │ Member      │  │ Profile     │  │ Publication    │ Discussion        │  │
│  │ Credential  │  │ MediaAsset  │  │ Reaction       │ Mention           │  │
│  │ Session     │  │ Quota       │  │ Feed           │ Thread            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │SOCIAL GRAPH │  │  COMMUNITY  │  │NOTIFICATION │  │   ADMIN     │       │
│  │    (M6)     │  │    (M5)     │  │    (M7)     │  │   (M8)      │       │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤       │
│  │ Connection  │  │ Group       │  │ Alert       │  │Administrator│       │
│  │ Block       │  │ Membership  │  │ Preference  │  │ AuditEntry  │       │
│  │ Suggestion  │  │ Invitation  │  │ Channel     │  │ SecurityLog │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions Summary

### Domain Layer Purity
- Domain layer has **zero external dependencies**
- Repository interfaces in domain; implementations in infrastructure
- Aggregates enforce all business invariants

### Event-Driven Architecture
- **In-Process Events**: Same-context side effects
- **Bull Queue Events**: Cross-context communication (at-least-once)
- **Socket.IO Events**: Real-time client notifications

### Caching Strategy
- **3-Tier Caching**: Memory (30s) → Redis (1h) → PostgreSQL
- **Target**: 85-90% cache hit rate
- **Performance**: p95 < 500ms API response

### Aggregate Design
- **Small aggregates** to reduce lock contention
- **Reference by ID** between aggregates
- **Optimistic locking** for concurrency control

## Related Documentation

- [System Architecture Specification](../architecture/SYSTEM_ARCHITECTURE_SPECIFICATION.md)
- [M1 Authentication Architecture](../architecture/m1-auth-architecture.md)
- [M2 Profiles Architecture](../architecture/m2-profiles-architecture.md)
- [M4 Comments Architecture](../architecture/m4-comments-architecture.md)
- [M5 Groups Architecture](../architecture/m5-groups-rbac-architecture.md)
- [M6 Social Graph Architecture](../architecture/m6-social-graph-architecture.md)
- [M7 Notifications Architecture](../architecture/m7-notifications-architecture.md)
- [M8 Admin Security Architecture](../architecture/m8-admin-security-architecture.md)

## ADR Template

When creating new ADRs, use the following template:

```markdown
# ADR-NNN: Title

**Status**: Proposed | Accepted | Deprecated | Superseded
**Date**: YYYY-MM-DD
**Decision Makers**: [Team/Role]
**Related ADRs**: [Links to related ADRs]

## Context
[Describe the issue or need motivating this decision]

## Decision
[Describe the change/solution being proposed]

## Consequences
### Positive
[List positive outcomes]

### Negative
[List potential drawbacks]

### Mitigation
[How to address negative consequences]

## References
[Links to relevant documentation, articles, or resources]
```

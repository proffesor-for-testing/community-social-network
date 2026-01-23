# ADR-002: Microservices vs Monolith

**Status**: Accepted
**Date**: 2025-12-04
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-001 (Monorepo), ADR-006 (DDD Architecture)

## Context

The Community Social Network platform needs an architectural style decision that balances:

1. **MVP Delivery Speed**: Time-to-market for initial launch
2. **Operational Complexity**: Infrastructure and DevOps requirements
3. **Team Size**: Current team of 2-5 developers
4. **Scale Requirements**: Target of 10,000+ users, 1,000 concurrent
5. **Future Flexibility**: Ability to evolve as needs change

The platform has 8 feature milestones with interconnected domains:
- M1: Authentication (shared by all)
- M2: Profiles (referenced by posts, comments, groups)
- M3: Posts & Feed (complex queries across users)
- M4: Comments (nested within posts)
- M5: Groups (cross-cutting permissions)
- M6: Social Graph (affects feed, notifications)
- M7: Notifications (aggregates events from all domains)
- M8: Admin (spans all domains)

## Decision

We adopt a **Modular Monolith** architecture using **NestJS modules** with clear domain boundaries.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Modular Monolith Architecture                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Gateway Layer                               │
│                          (Single NestJS Application)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Identity  │ │   Profile   │ │   Content   │ │   Social    │           │
│  │   Module    │ │   Module    │ │   Module    │ │   Graph     │           │
│  │             │ │             │ │             │ │   Module    │           │
│  │ - Auth      │ │ - Profiles  │ │ - Posts     │ │ - Follow    │           │
│  │ - Sessions  │ │ - Media     │ │ - Comments  │ │ - Block     │           │
│  │ - Tokens    │ │ - Avatars   │ │ - Reactions │ │ - Suggest   │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
│         │               │               │               │                   │
│  ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐           │
│  │  Community  │ │Notification │ │    Admin    │ │   Shared    │           │
│  │   Module    │ │   Module    │ │   Module    │ │   Module    │           │
│  │             │ │             │ │             │ │             │           │
│  │ - Groups    │ │ - Alerts    │ │ - Dashboard │ │ - Utils     │           │
│  │ - Members   │ │ - WebSocket │ │ - Audit     │ │ - Types     │           │
│  │ - RBAC      │ │ - Email     │ │ - Security  │ │ - Errors    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                           Shared Infrastructure                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│  │    PostgreSQL    │ │      Redis       │ │    Bull Queue    │            │
│  │   (Primary DB)   │ │     (Cache)      │ │   (Job Queue)    │            │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module Structure

```typescript
// src/modules/identity/identity.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity]),
    SharedModule,
  ],
  controllers: [AuthController, SessionController],
  providers: [
    AuthService,
    TokenService,
    SessionService,
    // Repository implementations
    { provide: 'MemberRepository', useClass: PostgresMemberRepository },
  ],
  exports: [AuthService, TokenService],
})
export class IdentityModule {}

// src/modules/content/content.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([PostEntity, CommentEntity]),
    IdentityModule,  // Depends on auth
    ProfileModule,   // Depends on user profiles
    SharedModule,
  ],
  controllers: [PostController, CommentController, FeedController],
  providers: [
    PostService,
    CommentService,
    FeedService,
    { provide: 'PublicationRepository', useClass: PostgresPublicationRepository },
  ],
  exports: [PostService],
})
export class ContentModule {}
```

### Module Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                     Module Dependency Graph                      │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │    Shared    │
                    │    Module    │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │   Identity   │ │   Profile    │ │    Admin     │
    │    Module    │ │    Module    │ │    Module    │
    └──────┬───────┘ └──────┬───────┘ └──────────────┘
           │               │
           └───────┬───────┘
                   │
           ┌───────┴───────┐
           │               │
           ▼               ▼
    ┌──────────────┐ ┌──────────────┐
    │   Content    │ │ Social Graph │
    │    Module    │ │    Module    │
    └──────┬───────┘ └──────┬───────┘
           │               │
           └───────┬───────┘
                   │
                   ▼
           ┌──────────────┐
           │  Community   │
           │    Module    │
           └──────┬───────┘
                  │
                  ▼
           ┌──────────────┐
           │ Notification │
           │    Module    │
           └──────────────┘
```

## Alternatives Considered

### Option A: Microservices Architecture (Rejected)

**Structure**: Independent services per bounded context.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Identity   │  │   Content   │  │   Social    │
│   Service   │  │   Service   │  │   Service   │
│  (Port 3001)│  │  (Port 3002)│  │  (Port 3003)│
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                ┌───────▼───────┐
                │  API Gateway  │
                │  (Port 3000)  │
                └───────────────┘
```

**Pros**:
- Independent scaling per service
- Technology diversity possible
- Fault isolation
- Independent deployment

**Cons**:
- Network latency between services
- Distributed transaction complexity
- Service discovery and orchestration
- Higher operational overhead (Kubernetes, service mesh)
- Team too small for microservices ownership model
- Debugging distributed systems is harder

**Why Rejected**:
- **Team size**: Microservices work best with dedicated teams per service (2-3 devs each)
- **Operational overhead**: Requires Kubernetes, service mesh, distributed tracing
- **Latency**: Feed generation would require multiple network hops
- **Transaction complexity**: Creating a post with mentions requires coordinating multiple services

### Option B: Pure Monolith without Modules (Rejected)

**Structure**: Single codebase without clear boundaries.

**Cons**:
- No clear separation of concerns
- Difficult to reason about dependencies
- Hard to extract services later
- Testing becomes entangled

**Why Rejected**: Makes future evolution to microservices nearly impossible.

## Consequences

### Positive

- **Simple Deployment**: Single application, single container
- **Lower Latency**: In-process method calls instead of network
- **Simpler Transactions**: Database transactions span modules easily
- **Easier Debugging**: Single process, standard debugging tools
- **Lower Operational Cost**: No Kubernetes, service mesh, or complex networking
- **Faster Development**: No inter-service API contracts to maintain
- **Clear Boundaries**: NestJS modules enforce separation despite single deployment

### Negative

- **Scaling Limitations**: Entire app scales together
- **Single Point of Failure**: One bug can crash entire application
- **Technology Lock-in**: All modules use same language/framework
- **Deployment Coupling**: All modules deploy together

### Mitigation Strategies

| Risk | Mitigation |
|------|------------|
| Scaling bottlenecks | Horizontal scaling with load balancer; Redis caching |
| Single point of failure | Health checks, auto-restart, multiple replicas |
| Technology lock-in | Domain layer is framework-agnostic (ADR-006) |
| Deployment coupling | Feature flags for gradual rollouts |

## Migration Path to Microservices

The modular monolith is designed for future service extraction:

### Phase 1: Current State (Modular Monolith)
- All modules in single NestJS application
- Shared PostgreSQL database
- In-process communication

### Phase 2: Strangler Fig Pattern (If Needed)
1. Identify bottleneck module (e.g., Notifications)
2. Create separate service with own database
3. Route traffic through API gateway
4. Migrate data with dual-write pattern
5. Switch traffic to new service
6. Deprecate module in monolith

### Phase 3: Full Microservices (If Needed)
- Each bounded context as independent service
- Event-driven communication (RabbitMQ/Kafka)
- Service mesh for observability
- Distributed tracing (Jaeger/Zipkin)

### Extraction Criteria

Extract a module to a microservice when:
- Module requires independent scaling (10x traffic difference)
- Module has different SLA requirements
- Module requires different technology
- Module is owned by a dedicated team
- Module deployment frequency differs significantly

## Performance Targets

The modular monolith must meet these targets:

| Metric | Target | Achieved Via |
|--------|--------|--------------|
| API Response (p50) | < 100ms | Redis caching |
| API Response (p95) | < 500ms | Query optimization |
| API Response (p99) | < 1000ms | Connection pooling |
| Concurrent Users | 1,000 | Horizontal scaling |
| Total Users | 10,000+ | Database indexing |

## References

- Martin Fowler - Monolith First: https://martinfowler.com/bliki/MonolithFirst.html
- Sam Newman - Building Microservices (Chapter 3: Splitting the Monolith)
- NestJS Modules: https://docs.nestjs.com/modules
- System Architecture Specification: `docs/architecture/SYSTEM_ARCHITECTURE_SPECIFICATION.md`

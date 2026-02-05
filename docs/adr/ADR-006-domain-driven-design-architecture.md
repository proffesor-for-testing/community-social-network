# ADR-006: Domain-Driven Design Architecture

**Status**: Accepted
**Date**: 2025-12-16
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-002 (Modular Monolith)

## Context

The Community Social Network platform is a complex system with multiple interrelated domains including authentication, user profiles, content management, social relationships, groups, and notifications. As documented in the system architecture specification, the platform targets:

- 10,000+ users
- 300,000+ posts
- 1,000 concurrent users
- Multiple interconnected features (M1-M8 milestones)

The existing architecture adopts a modular monolith approach (ADR-002), which provides a foundation for domain separation. However, we need a systematic approach to:

1. Define clear boundaries between business domains
2. Model complex business logic consistently
3. Ensure maintainability as the system grows
4. Enable future migration to microservices if needed

## Decision

We will adopt **Domain-Driven Design (DDD)** as the primary architectural approach for modeling and implementing the business domain layer.

### Core Principles Adopted

1. **Strategic Design**: Define bounded contexts aligned with business capabilities
2. **Tactical Design**: Use DDD building blocks (entities, value objects, aggregates, repositories, domain services, domain events)
3. **Ubiquitous Language**: Establish shared vocabulary between developers and domain experts
4. **Domain-Centric Architecture**: Keep domain logic pure and framework-agnostic

### Directory Structure

```
src/
├── domain/                         # Pure domain logic (no frameworks)
│   ├── identity/                   # Identity & Access bounded context
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── aggregates/
│   │   ├── repositories/           # Interfaces only
│   │   ├── services/               # Domain services
│   │   ├── events/                 # Domain events
│   │   └── index.ts
│   ├── profile/                    # User Profile bounded context
│   ├── content/                    # Posts & Comments bounded context
│   ├── community/                  # Groups & RBAC bounded context
│   ├── social-graph/               # Follow/Block bounded context
│   ├── notification/               # Notifications bounded context
│   ├── admin/                      # Admin & Security bounded context
│   └── shared/                     # Shared kernel (common value objects)
├── application/                    # Use cases, commands, queries
│   └── [context-name]/
│       ├── commands/
│       ├── queries/
│       └── handlers/
├── infrastructure/                 # External concerns (frameworks, DB)
│   └── [context-name]/
│       ├── persistence/            # Repository implementations
│       ├── messaging/              # Event publishing
│       └── adapters/               # External service adapters
└── interfaces/                     # Entry points
    ├── api/                        # REST controllers
    └── websocket/                  # WebSocket handlers
```

### Dependency Rules

```
┌─────────────────────────────────────────────────────┐
│                    Interfaces                        │
│         (Controllers, WebSocket Handlers)            │
└────────────────────────┬────────────────────────────┘
                         │ depends on
┌────────────────────────▼────────────────────────────┐
│                   Application                        │
│          (Commands, Queries, Handlers)               │
└────────────────────────┬────────────────────────────┘
                         │ depends on
┌────────────────────────▼────────────────────────────┐
│                     Domain                           │
│  (Entities, Value Objects, Aggregates, Events)       │
│           *** NO EXTERNAL DEPENDENCIES ***           │
└─────────────────────────────────────────────────────┘
                         ▲
                         │ implements
┌────────────────────────┴────────────────────────────┐
│                 Infrastructure                       │
│   (Repositories, Messaging, External Adapters)       │
└─────────────────────────────────────────────────────┘
```

### Key Constraints

1. **Domain Layer Purity**: The domain layer MUST NOT have dependencies on:
   - NestJS or Express
   - TypeORM or any ORM
   - External libraries (except for basic utilities)

2. **Repository Interface Separation**: Repository interfaces live in the domain layer; implementations live in infrastructure.

3. **Event-Driven Communication**: Cross-context **domain logic** communication MUST use domain events, not direct method calls. NestJS module imports for infrastructure concerns (authentication guards, DTO mappers) are permitted at the interfaces/infrastructure layer, but the domain layer MUST NOT reference other contexts directly.

4. **Aggregate Boundaries**: Each aggregate defines a transactional boundary. Transactions MUST NOT span multiple aggregates.

### Architecture Fitness Functions

The following automated checks MUST run in CI to enforce architectural constraints:

#### 1. Domain Layer Purity Check

```bash
# Verify domain layer has no framework imports
# Must return 0 matches to pass

grep -r "from '@nestjs" src/domain/ && echo "FAIL: Domain layer imports NestJS" && exit 1
grep -r "from 'typeorm" src/domain/ && echo "FAIL: Domain layer imports TypeORM" && exit 1
grep -r "from 'bull'" src/domain/ && echo "FAIL: Domain layer imports Bull" && exit 1
grep -r "from 'socket.io'" src/domain/ && echo "FAIL: Domain layer imports Socket.IO" && exit 1
echo "PASS: Domain layer is framework-free"
```

#### 2. Layer Dependency Enforcement

```typescript
// tools/architecture-tests/layer-dependencies.test.ts

describe('Architecture Layer Dependencies', () => {
  it('domain layer does not import from infrastructure', () => {
    const domainImports = scanImports('src/domain/**/*.ts');
    const violations = domainImports.filter(i =>
      i.source.includes('/infrastructure/') ||
      i.source.includes('/interfaces/')
    );
    expect(violations).toHaveLength(0);
  });

  it('domain layer does not import from application', () => {
    const domainImports = scanImports('src/domain/**/*.ts');
    const violations = domainImports.filter(i =>
      i.source.includes('/application/')
    );
    expect(violations).toHaveLength(0);
  });

  it('application layer does not import from interfaces', () => {
    const appImports = scanImports('src/application/**/*.ts');
    const violations = appImports.filter(i =>
      i.source.includes('/interfaces/')
    );
    expect(violations).toHaveLength(0);
  });
});
```

#### 3. Cross-Context Import Detection

```typescript
// tools/architecture-tests/context-boundaries.test.ts

describe('Bounded Context Isolation', () => {
  const contexts = ['identity', 'profile', 'content', 'social-graph', 'community', 'notification', 'admin'];

  contexts.forEach(context => {
    it(`${context} domain does not import from other context domains`, () => {
      const imports = scanImports(`src/domain/${context}/**/*.ts`);
      const crossContextImports = imports.filter(i => {
        return contexts
          .filter(c => c !== context && c !== 'shared')
          .some(c => i.source.includes(`/domain/${c}/`));
      });
      expect(crossContextImports).toHaveLength(0);
    });
  });
});
```

These tests MUST pass in CI before any merge to `main`.

## Consequences

### Positive

- **Clear Business Logic**: Domain logic is isolated from technical concerns
- **Testability**: Domain layer can be unit tested without mocks for infrastructure
- **Maintainability**: Changes to infrastructure don't affect domain logic
- **Scalability**: Well-defined boundaries enable future service extraction
- **Consistency**: Standard patterns across all bounded contexts
- **Communication**: Ubiquitous language improves team communication

### Negative

- **Initial Complexity**: More code structure upfront
- **Learning Curve**: Team needs DDD training
- **Potential Over-Engineering**: Risk of applying DDD to simple CRUD operations
- **Translation Overhead**: Need mappers between layers

### Mitigation Strategies

1. **Complexity**: Use DDD only for complex domains; keep simple CRUD as thin services
2. **Learning**: Provide team workshops and reference implementations
3. **Over-Engineering**: Apply "just enough DDD" - start with bounded contexts and evolve
4. **Translation**: Generate mappers or use conventions to minimize boilerplate

## Implementation Guidelines

### When to Use Full DDD Tactical Patterns

| Scenario | Use Full DDD? | Reason |
|----------|---------------|--------|
| Complex business rules | Yes | Aggregates enforce invariants |
| Multiple state transitions | Yes | Entities model lifecycle |
| Cross-context coordination | Yes | Domain events for loose coupling |
| Simple CRUD operations | No | Direct repository access sufficient |
| Read-heavy queries | No | Use CQRS read models |

### Ubiquitous Language Examples

| Technical Term | Domain Term | Context |
|----------------|-------------|---------|
| `user` table | `Member` | Identity Context |
| `post` record | `Publication` | Content Context |
| `follow` relation | `Connection` | Social Graph Context |
| `group_member` | `Membership` | Community Context |
| `notification` | `Alert` | Notification Context |

## Related Decisions

- **ADR-002**: Modular Monolith provides the deployment strategy
- **ADR-007**: Defines specific bounded context boundaries
- **ADR-008**: Defines aggregate design patterns
- **ADR-009**: Defines domain event strategy
- **ADR-010**: Defines repository pattern implementation

## References

- Evans, E. (2003). Domain-Driven Design: Tackling Complexity in the Heart of Software
- Vernon, V. (2013). Implementing Domain-Driven Design
- System Architecture Specification (docs/architecture/SYSTEM_ARCHITECTURE_SPECIFICATION.md)

# ADR-001: Monorepo vs Multi-Repo

**Status**: Accepted
**Date**: 2025-12-04
**Decision Makers**: Architecture Team
**Related ADRs**: ADR-002 (Modular Monolith)

## Context

The Community Social Network platform requires a repository structure decision that will impact:

1. **Development Workflow**: How developers work across multiple modules (auth, profiles, posts, groups, etc.)
2. **Code Sharing**: Sharing utilities, types, and configurations across modules
3. **Versioning**: Managing versions and dependencies between components
4. **CI/CD**: Build, test, and deployment pipeline complexity
5. **Team Coordination**: How multiple developers collaborate on related features

The platform consists of 8 milestones (M1-M8) that share common infrastructure:
- Shared TypeScript types and interfaces
- Common utilities (validation, error handling, logging)
- Shared database schema and migrations
- Common authentication and authorization logic
- Unified API contracts

## Decision

We adopt a **Monorepo** structure using **NX** as the build system and workspace manager.

### Repository Structure

```
community-social-network/
├── apps/
│   ├── api/                    # NestJS backend application
│   └── web/                    # React frontend application
├── libs/
│   ├── shared/
│   │   ├── types/              # Shared TypeScript interfaces
│   │   ├── utils/              # Common utilities
│   │   └── constants/          # Shared constants
│   ├── domain/
│   │   ├── identity/           # Identity bounded context
│   │   ├── content/            # Content bounded context
│   │   └── ...                 # Other bounded contexts
│   └── infrastructure/
│       ├── database/           # Database utilities
│       ├── cache/              # Caching layer
│       └── messaging/          # Event bus
├── tools/
│   ├── generators/             # Code generators
│   └── scripts/                # Build/deploy scripts
├── nx.json                     # NX configuration
├── package.json                # Root package.json
└── tsconfig.base.json          # Base TypeScript config
```

### NX Configuration

```json
{
  "npmScope": "community-social-network",
  "affected": {
    "defaultBase": "main"
  },
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "e2e"]
      }
    }
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    },
    "test": {
      "inputs": ["default", "^production"]
    }
  }
}
```

## Alternatives Considered

### Option A: Multi-Repo (Rejected)

**Structure**: Separate repositories for each bounded context or service.

```
github.com/org/
├── csn-api-gateway/
├── csn-identity-service/
├── csn-content-service/
├── csn-social-graph-service/
├── csn-notification-service/
├── csn-shared-types/
└── csn-web-app/
```

**Pros**:
- Independent deployment per service
- Clear ownership boundaries
- Smaller clone sizes per repo
- Independent versioning

**Cons**:
- Complex dependency management between repos
- Difficult to make atomic changes across services
- Shared code requires publishing packages
- Harder to refactor across boundaries
- CI/CD coordination complexity
- Version synchronization challenges

**Why Rejected**: For MVP with a small team (2-5 developers), the overhead of managing multiple repositories outweighs the benefits. Cross-cutting changes (e.g., adding a new field to User) would require coordinated PRs across multiple repos.

### Option B: Monorepo without Build System (Rejected)

**Structure**: Single repo with manual dependency management.

**Cons**:
- No incremental builds (full rebuild on every change)
- No dependency graph visualization
- Manual cache management
- No affected-command support

**Why Rejected**: As the codebase grows, build times would become unacceptable without incremental compilation and caching.

## Consequences

### Positive

- **Atomic Commits**: Changes spanning multiple modules can be committed together
- **Simplified Refactoring**: Rename a shared type once, update everywhere
- **Shared Configuration**: Single ESLint, Prettier, TypeScript config
- **Incremental Builds**: NX only rebuilds affected projects
- **Dependency Graph**: NX visualizes project dependencies
- **Consistent Tooling**: Same build/test commands across all projects
- **Easier Onboarding**: Developers clone one repo to work on any feature

### Negative

- **Larger Clone Size**: Full history of all projects in one clone
- **Build Complexity**: NX learning curve for new developers
- **Potential Coupling**: Easier to accidentally create tight coupling
- **CI Time**: Full CI runs can be slow without proper caching

### Mitigation Strategies

| Risk | Mitigation |
|------|------------|
| Large clone size | Use shallow clones in CI (`git clone --depth 1`) |
| NX learning curve | Document common commands; provide team training |
| Accidental coupling | Enforce module boundaries with NX constraints |
| Slow CI | Use NX Cloud for distributed caching |

## Implementation Notes

### Module Boundary Enforcement

```json
// nx.json - enforce module boundaries
{
  "plugins": [
    {
      "plugin": "@nx/eslint-plugin",
      "options": {
        "rules": {
          "@nx/enforce-module-boundaries": [
            "error",
            {
              "depConstraints": [
                {
                  "sourceTag": "scope:domain",
                  "onlyDependOnLibsWithTags": ["scope:domain", "scope:shared"]
                },
                {
                  "sourceTag": "scope:infrastructure",
                  "onlyDependOnLibsWithTags": ["scope:domain", "scope:shared", "scope:infrastructure"]
                }
              ]
            }
          ]
        }
      }
    }
  ]
}
```

### Common Commands

```bash
# Build affected projects
nx affected:build --base=main

# Test affected projects
nx affected:test --base=main

# Visualize dependency graph
nx graph

# Generate new library
nx g @nx/node:library my-lib --directory=libs/shared
```

## References

- NX Documentation: https://nx.dev/
- Monorepo Tools Comparison: https://monorepo.tools/
- System Architecture Specification: `docs/architecture/SYSTEM_ARCHITECTURE_SPECIFICATION.md`

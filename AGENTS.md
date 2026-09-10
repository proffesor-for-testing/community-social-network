<!-- BEGIN AGENTIC-QE CODEX -->
# Quality Engineering Standards (Agentic QE)

## AQE MCP Server

This project uses Agentic QE for AI-powered quality engineering. The AQE MCP server provides tools for test generation, coverage analysis, quality assessment, and learning.

## Setup

Always call `fleet_init` before using other AQE tools to initialize the QE fleet.

## Available Tools

### Test Generation
- `test_generate_enhanced` — AI-powered test generation with pattern recognition and anti-pattern detection
- Supports unit, integration, and e2e test types

### Coverage Analysis
- `coverage_analyze_sublinear` — O(log n) coverage gap detection with ML-powered analysis
- Target: 80% statement coverage minimum, focus on risk-weighted coverage

### Quality Assessment
- `quality_assess` — Quality gate evaluation with configurable thresholds
- Run before marking tasks complete

### Security Scanning
- `security_scan_comprehensive` — SAST/DAST vulnerability scanning
- Run after changes to auth, security, or middleware code

### Defect Prediction
- `defect_predict` — AI analysis of code complexity and change history

### Learning & Memory
- `memory_store` — Store patterns and learnings for future reference
- `memory_query` — Query past patterns before starting work
- Always store successful patterns after task completion

## Best Practices

1. **Test Pyramid**: 70% unit, 20% integration, 10% e2e
2. **AAA Pattern**: Arrange-Act-Assert for clear test structure
3. **One assertion per test**: Test one behavior at a time
4. **Descriptive names**: `should_returnValue_when_condition`
5. **Mock at boundaries**: Only mock external dependencies
6. **Edge cases first**: Test boundary conditions, not just happy paths
<!-- END AGENTIC-QE CODEX -->

# Project Working Guide

## Repository Map

This is an Nx TypeScript monorepo. `apps/api` is the NestJS API, `apps/web` is the React/Vite client, `libs/domain` contains domain logic, `libs/infrastructure` contains adapters and service implementations, and `libs/shared` contains cross-cutting types, constants, and utilities.

Use Node.js 22.13 or newer. The application declares Node.js 20+, while Agentic QE 3.14.1 requires Node.js 22.13+; the higher requirement applies when using the complete development toolchain.

## Build and Test Commands

- The current Nx 18/Vite 7 peer mismatch requires `npm ci --legacy-peer-deps`. Return to plain `npm ci` after the workspace dependency versions are aligned.
- Run a focused target with `npx nx test <project>`, `npx nx lint <project>`, or `npx nx build <project>`.
- Run repository gates with `npm test`, `npm run lint`, and `npm run build`.
- Prefer focused checks while iterating, then run the affected broader gates before completion.
- Preserve `.agentic-qe/memory.db`, `.agentic-qe/patterns.rvf`, and `.swarm/memory.db`. These are persistent learning stores, not disposable build output.

The current lockfile omits version records for several transitive `@types/*` packages, which makes Nx's native task hasher stop with `Missing field version`. `NX_NATIVE_TASK_HASHER=false` is a diagnostic workaround, not a fix. With that workaround, the existing baseline still has separate test, lint, and TypeScript project-boundary failures; do not attribute those failures to Ruflo or AQE.

## Ruflo and AQE Responsibilities

Use Ruflo for persistent multi-agent coordination, swarm state, task orchestration, and orchestration memory. Use Agentic QE for test design and generation, coverage analysis, defect prediction, security scans, quality gates, and QE learning.

Both servers expose similarly named tools such as `agent_spawn` and `memory_store`. Select the tool under the intended MCP server namespace: store code-quality patterns in Agentic QE memory and orchestration decisions in Ruflo memory. Do not create parallel Ruflo and AQE swarms for the same task unless the task explicitly needs both coordination layers.

For high-level coordination, Ruflo 3.41.1 exposes `coordination_orchestrate`; AQE exposes the separate `task_orchestrate` QE tool. The Codex Ruflo allowlist uses `coordination_orchestrate` because `task_orchestrate` is not a Ruflo 3.41.1 tool.

At the beginning of QE work, call the Agentic QE `fleet_init` tool before any other AQE MCP tool, then query relevant past patterns with `memory_query`. At the end of a successful task, run `quality_assess` and store reusable findings with the AQE `memory_store` tool. For authentication, authorization, middleware, or other security-sensitive changes, also run `security_scan_comprehensive`.

Initialize a Ruflo swarm only when the work benefits from persistent coordinated agents. For ordinary single-agent edits, use Ruflo memory without creating a swarm. The Codex configuration intentionally exposes a small Ruflo tool set to keep MCP schema size manageable; extend `mcp_servers.ruflo.enabled_tools` in `.codex/config.toml` when a task needs another Ruflo capability.

## Tool Configuration and Diagnostics

- Codex loads `.codex/config.toml` after the project is trusted. Restart Codex after changing MCP configuration so the tool catalog is refreshed.
- Claude Code loads `.mcp.json`. `.claude/mcp.json` mirrors the same pinned commands for clients that consume that path.
- Ruflo is pinned to `3.41.1`; verify it with `npx --yes ruflo@3.41.1 doctor`.
- Agentic QE is pinned to `3.14.1`; verify it with `npx --yes agentic-qe@3.14.1 health` and `aqe platform verify codex --with-ruflo`.
- AQE's core MCP tools and SQLite persistence work without a background daemon. Semantic vector indexing needs a configured `AQE_EMBEDDER_ENDPOINT` in this environment; without one, `memory_store` persists entries but reports vector indexing as unavailable.
- Use `codex mcp list` or `claude mcp list` to confirm client registration. A listed config entry is not sufficient by itself; a healthy setup must also discover tools and complete a read-only MCP call.

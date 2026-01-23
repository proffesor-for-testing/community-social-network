# Claude Code Configuration - Claude Flow V3

## 📚 Reference Documentation

- [CLI Commands Reference](docs/claude-flow/cli-commands.md) - 26 commands, 140+ subcommands
- [Hooks & Workers Reference](docs/claude-flow/hooks-reference.md) - 27 hooks + 12 background workers
- [Agents Reference](docs/claude-flow/agents-reference.md) - 60+ agent types
- [AQE v3 Documentation](docs/claude-flow/aqe-v3.md) - Quality Engineering platform
- [Memory & Intelligence](docs/claude-flow/memory-intelligence.md) - Memory commands, RuVector, Hive-Mind

---

## 🚨 AUTOMATIC SWARM ORCHESTRATION

**When starting work on complex tasks, Claude Code MUST automatically:**
1. **Initialize the swarm** using CLI tools via Bash
2. **Spawn concurrent agents** using Claude Code's Task tool
3. **Coordinate via hooks** and memory

### CRITICAL: CLI + Task Tool in SAME Message

**When user says "spawn swarm" or requests complex work, Claude Code MUST in ONE message:**
1. Call CLI tools via Bash to initialize coordination
2. **IMMEDIATELY** call Task tool to spawn REAL working agents
3. Both CLI and Task calls must be in the SAME response

**CLI coordinates, Task tool agents do the actual work!**

---

## 🤖 3-TIER MODEL ROUTING (ADR-026)

| Tier | Handler | Use Cases |
|------|---------|-----------|
| **1** | Agent Booster (<1ms, $0) | Simple transforms (var→const, add-types, remove-console) |
| **2** | Haiku (~500ms, $0.0002) | Simple tasks, bug fixes, low complexity |
| **3** | Sonnet/Opus (2-5s, $0.003-$0.015) | Architecture, security, complex reasoning |

**Before spawning agents:**
```bash
npx @claude-flow/cli@latest hooks pre-task --description "[task description]"
```

- `[AGENT_BOOSTER_AVAILABLE]` → Skip LLM, use Edit tool directly
- `[TASK_MODEL_RECOMMENDATION] Use model="X"` → Use that model in Task tool

---

## 🛡️ ANTI-DRIFT CONFIG

```bash
# Small teams (6-8 agents)
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized

# Large teams (10-15 agents)
npx @claude-flow/cli@latest swarm init --topology hierarchical-mesh --max-agents 15 --strategy specialized
```

**Anti-Drift Guidelines:**
- **hierarchical**: Coordinator catches divergence
- **max-agents 6-8**: Smaller team = less drift
- **specialized**: Clear roles, no overlap

---

## 🔄 SPAWN AND WAIT PATTERN

```javascript
// STEP 1: Initialize swarm coordination
Bash("npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized")

// STEP 2: Spawn ALL agents IN BACKGROUND in a SINGLE message
Task({ prompt: "Research requirements", subagent_type: "researcher", run_in_background: true })
Task({ prompt: "Design architecture", subagent_type: "system-architect", run_in_background: true })
Task({ prompt: "Implement solution", subagent_type: "coder", run_in_background: true })
Task({ prompt: "Write tests", subagent_type: "tester", run_in_background: true })
Task({ prompt: "Review code", subagent_type: "reviewer", run_in_background: true })

// STEP 3: TELL USER, then STOP AND WAIT
```

**After spawning:**
```
"I've launched 5 agents in background:
- 🔍 Researcher: [task]
- 🏗️ Architect: [task]
- 💻 Coder: [task]
- 🧪 Tester: [task]
- 👀 Reviewer: [task]
Working in parallel - I'll synthesize when they complete."
```

### 🚫 DO NOT:
- Continuously check swarm status
- Poll TaskOutput repeatedly
- Add more tool calls after spawning
- Ask "should I check on the agents?"

### ✅ DO:
- Spawn all agents in ONE message
- Tell user what's happening
- Wait for agent results to arrive
- Synthesize results when they return

---

## 🎯 TASK COMPLEXITY DETECTION

**AUTO-INVOKE SWARM when task involves:**
- Multiple files (3+)
- New feature implementation
- Refactoring across modules
- API changes with tests
- Security-related changes
- Performance optimization

**SKIP SWARM for:**
- Single file edits
- Simple bug fixes (1-2 lines)
- Documentation updates
- Configuration changes

---

## 📁 FILE ORGANIZATION RULES

**NEVER save to root folder. Use these directories:**
- `/src` - Source code files
- `/tests` - Test files
- `/docs` - Documentation and markdown files
- `/config` - Configuration files
- `/scripts` - Utility scripts

---

## ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**
- **TodoWrite**: Batch ALL todos in ONE call
- **Task tool**: Spawn ALL agents in ONE message
- **File operations**: Batch ALL reads/writes/edits in ONE message
- **Bash commands**: Batch ALL terminal operations in ONE message

---

## 🎯 CLAUDE CODE vs CLI TOOLS

### Claude Code Handles ALL EXECUTION:
- **Task tool**: Spawn and run agents concurrently
- File operations (Read, Write, Edit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations

### CLI Tools Handle Coordination (via Bash):
```bash
npx @claude-flow/cli@latest swarm init --topology <type>
npx @claude-flow/cli@latest memory store --key "mykey" --value "myvalue" --namespace patterns
npx @claude-flow/cli@latest memory search --query "search terms"
npx @claude-flow/cli@latest hooks <hook-name> [options]
```

---

## 📋 AGENT ROUTING (Anti-Drift)

| Code | Task | Agents |
|------|------|--------|
| 1 | Bug Fix | coordinator, researcher, coder, tester |
| 3 | Feature | coordinator, architect, coder, tester, reviewer |
| 5 | Refactor | coordinator, architect, coder, reviewer |
| 7 | Performance | coordinator, perf-engineer, coder |
| 9 | Security | coordinator, security-architect, auditor |

---

## 🐝 AQE v3 (Quick Reference)

```bash
npm test -- --run          # Run tests
aqe quality assess         # Check quality
aqe test generate <file>   # Generate tests
```

**MCP Tools:** `fleet_init`, `agent_spawn`, `test_generate_enhanced`, `test_execute_parallel`, `task_orchestrate`, `coverage_analyze_sublinear`, `quality_assess`

See [AQE v3 Documentation](docs/claude-flow/aqe-v3.md) for full details.

---

## ⚠️ IMPORTANT REMINDERS

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files over creating new ones
- NEVER proactively create documentation files unless requested
- Never save working files to the root folder

---

## 🔗 Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues

**Remember: Claude Flow CLI coordinates, Claude Code Task tool creates!**

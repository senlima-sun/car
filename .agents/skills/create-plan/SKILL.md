---
name: create-plan
description: Create and manage structured plans for complex tasks. Use when starting any non-trivial work, breaking down features into phases/steps, or managing plan progress. Triggers on "create a plan", "plan this", "break down", "what are the phases", "update plan", "plan status", "mark phase complete".
---

# Create Plan

Create, track, and manage structured plans throughout their full lifecycle. Plans live as Markdown files in `.claude/plans/<name>.md` using a three-level hierarchy: Overview → Phase → Step.

## When to Use

- Starting a non-trivial feature, refactor, or bug fix
- Breaking down work into parallelizable units for sub-agents
- Tracking progress across sessions
- Managing unknowns and blockers during execution

## Plan Creation Flow

### Small Tasks (single phase, < 5 steps)

Analyze codebase and produce plan directly. Present to user for approval.

### Complex Tasks (multi-phase, cross-cutting)

1. Ask 2-3 key questions to clarify scope, constraints, and priorities
2. Explore codebase to understand existing patterns
3. Produce full plan
4. Present for user approval

### Naming

Use kebab-case: `implement-auth`, `canvas-export`, `api-rate-limiting`

## Three-Level Structure

### Level 1: Overview

Global context for the entire plan.

- **Objective**: One-line goal
- **Context**: Why this work exists, constraints, related systems
- **Scope**: What's in and out of scope
- **Dependencies**: External systems, packages, other plans

### Level 2: Phase (Quality Gate Milestones)

Logical groupings of work with clear completion criteria.

- Each phase has an optional quality gate defining "done"
- Phases execute sequentially or in parallel (mark explicitly)
- Map to meaningful integration points

### Level 3: Step (Atomic Commits)

Individual units of work at first-principles level.

- Each step = one logical commit
- Includes: target files, action description, acceptance criteria
- Small enough for a single sub-agent to execute

## Plan File Format

Store plans at `.claude/plans/<name>.md`. Reference [template](./references/template.md) for the full structure.

### Key Sections

```
Frontmatter: name, status, created, updated, session
Overview: objective, context, scope, dependencies
Phases: numbered, each with title, description, steps, quality gate
Steps: numbered within phase (1.1, 1.2, 2.1), with location, action, criteria
Unknowns: tracked items with category, impact, status
Decisions: table of key decisions with rationale
Resume: instructions for next session
```

## Lifecycle

```
draft → approved → active → paused/blocked → completed → archived
```

| Status    | Meaning                                  |
| --------- | ---------------------------------------- |
| draft     | Plan created, awaiting user approval     |
| approved  | User approved, ready to execute          |
| active    | Currently being executed                 |
| paused    | Temporarily stopped, will resume         |
| blocked   | Cannot proceed, needs resolution         |
| completed | All phases done, quality gates passed    |
| archived  | Completed and moved to historical record |

### Status Transitions

- `draft` → `approved`: User approves plan
- `approved` → `active`: Execution begins
- `active` → `paused`: User requests pause or context switch
- `active` → `blocked`: Unresolved blocker encountered
- `blocked` → `active`: Blocker resolved
- `paused` → `active`: Work resumes
- `active` → `completed`: All phases done
- `completed` → `archived`: Plan archived after wrap-up

## Operations

### Create Plan

1. Determine task complexity (small vs complex)
2. For complex: ask clarifying questions via AskUserQuestion
3. Explore codebase with Glob/Grep/Read
4. Write plan file to `.claude/plans/<name>.md` using template
5. Set status to `draft`
6. Present summary to user for approval

### Update Progress

When completing steps or phases:

1. Read current plan file
2. Mark step checkbox `[x]`
3. Update phase progress
4. Update `last-updated` timestamp
5. Write back with Edit tool

### Manage Unknowns

Track items that need resolution during execution.

**Categories:**

| Category      | When to Use                       |
| ------------- | --------------------------------- |
| clarification | Requirement is ambiguous          |
| validation    | Assumption needs confirmation     |
| risk          | Potential issue identified        |
| blocker       | Cannot proceed without resolution |
| dependency    | External dependency unclear       |

**Impact levels:** high (blocks work), medium (may require rework), low (minor)

**Adding an unknown:**

1. Read plan file
2. Add entry to Unknowns section with ID, category, impact, description
3. Write back

**Resolving an unknown:**

1. Read plan file
2. Update unknown status to `resolved`
3. Add resolution text
4. If resolution affects steps, update affected steps
5. Write back

### Transition Status

1. Read plan file
2. Update `status` field in frontmatter
3. If blocking: add blocker details to Unknowns
4. If completing: verify all phases are done
5. Update timestamp
6. Write back

### Resume Plan

At session start:

1. Check `.claude/plans/` for active/paused/blocked plans
2. List them for user
3. Read selected plan
4. Follow Resume Instructions section
5. Continue from last in-progress step

## Quality Gates

Phases may define optional quality gates. When a phase has a gate:

1. Complete all steps in the phase
2. Run the defined checks (reference `quality-gates` skill for standard checks)
3. Only proceed to next phase after gate passes

Common gate types:

- `typecheck`: `pnpm typecheck`
- `test`: `pnpm test` or scoped test
- `lint`: `pnpm lint`
- `review`: Dispatch `code-review` skill
- `custom`: Phase-specific validation

## Anti-Patterns

- Creating plans for trivial tasks (< 3 steps, single file)
- Over-specifying steps (implementation details belong in code, not plan)
- Skipping quality gates to move faster
- Letting plan files go stale (update or archive)
- Giant monolithic phases (break into smaller, parallelizable units)
- Missing unknowns tracking (capture ambiguity immediately)

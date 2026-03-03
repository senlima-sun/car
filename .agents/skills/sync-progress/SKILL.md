---
name: sync-progress
description: Sync and persist session progress to .claude/progress/<name>.md files. Use when starting a new session, before context gets large, at major milestones, or when explicitly asked to save progress. Enables continuity across multiple sessions without compacting.
---

# Progress Sync Guidelines

## Purpose

Maintain continuity across Claude Code sessions by persisting progress to markdown files in `.claude/progress/`. This allows:

- **Session handoff** — Resume work in a new session without losing context
- **Avoiding compaction** — Save state before context window fills up
- **Multi-task tracking** — Track different workstreams separately
- **Audit trail** — Keep history of decisions and changes

## When to Sync Progress

### Trigger Automatically

1. **Session start** — Check for existing progress files to resume
2. **Major milestone** — Feature complete, significant refactor done
3. **Before complex operation** — About to make many changes
4. **Context getting large** — Proactively save before compaction needed
5. **Switching tasks** — Save current task before pivoting
6. **End of work session** — User says "done for now", "save progress", etc.

### User Commands

- "save progress" / "sync progress"
- "checkpoint" / "save state"
- "I'm done for now"
- "continue later"

## Progress File Format

### Location

Mostly will be `.claude/progress/<task-name>.md`

Use kebab-case for task names: `api-refactor.md`, `auth-implementation.md`, `bug-fix-1234.md`

### Template

You can reference [template](./reference/template.md) for the full structure. Key sections include:

- **Status**: Current state (in-progress, completed, blocked, paused), last updated timestamp, session identifier
- **Objective**: One-line description of the goal
- **Context**: Background, why this work is being done, constraints, related files/modules
- **Completed**: Checklist of finished items with file references
- **In Progress**: Current work items, notes on state, blockers
- **Remaining**: Future tasks to complete
- **Key Decisions**: Table of decisions made, rationale, date
- **Files Changed**: List of files modified with brief descriptions
- **Notes**: Additional context, gotchas, reminders
- **Resume Instructions**: Clear steps for the next session to pick up where left off

## Operations

### Creating New Progress File

When starting a new task:

1. Ask user for a task name (or infer from context)
2. Create `.claude/progress/<task-name>.md`
3. Fill in Objective and Context sections
4. Initialize empty Completed/In Progress/Remaining lists

### Updating Progress

During work:

1. Move items between Completed/In Progress/Remaining
2. Update Files Changed as edits are made
3. Record key decisions with rationale
4. Update Last Updated timestamp

### Saving Progress (Checkpoint)

When syncing:

1. Update all sections with current state
2. Write clear Resume Instructions
3. Ensure Files Changed is complete
4. Set appropriate Status

### Resuming Progress

When starting a session:

1. Check `.claude/progress/` for existing files
2. List active tasks (state != completed)
3. Ask user which task to resume (if multiple)
4. Read the file and follow Resume Instructions

## Best Practices

### DO

- Keep progress files focused (one task per file)
- Update incrementally, not just at end
- Include enough context for cold start
- Reference specific files and line numbers
- Record WHY decisions were made

### DON'T

- Create progress files for trivial tasks
- Include sensitive data (secrets, credentials)
- Let files get stale (update or archive)
- Duplicate information already in commits

## File Lifecycle

```
Created → In Progress → Completed → Archived
↓
Paused/Blocked
```

### Archiving

When task is complete:

1. Set Status to `completed`
2. Optionally move to `.claude/progress/archive/`
3. Or delete if captured in commits/docs

## Integration with Other Skills

- **git-commit**: Reference progress file in commit when relevant
- **code-review**: Include progress context for reviewers
- **testing**: Track test coverage progress in the file

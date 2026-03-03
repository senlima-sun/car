---
name: <plan-name>
status: draft
created: YYYY-MM-DD
last-updated: YYYY-MM-DD HH:MM
session: <session-identifier>
---

## Overview

**Objective**: <One-line description of what we're trying to accomplish>

**Context**:
<Brief background — why this work exists, key constraints, related systems>

**Scope**:
- In: <what's included>
- Out: <what's explicitly excluded>

**Dependencies**:
- <External systems, packages, other plans this depends on>

## Phases

### Phase 1: <Title>

<Brief description of this phase's goal>

**Steps:**

- [ ] **1.1** <Step title>
  - Location: `<file/module path>`
  - Action: <what to do>
  - Criteria: <how to verify it's done>

- [ ] **1.2** <Step title>
  - Location: `<file/module path>`
  - Action: <what to do>
  - Criteria: <how to verify it's done>

**Quality Gate**: <optional — e.g., "typecheck + tests pass for packages/auth">

---

### Phase 2: <Title>

<Brief description>

**Steps:**

- [ ] **2.1** <Step title>
  - Location: `<file/module path>`
  - Action: <what to do>
  - Criteria: <how to verify it's done>

**Quality Gate**: <optional>

---

## Unknowns

| ID  | Category      | Impact | Description          | Status   | Resolution |
| --- | ------------- | ------ | -------------------- | -------- | ---------- |
| U1  | clarification | medium | <what's unclear>     | open     |            |
| U2  | risk          | high   | <potential issue>    | resolved | <how>      |

## Decisions

| Decision           | Rationale | Date       |
| ------------------ | --------- | ---------- |
| <What was decided> | <Why>     | YYYY-MM-DD |

## Resume Instructions

1. Read this plan file
2. Check status of current phase
3. Review open unknowns
4. Continue from last unchecked step

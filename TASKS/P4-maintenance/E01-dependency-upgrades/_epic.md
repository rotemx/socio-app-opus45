# E01: Coordinated Dependency Upgrades

| Field | Value |
|-------|-------|
| Project | P4-maintenance |
| Status | not-started |
| Priority | High |
| Created | 2025-12-17 |

## Overview

This epic covers coordinated major dependency upgrades that require updating multiple packages together to avoid version mismatches and peer dependency conflicts. These upgrades were identified during a comprehensive PR review of 21 Dependabot PRs.

## Scope

* NestJS v11 complete ecosystem upgrade (backend)
* Zod v4 monorepo-wide upgrade (backend, web, shared)
* Configure Dependabot to group related packages
* CI workflow merge (PRs #4, #5 require workflow scope)

## Technical Requirements

* All NestJS packages must be upgraded together to v11
* Zod must be upgraded across all workspace packages simultaneously
* Node.js 20+ required for NestJS v11
* ts-jest must be upgraded before Jest 30 (when available)
* Dependabot configuration should group related packages

## Definition of Done

- [ ] NestJS v11 upgrade complete with all tests passing
- [ ] Zod v4 upgrade complete across monorepo
- [ ] Dependabot configured to prevent fragmented upgrades
- [ ] CI workflow PRs merged
- [ ] All backends tests pass
- [ ] All web builds succeed

## Stories

| ID | Title | Status |
|----|-------|--------|
| SOC-126 | NestJS v11 Coordinated Upgrade | backlog |
| SOC-127 | Zod v4 Monorepo Upgrade | backlog |
| SOC-128 | Dependabot Configuration Update | backlog |
| SOC-129 | CI Workflow PR Merge | backlog |
| SOC-130 | Jest 30 Upgrade (Deferred) | backlog |

---

**AI Agent Prompt:**

```
This epic handles coordinated dependency upgrades identified from PR review.
Key principle: Related packages must be upgraded together to avoid peer dependency conflicts.
Follow the migration guides for each framework before upgrading.
```

# SOCIO-108: GitHub Actions CI Pipeline

## Ticket Summary
**Ticket**: SOCIO-108
**Title**: Setup GitHub Actions CI Pipeline
**Status**: Completed
**Date**: 2025-11-28

## Overview
This ticket implemented a comprehensive CI/CD pipeline using GitHub Actions for the Socio monorepo. The pipeline includes automated testing, linting, type checking, security scanning, and dependency management.

## Files Created

### 1. `.github/workflows/ci.yml`
Main CI workflow with the following features:
- **Change Detection**: Uses `dorny/paths-filter@v3` to detect changes per workspace
- **Parallel Job Execution**: Jobs run in parallel when dependencies allow
- **Concurrency Control**: Cancels in-progress runs on new pushes
- **Service Containers**: PostgreSQL/PostGIS and Redis for backend tests
- **Coverage Reporting**: Codecov integration for test coverage

#### Jobs Structure:
```
detect-changes
    ↓
types-check (if packages/types changed)
    ↓
shared-check ─────────────────────────┐
ui-check ─────────────────────────────┤
    ↓                                 ↓
backend-tests    web-build    mobile-check
    └──────────────┴──────────────┘
                   ↓
              ci-success
```

### 2. `.github/workflows/codeql.yml`
CodeQL security analysis workflow:
- Runs on push to main/develop, PRs, and weekly schedule
- Scans JavaScript/TypeScript code for vulnerabilities
- Uses security-and-quality query suite

### 3. `.github/dependabot.yml`
Automated dependency updates:
- Weekly updates on Monday at 09:00 IST
- Separate configurations for:
  - Root package.json
  - Backend app (NestJS, Prisma, AWS SDK groups)
  - Web app (React, Vite groups)
  - Mobile app (React Navigation group)
  - GitHub Actions
- Conservative approach for React Native (no major updates)

### 4. `.github/PULL_REQUEST_TEMPLATE.md`
PR template with:
- Summary section
- Change type checkboxes
- Related issues linking
- Testing checklist
- Review checklist

## Technical Details

### Environment Configuration
| Variable | Value | Purpose |
|----------|-------|---------|
| NODE_VERSION | 20 | Node.js LTS version |
| PNPM_VERSION | 10.20.0 | Matches project packageManager |

### Services Configuration

#### PostgreSQL/PostGIS
```yaml
image: postgis/postgis:16-3.4
env:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres
  POSTGRES_DB: socio_test
```

#### Redis
```yaml
image: redis:7-alpine
```

### Test Environment Variables
```yaml
DATABASE_URL: postgresql://postgres:postgres@localhost:5432/socio_test
REDIS_URL: redis://localhost:6379
JWT_SECRET: test-jwt-secret-for-ci-minimum-32-chars
CORS_ORIGIN: http://localhost:3000
NODE_ENV: test
```

## Change Detection Filters

| Filter | Triggers On |
|--------|-------------|
| backend | apps/backend/**, packages/types/**, packages/shared/**, pnpm-lock.yaml |
| mobile | apps/mobile/**, packages/shared/**, packages/ui/**, packages/types/**, pnpm-lock.yaml |
| web | apps/web/**, packages/shared/**, packages/ui/**, packages/types/**, pnpm-lock.yaml |
| shared | packages/shared/**, packages/types/**, pnpm-lock.yaml |
| types | packages/types/**, pnpm-lock.yaml |
| ui | packages/ui/**, packages/types/**, pnpm-lock.yaml |

## Job Dependencies

Jobs use conditional execution with `if: always()` and result checking to ensure:
- Downstream jobs wait for dependencies
- Skipped jobs (no changes) don't block execution
- Failed dependencies prevent downstream execution

## Security Considerations

1. **Minimal Permissions**: Workflow uses `permissions: contents: read` (principle of least privilege)
2. **CodeQL Scanning**: Weekly security scans with immediate PR scans
3. **Dependabot**: Automated security updates for dependencies
4. **Secret Handling**: Uses GitHub Secrets for sensitive values (CODECOV_TOKEN)

## Code Review Summary

### Self-Review Fixes
1. Added `permissions` block for security best practices
2. Updated PNPM_VERSION to match package.json (10.20.0)
3. Removed unused helper function from ci-success job

### CodeRabbit Review (2 iterations)
**Iteration 1 Issues**:
1. Unused change detection filters (config, any_package) - Fixed: Removed
2. Missing E2E test mention - Fixed: Added "Out of Scope" section with follow-up tickets

**Iteration 2**: All checks passed

## Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| Detect changes per workspace | ✅ Implemented |
| Backend tests with PostgreSQL/PostGIS and Redis | ✅ Implemented |
| Mobile lint and typecheck | ✅ Implemented |
| Web build and lint | ✅ Implemented |
| Shared packages tests | ✅ Implemented |
| Code coverage to Codecov | ✅ Implemented |
| PR checks block merge | ✅ Implemented |
| CodeQL security scanning | ✅ Implemented |
| Dependabot configuration | ✅ Implemented |
| PR template | ✅ Implemented |
| Staging deployment | ⏸️ Deferred (requires AWS secrets) |

## Out of Scope (Follow-up Tickets)

- **SOCIO-109**: E2E test automation with Playwright/Cypress
- **SOCIO-110**: Production deployment workflow

## Usage

### Triggering CI
CI runs automatically on:
- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop`

### Viewing Results
1. Navigate to repository's Actions tab
2. Select "CI" workflow
3. View job results and logs

### Adding Coverage Token
1. Create Codecov account and get repository token
2. Add `CODECOV_TOKEN` to repository secrets

## Dependencies

No new runtime dependencies. GitHub Actions used:
- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/upload-artifact@v4`
- `pnpm/action-setup@v4`
- `dorny/paths-filter@v3`
- `codecov/codecov-action@v4`
- `github/codeql-action/init@v3`
- `github/codeql-action/autobuild@v3`
- `github/codeql-action/analyze@v3`

## Related Tickets
- **SOCIO-104**: NestJS Backend Scaffold (prerequisite)
- **SOCIO-105**: Prisma/PostGIS Setup (prerequisite)
- **SOCIO-106**: React Native Init (prerequisite)
- **SOCIO-107**: AWS Free Tier (prerequisite)
- **SOCIO-109**: E2E Test Automation (follow-up)
- **SOCIO-110**: Production Deployment (follow-up)

# Socio Chat Application

## Project Overview

Location-based chat room discovery platform for the Tel Aviv LGBT community. Users can find nearby communities, engage in real-time conversations, and connect through voice/video calls.

---

## AI Agent Instructions

### Task Management with Linear (REQUIRED)

**Always use MCP (Model Context Protocol) to connect to Linear for task management.**

Before starting any work:
1. **Fetch the ticket** using `mcp__linear__get_issue` with the ticket ID (e.g., `SOC-56`)
2. **Read the ticket description** carefully - it contains acceptance criteria and AI agent prompts
3. **Update ticket status** to "In Progress" using `mcp__linear__update_issue`
4. **When complete**, update status to "Done"

```
Available Linear MCP Tools:
- mcp__linear__get_issue        # Get ticket details
- mcp__linear__list_issues      # List tickets with filters
- mcp__linear__update_issue     # Update ticket status/fields
- mcp__linear__create_issue     # Create new tickets
- mcp__linear__create_comment   # Add comments to tickets
- mcp__linear__list_projects    # List projects
- mcp__linear__list_teams       # List teams
```

### Workflow for Tickets

1. **Start**: Fetch ticket → Read requirements → Update status to "In Progress"
2. **Plan**: Break down into subtasks, use TodoWrite for tracking
3. **Implement**: Follow coding best practices below
4. **Review**: Self-review for bugs, security, best practices
5. **Test**: Run tests, ensure all pass
6. **Complete**: Update Linear ticket to "Done"

---

## Agent Coding Best Practices

### Before Writing Code

1. **Read existing code first** - Never propose changes to code you haven't read
2. **Understand patterns** - Follow existing codebase patterns and conventions
3. **Check for existing solutions** - Search codebase before implementing from scratch
4. **Plan the approach** - Use TodoWrite for complex multi-step tasks

### While Writing Code

1. **Security First**
   - Validate all inputs (use Zod schemas)
   - Never trust user input
   - Use parameterized queries (Prisma handles this)
   - Implement rate limiting on public endpoints
   - Mask sensitive data in logs (phone numbers, tokens, etc.)
   - Fail closed on security checks (reject if uncertain)

2. **Error Handling**
   - Always handle errors explicitly
   - Use appropriate HTTP status codes
   - Return user-friendly error messages
   - Log detailed errors internally (masked)
   - Never expose stack traces to users

3. **Type Safety**
   - Use TypeScript strict mode
   - Never use `any` type
   - Define explicit return types
   - Use Zod for runtime validation
   - Export types from DTOs

4. **Code Quality**
   - Keep functions small and focused
   - Use meaningful variable/function names
   - Add JSDoc comments for public APIs
   - Follow single responsibility principle
   - Avoid premature optimization

5. **Testing**
   - Write tests alongside implementation
   - Cover happy path and error cases
   - Mock external dependencies
   - Aim for 80%+ coverage on services
   - Test edge cases and boundary conditions

### After Writing Code

1. **Self-Review Checklist**
   - [ ] No hardcoded secrets or credentials
   - [ ] Input validation on all endpoints
   - [ ] Rate limiting on public endpoints
   - [ ] Error handling for all async operations
   - [ ] Sensitive data masked in logs
   - [ ] TypeScript compiles without errors
   - [ ] All tests pass
   - [ ] No lint errors

2. **Security Review** (for auth/sensitive features)
   - [ ] Authentication checks in place
   - [ ] Authorization verified (user can access resource)
   - [ ] Rate limiting prevents abuse
   - [ ] No SQL/command injection vectors
   - [ ] No XSS vulnerabilities
   - [ ] Secrets stored in environment variables

---

## Code Review Guidelines

### When Reviewing Code

1. **Security**
   - Check for injection vulnerabilities
   - Verify authentication/authorization
   - Ensure sensitive data is protected
   - Validate rate limiting implementation
   - Check for fail-open vs fail-closed behavior

2. **Correctness**
   - Logic matches requirements
   - Edge cases handled
   - Error states managed
   - Race conditions considered
   - Data consistency maintained

3. **Maintainability**
   - Code is readable and self-documenting
   - Functions have single responsibility
   - No unnecessary complexity
   - Follows existing patterns
   - Properly typed

4. **Performance**
   - No N+1 queries
   - Appropriate caching
   - Efficient algorithms
   - No memory leaks
   - Async operations used correctly

5. **Testing**
   - Tests cover requirements
   - Edge cases tested
   - Mocks are appropriate
   - Tests are maintainable
   - No flaky tests

### Review Iterations

When asked to review, perform multiple passes:
1. **Pass 1**: Security issues (CRITICAL)
2. **Pass 2**: Correctness and logic bugs
3. **Pass 3**: Error handling
4. **Pass 4**: Code quality and maintainability
5. **Pass 5**: Performance considerations

---

## Tech Stack

- **Mobile**: React Native 0.76+, TypeScript, Zustand, TanStack Query
- **Web**: React.js 18, Vite, TypeScript
- **Backend**: NestJS 10, Socket.io, Prisma, PostgreSQL/PostGIS, Redis
- **Voice/Video**: 100ms SDK
- **Monorepo**: Turborepo with pnpm workspaces

## Development Commands

```bash
# Start all services
pnpm dev

# Backend only
pnpm dev --filter=@socio/backend

# Web only
pnpm dev --filter=@socio/web

# Mobile (requires emulator/device)
pnpm dev --filter=@socio/mobile

# Run tests
pnpm test

# Lint all packages
pnpm lint

# Database migrations
cd apps/backend && npx prisma migrate dev
```

## Project Structure

```
socio/
├── apps/
│   ├── backend/      # NestJS server
│   ├── mobile/       # React Native app
│   └── web/          # React.js web app
├── packages/
│   ├── shared/       # Shared business logic (stores, hooks, services)
│   ├── ui/           # Shared UI components
│   ├── types/        # Shared TypeScript types
│   └── config/       # Shared configurations
└── docs/             # Documentation
```

## Code Conventions

- TypeScript strict mode everywhere
- Functional components with hooks (React/React Native)
- async/await, never callbacks
- Zod for runtime validation
- Use existing patterns as templates

## Key Patterns

- **WebSocket Handler**: See `apps/backend/src/modules/chat/chat.gateway.ts`
- **Zustand Store**: See `packages/shared/src/stores/chatStore.ts`
- **TanStack Query Hook**: See `packages/shared/src/hooks/useChatHistory.ts`
- **UI Component**: See `packages/ui/src/components/MessageBubble.tsx`

## Testing Requirements

- Unit tests for all services (80% coverage minimum)
- Component tests for UI components
- E2E tests for critical flows (auth, chat, room discovery)

## DO NOT

- Modify authentication without security review
- Add npm packages without approval
- Use `any` type
- Skip error handling
- Use inline styles in React Native
- Commit sensitive data (API keys, secrets)

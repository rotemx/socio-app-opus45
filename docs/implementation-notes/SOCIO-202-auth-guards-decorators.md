# SOCIO-202: Auth Guards and Decorators Implementation

## Summary

Implemented authentication guards and decorators for protecting HTTP routes and WebSocket connections. This includes JWT authentication guard, WebSocket auth guard, role-based access control guard, and user extraction decorators.

## Implementation Details

### Files Created

1. **`apps/backend/src/common/guards/roles.guard.ts`**
   - Role-based access control (RBAC) guard
   - Works with `@Roles()` decorator to check user permissions
   - Throws `UnauthorizedException` (401) for unauthenticated users
   - Throws `ForbiddenException` (403) for authenticated users lacking required roles
   - Safely handles malformed roles arrays

2. **`apps/backend/src/common/guards/jwt-auth.guard.spec.ts`**
   - 7 tests covering public routes, token extraction, validation, and error handling

3. **`apps/backend/src/common/guards/ws-auth.guard.spec.ts`**
   - 8 tests covering token extraction from auth.token and headers, validation, and error handling

4. **`apps/backend/src/common/guards/roles.guard.spec.ts`**
   - 10 tests covering role checking, missing roles, unauthenticated users, and edge cases

### Files Modified

1. **`apps/backend/src/common/guards/jwt-auth.guard.ts`**
   - Complete implementation replacing stub
   - Uses `AuthService.verifyAccessToken()` for token validation
   - Supports `@Public()` decorator to skip auth for specific routes
   - Extracts Bearer token from Authorization header
   - Attaches validated user payload to request object

2. **`apps/backend/src/common/guards/ws-auth.guard.ts`**
   - Complete implementation replacing stub
   - Supports token via `handshake.auth.token` (preferred)
   - Falls back to Authorization header (with or without Bearer prefix)
   - Throws structured `WsException` for Socket.io error handling
   - Attaches user to `client.data.user` for gateway access

3. **`apps/backend/src/common/decorators/current-user.decorator.ts`**
   - Added validation - throws error if user not present
   - `@CurrentUser()` extracts full payload or specific property
   - `@WsCurrentUser()` for WebSocket gateways with WsException

4. **`apps/backend/src/common/guards/index.ts`**
   - Added export for `RolesGuard`

## Guard Usage

### HTTP Routes with JwtAuthGuard

```typescript
// Protected route (default)
@Get('profile')
getProfile(@CurrentUser() user: AccessTokenPayload) {
  return { userId: user.sub };
}

// Public route
@Public()
@Get('health')
healthCheck() {
  return { status: 'ok' };
}

// Role-protected route
@Roles('admin')
@UseGuards(RolesGuard)
@Delete(':id')
deleteUser(@Param('id') id: string) {}
```

### WebSocket with WsAuthGuard

```typescript
@WebSocketGateway()
@UseGuards(WsAuthGuard)
export class ChatGateway {
  @SubscribeMessage('message:send')
  handleMessage(
    @WsCurrentUser() user: AccessTokenPayload,
    @MessageBody() payload: SendMessageDto,
  ) {
    // user.sub is the authenticated user ID
  }
}
```

## Security Features

### JWT Authentication Guard
- Validates Bearer token from Authorization header
- Checks token signature and expiration via AuthService
- Supports public route bypass with `@Public()` decorator
- Returns 401 Unauthorized for missing/invalid tokens

### WebSocket Authentication Guard
- Validates token during connection handshake
- Supports multiple token locations for client flexibility
- Structured error responses for Socket.io clients
- Stores validated user in socket data for subsequent messages

### Role-Based Access Control
- Proper HTTP status codes: 401 (unauthenticated) vs 403 (unauthorized)
- Supports single or multiple required roles (OR logic)
- Metadata-based role checking via `@Roles()` decorator
- Safe handling of missing or malformed user roles

## Testing

```bash
# Run guard tests
cd apps/backend && npx jest src/common/guards/

# Results: 25 tests passed
# - jwt-auth.guard.spec.ts: 7 tests
# - ws-auth.guard.spec.ts: 8 tests
# - roles.guard.spec.ts: 10 tests
```

## CodeRabbit Review

### Issues Fixed
1. **Exception Type Correction**: Changed RolesGuard to throw `UnauthorizedException` (401) for unauthenticated users instead of `ForbiddenException` (403)
2. **Array Validation**: Added `Array.isArray()` check before calling `.includes()` on user roles
3. **Test Optimization**: Consolidated duplicate guard invocations in tests

### Acknowledged Suggestions (Not Implemented)
- Generic type parameters for decorators to improve type inference
- Reason: NestJS `createParamDecorator` has limitations with generics; current implementation is correct and functional

## Global Guard Registration

To apply JwtAuthGuard globally (all routes protected by default):

```typescript
// app.module.ts
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

## Dependencies

No new dependencies required - uses existing:
- `@nestjs/common` - Guards, decorators, exceptions
- `@nestjs/core` - Reflector for metadata
- `@nestjs/websockets` - WsException

## Completion Date

2025-11-28

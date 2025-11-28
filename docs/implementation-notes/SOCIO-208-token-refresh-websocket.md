# SOCIO-208: Token Refresh WebSocket Integration

## Summary

Implemented token refresh functionality over active WebSocket connections, allowing clients to refresh their JWT tokens without disconnecting from the Socket.io gateway.

## Implementation Details

### Files Modified

1. **`apps/backend/src/modules/chat/chat.gateway.ts`**
   - Added `auth:refresh` message handler for token refresh
   - Handler does NOT use WsAuthGuard (intentional - allows expired access tokens)
   - Validates that socket was originally authenticated (has user data)
   - Calls `authService.refreshTokens()` with the refresh token
   - Updates `client.data.user` with new token payload
   - Emits `auth:refreshed` event with new tokens
   - Returns new tokens as acknowledgment callback response
   - Fixed lint warnings for type-only imports

2. **`apps/backend/src/modules/chat/dto/chat.dto.ts`**
   - Added `WsTokenRefreshDto` with Zod validation schema
   - Added `TokenRefreshResponse` interface for response typing

3. **`packages/shared/src/services/websocket.ts`**
   - Added Zod schemas for runtime validation (`tokenRefreshResultSchema`, `tokenRefreshErrorSchema`)
   - Added `TokenRefreshResult` and `TokenRefreshError` types (Zod-inferred)
   - Added `refreshTokens(refreshToken, timeoutMs?)` method with timeout handling
   - Added `onTokenRefresh()` and `onTokenRefreshError()` subscription methods
   - Added event listeners for `auth:refreshed` and error events
   - Added `isConnected()` and `getSocket()` utility methods
   - Errors are logged instead of silently dropped

4. **`packages/shared/package.json`**
   - Added `zod` as a dependency for runtime validation

### Architecture

```
Client                          Server (ChatGateway)
   |                                  |
   |--- auth:refresh { refreshToken } --->|
   |                                  |
   |                     1. Validate socket has user data
   |                     2. Call authService.refreshTokens()
   |                     3. Verify new access token
   |                     4. Update client.data.user
   |                                  |
   |<--- auth:refreshed { tokens } ---|
   |<--- callback({ tokens }) --------|
   |                                  |
```

### Security Considerations

1. **No WsAuthGuard**: The token refresh handler intentionally omits the WsAuthGuard because:
   - Clients need to refresh when their access token is expired
   - The guard would reject requests with expired tokens
   - The refresh token validation by `authService.refreshTokens()` provides authentication
   - Socket must have `client.data.user` from initial authenticated connection

2. **Zod Validation**: All incoming payloads are validated with Zod schemas:
   - WebSocket message payloads validated on server
   - Server responses validated on client
   - Prevents type confusion attacks

3. **Timeout Handling**: Client-side refresh has 10-second default timeout to prevent indefinite hangs

### API

#### Server Event: `auth:refresh`
```typescript
socket.emit('auth:refresh', { refreshToken: string }, callback);
```

#### Server Response Event: `auth:refreshed`
```typescript
socket.on('auth:refreshed', (tokens: TokenRefreshResponse) => {
  // tokens.accessToken, tokens.refreshToken, tokens.expiresIn
});
```

#### Client Method
```typescript
const tokens = await websocket.refreshTokens(refreshToken);
// or with custom timeout
const tokens = await websocket.refreshTokens(refreshToken, 15000);
```

## Testing

- Lint: Clean (backend and shared packages)
- TypeScript: Clean (backend and shared packages)
- CodeRabbit: All issues addressed (4 iterations)

## CodeRabbit Fixes Applied

1. **Zod Validation**: Added runtime validation for all WebSocket payloads
2. **Error Logging**: Non-token-refresh errors are now logged instead of silently dropped
3. **Guard Removal**: Removed WsAuthGuard to allow token refresh with expired access tokens
4. **Optional Chaining**: Removed unnecessary optional chaining after null checks

## Dependencies

- Added `zod` to `@socio/shared` package

## Status

**COMPLETED** - All acceptance criteria met. Ready for testing.

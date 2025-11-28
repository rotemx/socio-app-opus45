# SOCIO-203: Google OAuth Integration

## Summary

Implemented Google OAuth authentication for both mobile (ID token) and web (authorization code) flows. Users can sign in with Google, and the system automatically creates accounts or links to existing email accounts.

## Implementation Details

### Files Created

1. **`apps/backend/src/modules/auth/google-oauth.service.ts`**
   - Verifies Google ID tokens (mobile flow)
   - Exchanges authorization codes for tokens (web flow)
   - Extracts user info from Google APIs
   - Uses Google's tokeninfo and userinfo endpoints

2. **`apps/backend/src/modules/auth/google-oauth.service.spec.ts`**
   - 11 tests covering token verification, code exchange, and error handling

### Files Modified

1. **`apps/backend/src/modules/auth/auth.service.ts`**
   - Added `loginWithGoogleIdToken()` for mobile apps
   - Added `loginWithGoogleCode()` for web apps
   - Added `handleOAuthLogin()` for user creation/linking logic
   - Added `generateUsernameFromOAuth()` for username generation
   - Added `ensureUniqueUsername()` for collision handling

2. **`apps/backend/src/modules/auth/auth.controller.ts`**
   - Added `POST /auth/google/token` for ID token login
   - Added `POST /auth/google/code` for authorization code login
   - Updated generic `POST /auth/oauth/callback` to route to Google handler

3. **`apps/backend/src/modules/auth/auth.module.ts`**
   - Added GoogleOAuthService provider and export

4. **`apps/backend/src/modules/auth/dto/auth.dto.ts`**
   - Added `GoogleIdTokenDto` for mobile flow
   - Added `GoogleCodeDto` for web flow

5. **`apps/backend/src/modules/auth/index.ts`**
   - Exported GoogleOAuthService and GoogleUserInfo type

6. **`apps/backend/src/config/env.validation.ts`**
   - Added `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

7. **`apps/backend/src/config/config.service.ts`**
   - Added getters for Google OAuth configuration

8. **`apps/backend/.env.example`**
   - Added Google OAuth configuration section

## OAuth Flows

### Mobile Flow (ID Token)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Mobile App │────>│  Google SDK  │────>│  Google     │
│             │<────│              │<────│  Auth       │
└─────────────┘     └──────────────┘     └─────────────┘
       │
       │ ID Token
       ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Backend    │────>│  Google API  │     │  Database   │
│  /auth/     │     │  tokeninfo   │     │             │
│  google/    │<────│              │     │             │
│  token      │     └──────────────┘     │             │
│             │──────────────────────────>│  User       │
└─────────────┘     JWT Tokens           └─────────────┘
```

### Web Flow (Authorization Code)

```
┌─────────────┐     ┌──────────────┐
│  Web App    │────>│  Google      │
│  Redirect   │<────│  OAuth       │
└─────────────┘     └──────────────┘
       │ code + redirectUri
       ▼
┌─────────────┐     ┌──────────────┐
│  Backend    │────>│  Google API  │
│  /auth/     │     │  token +     │
│  google/    │<────│  userinfo    │
│  code       │     └──────────────┘
└─────────────┘     JWT Tokens
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/google/token | Public | Login with Google ID token (mobile) |
| POST | /auth/google/code | Public | Login with authorization code (web) |
| POST | /auth/oauth/callback | Public | Generic OAuth callback (routes by provider) |

### Request/Response Examples

**Mobile Login:**
```json
POST /auth/google/token
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

**Web Login:**
```json
POST /auth/google/code
{
  "code": "4/0AWgavdd...",
  "redirectUri": "https://app.socio.com/auth/callback"
}
```

## User Account Handling

### New User
- Creates account with Google profile info
- Username generated from first name or email prefix
- Collision handling with numeric suffixes (user, user1, user2...)

### Existing User (by OAuth ID)
- Logs in directly
- Updates avatar if not set

### Existing User (by email)
- Links Google account to existing user
- Preserves password authentication capability
- Updates verification status if Google verified email

## Configuration

Required environment variables:
```bash
# Google Cloud Console credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

## Security Features

- Token audience verification (checks client ID)
- Token expiration validation
- Email verification status tracking
- Automatic account linking by verified email

## Testing

```bash
# Run Google OAuth tests
cd apps/backend && npx jest src/modules/auth/google-oauth

# Tests: 11 passed
# Total auth tests: 78 passed
```

## CodeRabbit Review

### Issues Fixed
1. Changed `NotImplementedException` to `BadRequestException` for missing redirectUri
2. Added email validation before creating new OAuth users

### Acknowledged Suggestions (Future Improvements)
1. **Multi-provider support**: Consider userAuthProviders table for users with multiple auth methods
2. **Race condition in username**: Add transaction for username generation + user creation
3. **Service-level Zod validation**: Currently validated at controller level

## Future Improvements

1. **Apple Sign-In (SOCIO-204)**: Similar implementation pattern
2. **Multi-provider support**: Allow linking multiple OAuth providers
3. **Account unlinking**: Allow users to disconnect OAuth providers
4. **Profile sync**: Option to sync profile updates from Google

## Dependencies

No new dependencies - uses native `fetch` API for Google API calls.

## Completion Date

2025-11-28

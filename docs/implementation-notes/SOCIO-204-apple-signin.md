# SOCIO-204: Apple Sign-In Integration

## Summary

Implemented Apple Sign-In OAuth authentication for the Socio backend, supporting both mobile (Sign in with Apple SDK) and web (OAuth redirect) flows.

## Implementation Details

### Files Created

1. **`apps/backend/src/modules/auth/apple-oauth.service.ts`**
   - Full Apple Sign-In implementation
   - `verifyIdentityToken()` - Verifies Apple identity tokens from mobile SDK
   - `exchangeCodeForUserInfo()` - Exchanges authorization codes for tokens
   - `getApplePublicKeys()` - Fetches and caches Apple's public keys (24h TTL)
   - `verifyTokenSignature()` - Verifies JWT signature using Apple's RSA public key
   - `jwkToPem()` - Converts JWK to PEM format for crypto verification
   - `generateClientSecret()` - Generates ES256 JWT client secret for Apple API

### Files Modified

1. **`apps/backend/src/config/env.validation.ts`**
   - Added Apple Sign-In environment variables (APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY)

2. **`apps/backend/src/config/config.service.ts`**
   - Added getters for Apple Sign-In config

3. **`apps/backend/src/modules/auth/auth.service.ts`**
   - Added AppleOAuthService dependency injection
   - Created `OAuthUserInfo` type union for Google/Apple user info
   - Added `getOAuthPicture()` helper (Apple doesn't provide profile pictures)
   - Added `loginWithAppleIdToken()` and `loginWithAppleCode()` methods
   - Updated `handleOAuthLogin()` to support Apple provider

4. **`apps/backend/src/modules/auth/dto/auth.dto.ts`**
   - Added `AppleIdTokenDto` and `AppleCodeDto` for request validation
   - Added `appleUserSchema` for optional user info (name, email on first sign-in)

5. **`apps/backend/src/modules/auth/auth.controller.ts`**
   - Added `POST /auth/apple/token` endpoint (mobile flow)
   - Added `POST /auth/apple/code` endpoint (web flow)
   - Updated generic OAuth callback to support Apple

6. **`apps/backend/src/modules/auth/auth.module.ts`**
   - Added AppleOAuthService to providers and exports

7. **`apps/backend/src/modules/auth/index.ts`**
   - Added AppleOAuthService export

8. **`apps/backend/src/modules/auth/auth.service.spec.ts`**
   - Added AppleOAuthService mock for testing

9. **`apps/backend/.env.example`**
   - Added Apple Sign-In configuration section

## API Endpoints

### Mobile Flow (Identity Token)
```
POST /auth/apple/token
Headers: x-device-id (optional)
Body: {
  "identityToken": "eyJ...",
  "user": {  // Optional, only on first sign-in
    "name": { "firstName": "John", "lastName": "Doe" },
    "email": "john@example.com"
  }
}
Response: { "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }
```

### Web Flow (Authorization Code)
```
POST /auth/apple/code
Headers: x-device-id (optional)
Body: {
  "code": "authorization_code",
  "redirectUri": "https://app.socio.com/auth/callback",
  "user": { ... }  // Optional
}
Response: { "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }
```

## Apple Sign-In Specifics

1. **User Info Limitations**: Apple only provides user's name and email on FIRST sign-in. Subsequent logins only return the Apple user ID (sub claim).

2. **No Profile Pictures**: Unlike Google, Apple doesn't provide user profile pictures.

3. **Client Secret**: Apple requires a JWT signed with your private key (ES256) as the client_secret, not a static string.

4. **Token Verification**: Uses Apple's JWKS endpoint to fetch RSA public keys for JWT verification.

5. **Private Email Relay**: Users can choose to hide their email, receiving a private relay address.

## Environment Variables Required

```env
APPLE_CLIENT_ID=com.socio.app.signin    # Service ID
APPLE_TEAM_ID=XXXXXXXXXX                 # 10-character Team ID
APPLE_KEY_ID=XXXXXXXXXX                  # Key ID from Apple Developer
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

## Testing

- All 78 tests pass
- Unit tests cover auth service with mocked AppleOAuthService
- Manual testing requires Apple Developer account setup

## Security Considerations

1. Token signature verified using Apple's public keys
2. Token claims validated (issuer, audience, expiration)
3. Public keys cached with 24h TTL, fallback to cache on fetch failure
4. Private key properly parsed with escaped newline handling

## Status

**COMPLETED** - Ready for integration testing with Apple Developer credentials

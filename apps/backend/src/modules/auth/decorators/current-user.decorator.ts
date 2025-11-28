import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AccessTokenPayload } from '../types/token.types';

/**
 * Custom decorator to extract the current authenticated user from the request
 * Use with @UseGuards(AuthGuard('jwt')) to ensure the user is authenticated
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(AuthGuard('jwt'))
 * getProfile(@CurrentUser() user: AccessTokenPayload) {
 *   return { userId: user.sub };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AccessTokenPayload | undefined, ctx: ExecutionContext): AccessTokenPayload | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AccessTokenPayload;

    if (!user) {
      throw new UnauthorizedException('User not authenticated. Ensure @UseGuards(AuthGuard("jwt")) is applied.');
    }

    // If a specific property is requested, return just that property
    if (data) {
      return user[data];
    }

    return user;
  },
);

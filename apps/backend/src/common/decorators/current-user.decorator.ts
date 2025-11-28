import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { AccessTokenPayload } from '../../modules/auth';

/**
 * Custom decorator to extract authenticated user from HTTP request
 * Must be used with routes protected by JwtAuthGuard
 *
 * @example
 * ```typescript
 * // Get full user payload
 * @Get('profile')
 * getProfile(@CurrentUser() user: AccessTokenPayload) {
 *   return { userId: user.sub };
 * }
 *
 * // Get specific property
 * @Get('my-id')
 * getMyId(@CurrentUser('sub') userId: string) {
 *   return { userId };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AccessTokenPayload | undefined, ctx: ExecutionContext): AccessTokenPayload | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AccessTokenPayload | undefined;

    if (!user) {
      throw new UnauthorizedException('User not authenticated. Ensure route is protected by JwtAuthGuard.');
    }

    // If a specific property is requested, return only that
    if (data) {
      return user[data];
    }

    return user;
  },
);

/**
 * Custom decorator to extract authenticated user from WebSocket client
 * Must be used with gateways protected by WsAuthGuard
 *
 * @example
 * ```typescript
 * @SubscribeMessage('message:send')
 * handleMessage(
 *   @WsCurrentUser() user: AccessTokenPayload,
 *   @MessageBody() payload: SendMessageDto,
 * ) {
 *   // user.sub is the authenticated user ID
 * }
 * ```
 */
export const WsCurrentUser = createParamDecorator(
  (data: keyof AccessTokenPayload | undefined, ctx: ExecutionContext): AccessTokenPayload | unknown => {
    const client = ctx.switchToWs().getClient();
    const user = client.data?.user as AccessTokenPayload | undefined;

    if (!user) {
      throw new WsException({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated. Ensure gateway is protected by WsAuthGuard.',
      });
    }

    // If a specific property is requested, return only that
    if (data) {
      return user[data];
    }

    return user;
  },
);

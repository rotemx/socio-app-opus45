import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * Custom decorator to extract authenticated user from request
 * Usage: @CurrentUser() user: JwtPayload
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If a specific property is requested, return only that
    return data ? user?.[data] : user;
  }
);

/**
 * Custom decorator to extract authenticated user from WebSocket client
 * Usage: @WsCurrentUser() user: JwtPayload
 */
export const WsCurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const client = ctx.switchToWs().getClient();
    const user = client.data?.user;

    return data ? user?.[data] : user;
  }
);

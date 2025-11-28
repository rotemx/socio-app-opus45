import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { Reflector } from '@nestjs/core';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AuthService } from '../../modules/auth';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT Authentication Guard for HTTP routes
 * Verifies JWT token and attaches user to request
 *
 * Applied globally in AppModule - all routes require authentication unless marked @Public()
 *
 * @example
 * ```typescript
 * // Public route (no auth required)
 * @Public()
 * @Get('health')
 * healthCheck() {}
 *
 * // Protected route (auth required)
 * @Get('profile')
 * getProfile(@CurrentUser() user: AccessTokenPayload) {}
 * ```
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      // Verify token and get payload
      const payload = await this.authService.verifyAccessToken(token);

      // Attach user to request for use in controllers
      request.user = payload;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  /**
   * Extract JWT token from Authorization header
   * Expected format: "Bearer <token>"
   */
  private extractTokenFromHeader(request: { headers: { authorization?: string } }): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}

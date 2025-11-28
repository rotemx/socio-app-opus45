import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AccessTokenPayload } from '../../modules/auth';

/**
 * Role-Based Access Control Guard
 * Checks if authenticated user has required role(s) for a route
 *
 * Must be used AFTER JwtAuthGuard (user must already be authenticated)
 *
 * @example
 * ```typescript
 * // Single role required
 * @Roles('admin')
 * @UseGuards(RolesGuard)
 * @Delete(':id')
 * deleteUser(@Param('id') id: string) {}
 *
 * // Multiple roles (any of them)
 * @Roles('admin', 'moderator')
 * @UseGuards(RolesGuard)
 * @Put(':id/ban')
 * banUser(@Param('id') id: string) {}
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from request (attached by JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user as AccessTokenPayload | undefined;

    if (!user) {
      // 401 Unauthorized: user is not authenticated
      throw new UnauthorizedException('User not authenticated');
    }

    // Check if user has any of the required roles
    // Safely handle cases where roles might be malformed
    const userRoles = Array.isArray(user.roles) ? user.roles : [];
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}

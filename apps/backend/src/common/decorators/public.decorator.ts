import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark routes as public (no authentication required)
 * Usage: @Public() on controller or method
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

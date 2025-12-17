import {
  type PipeTransform,
  Injectable,
  type ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';

export interface ParseUuidPipeOptions {
  /** Error message to display when validation fails */
  errorMessage?: string;
  /** Whether to strictly validate UUID v4 only (default: false) */
  v4Only?: boolean;
  /** Whether the parameter is optional (default: false) */
  optional?: boolean;
}

/**
 * Validation pipe for UUID path parameters using Zod
 *
 * @example
 * ```typescript
 * // Basic usage - validates any UUID version
 * @Get(':id')
 * getRoom(@Param('id', ParseUuidPipe) id: string) {}
 *
 * // With custom error message
 * @Get(':id')
 * getRoom(@Param('id', new ParseUuidPipe({ errorMessage: 'Invalid room ID' })) id: string) {}
 *
 * // V4 only validation
 * @Get(':id')
 * getRoom(@Param('id', new ParseUuidPipe({ v4Only: true })) id: string) {}
 * ```
 */
@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string | undefined> {
  private readonly errorMessage: string;
  private readonly v4Only: boolean;
  private readonly optional: boolean;

  constructor(options: ParseUuidPipeOptions = {}) {
    this.errorMessage = options.errorMessage ?? 'Invalid UUID format';
    this.v4Only = options.v4Only ?? false;
    this.optional = options.optional ?? false;
  }

  transform(value: string | undefined | null, metadata: ArgumentMetadata): string | undefined {
    // Allow undefined/null for optional parameters
    if (this.optional && (value === undefined || value === null || value === '')) {
      return undefined;
    }

    // Check if value exists
    if (!value) {
      throw new BadRequestException(
        metadata.data ? `${metadata.data} is required` : 'Value is required'
      );
    }

    // Use Zod for UUID validation
    // Note: Zod's uuid() validates all standard UUID versions
    const schema = z.string().uuid({ message: this.errorMessage });

    const result = schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(
        metadata.data ? `${metadata.data}: ${this.errorMessage}` : this.errorMessage
      );
    }

    // Additional v4 check if required (Zod's uuid() accepts all versions)
    if (this.v4Only && value[14] !== '4') {
      throw new BadRequestException(
        metadata.data ? `${metadata.data}: Must be a UUID v4` : 'Must be a UUID v4'
      );
    }

    // Return lowercase UUID for consistency
    return result.data.toLowerCase();
  }
}

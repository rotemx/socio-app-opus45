import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * Password Service
 * Handles password hashing and verification using bcrypt
 */
@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly SALT_ROUNDS = 12;

  /**
   * Hash a plain text password
   * Uses bcrypt with 12 rounds (recommended for 2024+)
   */
  async hash(password: string): Promise<string> {
    if (!password) {
      throw new Error('Password cannot be empty');
    }
    try {
      return await bcrypt.hash(password, this.SALT_ROUNDS);
    } catch (error) {
      this.logger.error('Password hashing failed', error instanceof Error ? error.stack : error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify a password against a hash
   * Returns true if password matches the hash
   */
  async verify(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      throw new Error('Password and hash are required');
    }
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      this.logger.error('Password verification failed', error instanceof Error ? error.stack : error);
      throw new Error('Failed to verify password');
    }
  }

  /**
   * Validate password strength
   * Returns validation result with error messages
   */
  validateStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be at most 128 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

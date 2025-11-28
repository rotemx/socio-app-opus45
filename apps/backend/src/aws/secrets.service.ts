import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  UpdateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  type GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AppConfigService } from '../config';

/**
 * Parsed secret value type
 */
interface SecretValue {
  [key: string]: string | number | boolean | null;
}

/**
 * Secrets Manager service for retrieving and managing secrets
 *
 * Supports:
 * - Retrieving secrets by name/ARN
 * - Creating new secrets
 * - Updating existing secrets
 * - Deleting secrets
 * - Caching secrets in memory
 */
@Injectable()
export class SecretsService implements OnModuleInit {
  private readonly logger = new Logger(SecretsService.name);
  private client: SecretsManagerClient | null = null;
  private cache: Map<string, { value: SecretValue; expiresAt: number }> = new Map();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    if (this.config.awsRegion) {
      this.client = new SecretsManagerClient({
        region: this.config.awsRegion,
        credentials:
          this.config.awsAccessKeyId && this.config.awsSecretAccessKey
            ? {
                accessKeyId: this.config.awsAccessKeyId,
                secretAccessKey: this.config.awsSecretAccessKey,
              }
            : undefined, // Use IAM role if no explicit credentials
      });
      this.logger.log(`Secrets Manager client initialized for region: ${this.config.awsRegion}`);
    } else {
      this.logger.warn(
        'Secrets Manager not configured - AWS_REGION required. Secrets retrieval will be disabled.',
      );
    }
  }

  /**
   * Check if Secrets Manager is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Get a secret value by name or ARN
   *
   * Returns cached value if available and not expired
   */
  async getSecret(secretId: string, useCache: boolean = true): Promise<SecretValue | null> {
    this.ensureConfigured();

    // Check cache
    if (useCache) {
      const cached = this.cache.get(secretId);
      if (cached && cached.expiresAt > Date.now()) {
        this.logger.debug(`Cache hit for secret: ${this.maskSecretId(secretId)}`);
        return cached.value;
      }
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretId,
      });

      const response: GetSecretValueCommandOutput = await this.client!.send(command);

      let value: SecretValue;

      if (response.SecretString) {
        // Try to parse as JSON, fallback to raw string
        try {
          value = JSON.parse(response.SecretString) as SecretValue;
        } catch {
          value = { value: response.SecretString };
        }
      } else if (response.SecretBinary) {
        // Binary secret - decode as UTF-8 string
        const decoded = Buffer.from(response.SecretBinary).toString('utf-8');
        try {
          value = JSON.parse(decoded) as SecretValue;
        } catch {
          value = { value: decoded };
        }
      } else {
        this.logger.warn(`Secret ${this.maskSecretId(secretId)} has no value`);
        return null;
      }

      // Cache the value
      this.cache.set(secretId, {
        value,
        expiresAt: Date.now() + this.cacheTtlMs,
      });

      this.logger.debug(`Retrieved secret: ${this.maskSecretId(secretId)}`);

      return value;
    } catch (error) {
      if ((error as { name?: string }).name === 'ResourceNotFoundException') {
        this.logger.warn(`Secret not found: ${this.maskSecretId(secretId)}`);
        return null;
      }

      this.logger.error(`Failed to retrieve secret: ${this.maskSecretId(secretId)}`, error);
      throw error;
    }
  }

  /**
   * Get a specific field from a secret
   */
  async getSecretField(secretId: string, field: string): Promise<string | null> {
    const secret = await this.getSecret(secretId);

    if (!secret || !(field in secret)) {
      return null;
    }

    const value = secret[field];
    return value !== null ? String(value) : null;
  }

  /**
   * Get database credentials from Secrets Manager
   *
   * Expected secret format:
   * {
   *   "username": "...",
   *   "password": "...",
   *   "host": "...",
   *   "port": 5432,
   *   "database": "...",
   *   "url": "postgresql://..."
   * }
   */
  async getDatabaseCredentials(
    secretId: string,
  ): Promise<{ url: string; host: string; port: number; database: string; username: string } | null> {
    const secret = await this.getSecret(secretId);

    if (!secret) {
      return null;
    }

    // If URL is provided, use it directly
    if (secret.url && typeof secret.url === 'string') {
      return {
        url: secret.url,
        host: String(secret.host ?? ''),
        port: Number(secret.port ?? 5432),
        database: String(secret.database ?? ''),
        username: String(secret.username ?? ''),
      };
    }

    // Build URL from components
    const host = secret.host ?? 'localhost';
    const port = secret.port ?? 5432;
    const database = secret.database ?? 'postgres';
    const username = secret.username ?? 'postgres';
    const password = secret.password ?? '';

    // URL encode credentials to handle special characters safely
    const encodedUsername = encodeURIComponent(String(username));
    const encodedPassword = encodeURIComponent(String(password));

    const url = `postgresql://${encodedUsername}:${encodedPassword}@${host}:${port}/${database}`;

    return {
      url,
      host: String(host),
      port: Number(port),
      database: String(database),
      username: String(username),
    };
  }

  /**
   * Create a new secret
   */
  async createSecret(name: string, value: SecretValue, description?: string): Promise<string> {
    this.ensureConfigured();

    const command = new CreateSecretCommand({
      Name: name,
      Description: description,
      SecretString: JSON.stringify(value),
    });

    try {
      const response = await this.client!.send(command);

      this.logger.log(`Created secret: ${this.maskSecretId(name)}`);

      return response.ARN!;
    } catch (error) {
      this.logger.error(`Failed to create secret: ${this.maskSecretId(name)}`, error);
      throw error;
    }
  }

  /**
   * Update an existing secret
   */
  async updateSecret(secretId: string, value: SecretValue): Promise<void> {
    this.ensureConfigured();

    const command = new UpdateSecretCommand({
      SecretId: secretId,
      SecretString: JSON.stringify(value),
    });

    try {
      await this.client!.send(command);

      // Invalidate cache
      this.cache.delete(secretId);

      this.logger.log(`Updated secret: ${this.maskSecretId(secretId)}`);
    } catch (error) {
      this.logger.error(`Failed to update secret: ${this.maskSecretId(secretId)}`, error);
      throw error;
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(secretId: string, forceDelete: boolean = false): Promise<void> {
    this.ensureConfigured();

    const command = new DeleteSecretCommand({
      SecretId: secretId,
      ForceDeleteWithoutRecovery: forceDelete,
      RecoveryWindowInDays: forceDelete ? undefined : 7,
    });

    try {
      await this.client!.send(command);

      // Invalidate cache
      this.cache.delete(secretId);

      this.logger.log(`Deleted secret: ${this.maskSecretId(secretId)}`);
    } catch (error) {
      this.logger.error(`Failed to delete secret: ${this.maskSecretId(secretId)}`, error);
      throw error;
    }
  }

  /**
   * Check if a secret exists
   */
  async secretExists(secretId: string): Promise<boolean> {
    this.ensureConfigured();

    try {
      const command = new DescribeSecretCommand({
        SecretId: secretId,
      });

      await this.client!.send(command);
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'ResourceNotFoundException') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Clear the secret cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Secret cache cleared');
  }

  /**
   * Mask secret ID for logging (show only first/last 4 chars)
   */
  private maskSecretId(secretId: string): string {
    if (secretId.length <= 8) {
      return '****';
    }
    return `${secretId.slice(0, 4)}...${secretId.slice(-4)}`;
  }

  /**
   * Ensure Secrets Manager is configured
   */
  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('Secrets Manager is not configured. Set AWS_REGION to enable.');
    }
  }
}

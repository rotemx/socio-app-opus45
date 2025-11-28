import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type PutObjectCommandInput,
  type GetObjectCommandOutput,
  type ObjectCannedACL,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AppConfigService } from '../config';
import { z } from 'zod';

/**
 * Validation schema for upload options
 */
const UploadOptionsSchema = z.object({
  key: z.string().min(1),
  body: z.union([z.instanceof(Buffer), z.instanceof(Uint8Array), z.string()]),
  contentType: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  acl: z.enum(['private', 'public-read']).optional(),
});

type UploadOptions = z.infer<typeof UploadOptionsSchema>;

/**
 * Validation schema for presigned URL options
 */
const PresignedUrlOptionsSchema = z.object({
  key: z.string().min(1),
  expiresIn: z.number().min(1).max(604800).default(3600), // Max 7 days
  contentType: z.string().optional(),
});

type PresignedUrlOptions = z.infer<typeof PresignedUrlOptionsSchema>;

/**
 * File categories for organized storage
 */
export enum FileCategory {
  IMAGES = 'images',
  VOICE = 'voice',
  AVATARS = 'avatars',
  ATTACHMENTS = 'attachments',
}

/**
 * S3 service for file uploads, downloads, and presigned URL generation
 *
 * Supports:
 * - Direct file uploads
 * - Presigned URLs for client-side uploads
 * - File downloads
 * - File deletion
 * - Object metadata retrieval
 */
@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private client: S3Client | null = null;
  private bucket: string | null = null;

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    if (this.config.awsS3Bucket && this.config.awsRegion) {
      this.client = new S3Client({
        region: this.config.awsRegion,
        credentials:
          this.config.awsAccessKeyId && this.config.awsSecretAccessKey
            ? {
                accessKeyId: this.config.awsAccessKeyId,
                secretAccessKey: this.config.awsSecretAccessKey,
              }
            : undefined, // Use IAM role if no explicit credentials
      });
      this.bucket = this.config.awsS3Bucket;
      this.logger.log(`S3 client initialized for bucket: ${this.bucket}`);
    } else {
      this.logger.warn(
        'S3 not configured - file uploads will be disabled. Set AWS_S3_BUCKET and AWS_REGION to enable.',
      );
    }
  }

  /**
   * Check if S3 is configured and available
   */
  isConfigured(): boolean {
    return this.client !== null && this.bucket !== null;
  }

  /**
   * Generate a storage key with category prefix
   */
  generateKey(category: FileCategory, filename: string, userId?: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');

    if (userId) {
      return `${category}/${userId}/${timestamp}-${sanitizedFilename}`;
    }

    return `${category}/${timestamp}-${sanitizedFilename}`;
  }

  /**
   * Upload a file to S3
   */
  async upload(options: UploadOptions): Promise<{ key: string; url: string }> {
    this.ensureConfigured();

    const validated = UploadOptionsSchema.parse(options);

    const params: PutObjectCommandInput = {
      Bucket: this.bucket!,
      Key: validated.key,
      Body: validated.body,
      ContentType: validated.contentType,
      Metadata: validated.metadata,
      ACL: validated.acl as ObjectCannedACL | undefined,
    };

    try {
      await this.client!.send(new PutObjectCommand(params));

      const url = this.getPublicUrl(validated.key);

      this.logger.debug(`File uploaded: ${validated.key}`);

      return { key: validated.key, url };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${validated.key}`, error);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for client-side upload
   */
  async getUploadUrl(options: PresignedUrlOptions): Promise<{ uploadUrl: string; key: string }> {
    this.ensureConfigured();

    const validated = PresignedUrlOptionsSchema.parse(options);

    const command = new PutObjectCommand({
      Bucket: this.bucket!,
      Key: validated.key,
      ContentType: validated.contentType,
    });

    try {
      const uploadUrl = await getSignedUrl(this.client!, command, {
        expiresIn: validated.expiresIn,
      });

      this.logger.debug(`Generated upload URL for: ${validated.key}`);

      return { uploadUrl, key: validated.key };
    } catch (error) {
      this.logger.error(`Failed to generate upload URL: ${validated.key}`, error);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for downloading a file
   */
  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    this.ensureConfigured();

    const command = new GetObjectCommand({
      Bucket: this.bucket!,
      Key: key,
    });

    try {
      const downloadUrl = await getSignedUrl(this.client!, command, {
        expiresIn,
      });

      this.logger.debug(`Generated download URL for: ${key}`);

      return downloadUrl;
    } catch (error) {
      this.logger.error(`Failed to generate download URL: ${key}`, error);
      throw error;
    }
  }

  /**
   * Download a file from S3
   */
  async download(key: string): Promise<GetObjectCommandOutput> {
    this.ensureConfigured();

    const command = new GetObjectCommand({
      Bucket: this.bucket!,
      Key: key,
    });

    try {
      const response = await this.client!.send(command);

      this.logger.debug(`File downloaded: ${key}`);

      return response;
    } catch (error) {
      this.logger.error(`Failed to download file: ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete a file from S3
   */
  async delete(key: string): Promise<void> {
    this.ensureConfigured();

    const command = new DeleteObjectCommand({
      Bucket: this.bucket!,
      Key: key,
    });

    try {
      await this.client!.send(command);

      this.logger.debug(`File deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${key}`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists in S3
   */
  async exists(key: string): Promise<boolean> {
    this.ensureConfigured();

    const command = new HeadObjectCommand({
      Bucket: this.bucket!,
      Key: key,
    });

    try {
      await this.client!.send(command);
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List files with a given prefix
   */
  async list(
    prefix: string,
    maxKeys: number = 100,
  ): Promise<{ key: string; size: number; lastModified: Date }[]> {
    this.ensureConfigured();

    const command = new ListObjectsV2Command({
      Bucket: this.bucket!,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    try {
      const response = await this.client!.send(command);

      return (response.Contents ?? []).map((obj: { Key?: string; Size?: number; LastModified?: Date }) => ({
        key: obj.Key!,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(),
      }));
    } catch (error) {
      this.logger.error(`Failed to list files with prefix: ${prefix}`, error);
      throw error;
    }
  }

  /**
   * Get the public URL for a file (via CloudFront if configured)
   */
  getPublicUrl(key: string): string {
    const cloudfrontUrl = this.config.awsCloudfrontUrl;

    if (cloudfrontUrl) {
      return `${cloudfrontUrl}/${key}`;
    }

    // Fallback to S3 URL
    return `https://${this.bucket}.s3.${this.config.awsRegion}.amazonaws.com/${key}`;
  }

  /**
   * Ensure S3 is configured before operations
   */
  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(
        'S3 is not configured. Set AWS_S3_BUCKET, AWS_REGION, and credentials to enable file uploads.',
      );
    }
  }
}

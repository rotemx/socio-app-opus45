import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { SecretsService } from './secrets.service';

/**
 * AWS module providing S3 and Secrets Manager services
 *
 * This module is global, so services are available throughout the application
 * without needing to import the module in each feature module.
 */
@Global()
@Module({
  providers: [S3Service, SecretsService],
  exports: [S3Service, SecretsService],
})
export class AwsModule {}

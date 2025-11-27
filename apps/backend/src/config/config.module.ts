import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './config.service';
import { validateEnv } from './env.validation';

/**
 * Global configuration module
 * Provides type-safe access to environment variables
 */
@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useFactory: () => {
        const envConfig = validateEnv(process.env);
        return new AppConfigService(envConfig);
      },
    },
  ],
  exports: [AppConfigService],
})
export class ConfigModule {}

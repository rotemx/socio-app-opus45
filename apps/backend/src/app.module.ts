import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Infrastructure
import { ConfigModule, AppConfigService } from './config';
import { DatabaseModule } from './database';
import { AwsModule } from './aws';
import { RedisModule } from './redis';
import { ScheduleModule } from '@nestjs/schedule';

// Feature modules
import { AuthModule } from './modules/auth';
import { UsersModule } from './modules/users';
import { RoomsModule } from './modules/rooms';
import { MessagesModule } from './modules/messages';
import { PresenceModule } from './modules/presence';
import { ChatModule } from './modules/chat/chat.module';

// Guards
import { JwtAuthGuard } from './common/guards';

// Interceptors
import {
  LoggingInterceptor,
  TransformInterceptor,
  TimeoutInterceptor,
} from './common/interceptors';

// Filters
import { HttpExceptionFilter } from './common/filters';

@Module({
  imports: [
    // Global configuration
    ConfigModule,
    DatabaseModule,
    AwsModule,

    // Redis for pub/sub and caching
    RedisModule.forRootAsync({
      useFactory: (configService: AppConfigService) => ({n        url: configService.redisUrl || 'redis://localhost:6379',
      }),
      inject: [AppConfigService],
    }),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    UsersModule,
    RoomsModule,
    MessagesModule,
    PresenceModule,
    ChatModule,
  ],
  providers: [
    // Global JWT auth guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Global response transform interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Global timeout interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    // Global HTTP exception filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}

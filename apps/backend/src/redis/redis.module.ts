import {
  Module,
  Global,
  type DynamicModule,
  Logger,
  type OnApplicationShutdown,
  type InjectionToken,
} from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';
import { RedisService } from './redis.service';
import { REDIS_CLIENT, REDIS_PUBLISHER, REDIS_SUBSCRIBER } from './redis.constants';

/**
 * Redis module configuration options
 */
export interface RedisModuleOptions {
  /** Redis connection URL (e.g., redis://localhost:6379) */
  url?: string;
  /** Redis host (default: localhost) */
  host?: string;
  /** Redis port (default: 6379) */
  port?: number;
  /** Redis password */
  password?: string;
  /** Redis database number (default: 0) */
  db?: number;
  /** Key prefix for all keys */
  keyPrefix?: string;
  /** Enable TLS */
  tls?: boolean;
  /** Connection retry strategy */
  retryStrategy?: (times: number) => number | null;
  /** Max reconnection attempts (default: 10) */
  maxRetriesPerRequest?: number;
}

const logger = new Logger('RedisModule');

/**
 * Default retry strategy with exponential backoff
 */
const defaultRetryStrategy = (times: number): number | null => {
  if (times > 10) {
    logger.error('Max Redis reconnection attempts reached');
    return null;
  }
  const delay = Math.min(times * 100, 3000);
  logger.warn(`Retrying Redis connection (attempt ${times}, delay ${delay}ms)`);
  return delay;
};

/**
 * Create Redis client from options
 */
function createRedisClient(options: RedisModuleOptions): Redis {
  const redisOptions: RedisOptions = {
    host: options.host || 'localhost',
    port: options.port || 6379,
    password: options.password,
    db: options.db || 0,
    keyPrefix: options.keyPrefix,
    retryStrategy: options.retryStrategy || defaultRetryStrategy,
    maxRetriesPerRequest: options.maxRetriesPerRequest ?? 10,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  // Enable TLS if requested
  if (options.tls) {
    redisOptions.tls = {};
  }

  if (options.url) {
    return new Redis(options.url, redisOptions);
  }

  return new Redis(redisOptions);
}

/**
 * Redis Module
 * Provides Redis client and pub/sub functionality
 *
 * @example
 * ```typescript
 * // In app.module.ts
 * import { RedisModule } from './redis';
 *
 * @Module({
 *   imports: [
 *     RedisModule.forRoot({
 *       url: process.env.REDIS_URL,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 *
 * // In a service
 * import { RedisService } from './redis';
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly redis: RedisService) {}
 *
 *   async doSomething() {
 *     await this.redis.set('key', 'value', 60);
 *     const value = await this.redis.get('key');
 *   }
 * }
 * ```
 */
@Global()
@Module({})
export class RedisModule implements OnApplicationShutdown {
  private static client: Redis;
  private static publisher: Redis;
  private static subscriber: Redis;

  /**
   * Configure Redis module with static options
   */
  static forRoot(options: RedisModuleOptions = {}): DynamicModule {
    const clientProvider = {
      provide: REDIS_CLIENT,
      useFactory: (): Redis => {
        const client = createRedisClient(options);

        client.on('connect', () => {
          logger.log('Redis client connected');
        });

        client.on('ready', () => {
          logger.log('Redis client ready');
        });

        client.on('error', (error) => {
          logger.error('Redis client error:', error);
        });

        client.on('close', () => {
          logger.warn('Redis connection closed');
        });

        client.on('reconnecting', () => {
          logger.log('Redis reconnecting...');
        });

        RedisModule.client = client;
        return client;
      },
    };

    const publisherProvider = {
      provide: REDIS_PUBLISHER,
      useFactory: (): Redis => {
        const publisher = createRedisClient(options);
        publisher.on('error', (error) => {
          logger.error('Redis publisher error:', error);
        });
        RedisModule.publisher = publisher;
        return publisher;
      },
    };

    const subscriberProvider = {
      provide: REDIS_SUBSCRIBER,
      useFactory: (): Redis => {
        const subscriber = createRedisClient(options);
        subscriber.on('error', (error) => {
          logger.error('Redis subscriber error:', error);
        });
        RedisModule.subscriber = subscriber;
        return subscriber;
      },
    };

    return {
      module: RedisModule,
      providers: [clientProvider, publisherProvider, subscriberProvider, RedisService],
      exports: [REDIS_CLIENT, REDIS_PUBLISHER, REDIS_SUBSCRIBER, RedisService],
    };
  }

  /**
   * Configure Redis module with async options
   */
  static forRootAsync<T extends InjectionToken[]>(optionsFactory: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (...args: any[]) => Promise<RedisModuleOptions> | RedisModuleOptions;
    inject?: T;
  }): DynamicModule {
    const clientProvider = {
      provide: REDIS_CLIENT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useFactory: async (...args: any[]): Promise<Redis> => {
        const options = await optionsFactory.useFactory(...args);
        const client = createRedisClient(options);

        client.on('connect', () => {
          logger.log('Redis client connected');
        });

        client.on('ready', () => {
          logger.log('Redis client ready');
        });

        client.on('error', (error) => {
          logger.error('Redis client error:', error);
        });

        RedisModule.client = client;
        return client;
      },
      inject: optionsFactory.inject || [],
    };

    const publisherProvider = {
      provide: REDIS_PUBLISHER,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useFactory: async (...args: any[]): Promise<Redis> => {
        const options = await optionsFactory.useFactory(...args);
        const publisher = createRedisClient(options);
        publisher.on('error', (error) => {
          logger.error('Redis publisher error:', error);
        });
        RedisModule.publisher = publisher;
        return publisher;
      },
      inject: optionsFactory.inject || [],
    };

    const subscriberProvider = {
      provide: REDIS_SUBSCRIBER,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useFactory: async (...args: any[]): Promise<Redis> => {
        const options = await optionsFactory.useFactory(...args);
        const subscriber = createRedisClient(options);
        subscriber.on('error', (error) => {
          logger.error('Redis subscriber error:', error);
        });
        RedisModule.subscriber = subscriber;
        return subscriber;
      },
      inject: optionsFactory.inject || [],
    };

    return {
      module: RedisModule,
      providers: [clientProvider, publisherProvider, subscriberProvider, RedisService],
      exports: [REDIS_CLIENT, REDIS_PUBLISHER, REDIS_SUBSCRIBER, RedisService],
    };
  }

  /**
   * Cleanup on application shutdown
   */
  async onApplicationShutdown(): Promise<void> {
    logger.log('Shutting down Redis connections...');

    const closePromises: Promise<void>[] = [];

    if (RedisModule.client) {
      closePromises.push(
        RedisModule.client.quit().then(() => {
          logger.log('Redis client closed');
        })
      );
    }

    if (RedisModule.publisher) {
      closePromises.push(
        RedisModule.publisher.quit().then(() => {
          logger.log('Redis publisher closed');
        })
      );
    }

    if (RedisModule.subscriber) {
      closePromises.push(
        RedisModule.subscriber.quit().then(() => {
          logger.log('Redis subscriber closed');
        })
      );
    }

    await Promise.allSettled(closePromises);
    logger.log('Redis shutdown complete');
  }
}

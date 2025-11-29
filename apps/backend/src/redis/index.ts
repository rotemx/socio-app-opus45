export { RedisModule, type RedisModuleOptions } from './redis.module';
export {
  RedisService,
  type PresenceStatus,
  type RedisPresenceData,
  type RoomPresenceEntry,
  type SetUserOnlineInput,
  type RateLimitResult,
} from './redis.service';
export {
  REDIS_CLIENT,
  REDIS_PUBLISHER,
  REDIS_SUBSCRIBER,
  REDIS_KEYS,
  REDIS_CHANNELS,
  REDIS_TTL,
} from './redis.constants';

/**
 * Redis module constants
 */

/**
 * Injection token for Redis client
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Injection token for Redis publisher client (for pub/sub)
 */
export const REDIS_PUBLISHER = Symbol('REDIS_PUBLISHER');

/**
 * Injection token for Redis subscriber client (for pub/sub)
 */
export const REDIS_SUBSCRIBER = Symbol('REDIS_SUBSCRIBER');

/**
 * Redis key prefixes for different data types
 */
export const REDIS_KEYS = {
  /** Presence data */
  PRESENCE: 'presence',
  /** Room-specific presence (sorted set with timestamp scores) */
  ROOM_PRESENCE: 'room_presence',
  /** User session data */
  SESSION: 'session',
  /** Rate limiting */
  RATE_LIMIT: 'rate_limit',
  /** Room data cache */
  ROOM: 'room',
  /** User data cache */
  USER: 'user',
  /** Socket.io adapter */
  SOCKET_IO: 'socket.io',
  /** Disconnect grace period tracking */
  DISCONNECT_GRACE: 'disconnect_grace',
  /** Typing indicators (ephemeral, per room) */
  TYPING: 'typing',
} as const;

/**
 * Redis pub/sub channels
 */
export const REDIS_CHANNELS = {
  /** Presence updates */
  PRESENCE_UPDATE: 'presence:update',
  /** User online/offline events */
  USER_STATUS: 'user:status',
  /** Room events (join, leave, update) */
  ROOM_EVENT: 'room:event',
  /** Message events */
  MESSAGE_EVENT: 'message:event',
  /** Typing indicator updates */
  TYPING_UPDATE: 'typing:update',
  /** Read receipt updates */
  READ_RECEIPT_UPDATE: 'read_receipt:update',
} as const;

/**
 * Default TTL values in seconds
 */
export const REDIS_TTL = {
  /** Presence heartbeat TTL (5 minutes) */
  PRESENCE: 5 * 60,
  /** Session TTL (7 days) */
  SESSION: 7 * 24 * 60 * 60,
  /** Rate limit window (1 minute) */
  RATE_LIMIT_WINDOW: 60,
  /** Disconnect grace period TTL (30 seconds) */
  DISCONNECT_GRACE: 30,
  /** Room cache TTL (5 minutes) */
  ROOM_CACHE: 5 * 60,
  /** User cache TTL (5 minutes) */
  USER_CACHE: 5 * 60,
  /** Typing indicator TTL (5 seconds for auto-expiry) */
  TYPING: 5,
} as const;

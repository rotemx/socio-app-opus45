import { Test, type TestingModule } from '@nestjs/testing';
import { type Type, type ModuleMetadata } from '@nestjs/common';

/**
 * Create a testing module with common providers mocked
 */
export async function createTestingModule(metadata: ModuleMetadata): Promise<TestingModule> {
  return Test.createTestingModule(metadata).compile();
}

/**
 * Mock model operations type
 */
interface MockModelOperations {
  findUnique: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  count?: jest.Mock;
  updateMany?: jest.Mock;
  upsert?: jest.Mock;
  deleteMany?: jest.Mock;
  findFirst?: jest.Mock;
}

/**
 * Mock PrismaService type
 */
export interface MockPrismaService {
  user: MockModelOperations;
  chatRoom: MockModelOperations;
  roomMember: MockModelOperations;
  message: MockModelOperations;
  readReceipt: MockModelOperations;
  userPresence: MockModelOperations;
  refreshToken: MockModelOperations;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $transaction: jest.Mock;
}

/**
 * Create a mock PrismaService
 */
export function createMockPrismaService(): MockPrismaService {
  return {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    chatRoom: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    roomMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    message: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    readReceipt: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    userPresence: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn((fn: (prisma: unknown) => Promise<unknown>) =>
      fn(createMockPrismaService())
    ),
  };
}

/**
 * Create a mock user for testing
 */
export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    displayName: 'Test User',
    phoneNumber: null,
    avatarUrl: null,
    authProvider: 'EMAIL',
    providerId: null,
    passwordHash: 'hashed-password',
    isVerified: true,
    isActive: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface MockUser {
  id: string;
  email: string | null;
  username: string;
  displayName: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  authProvider: string;
  providerId: string | null;
  passwordHash: string | null;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a mock JWT payload
 */
export function createMockJwtPayload(overrides?: Partial<JwtPayload>): JwtPayload {
  return {
    sub: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
    ...overrides,
  };
}

interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  iat: number;
  exp: number;
}

/**
 * Create a mock chat room
 */
export function createMockChatRoom(overrides?: Partial<MockChatRoom>): MockChatRoom {
  return {
    id: 'test-room-id',
    name: 'Test Room',
    description: 'A test chat room',
    creatorId: 'test-user-id',
    isPrivate: false,
    maxMembers: 100,
    latitude: 32.0853,
    longitude: 34.7818,
    locationPrecision: 'EXACT',
    discoveryRadius: 5.0,
    avatarUrl: null,
    tags: ['test'],
    lastActivityAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface MockChatRoom {
  id: string;
  name: string;
  description: string | null;
  creatorId: string;
  isPrivate: boolean;
  maxMembers: number;
  latitude: number | null;
  longitude: number | null;
  locationPrecision: string;
  discoveryRadius: number;
  avatarUrl: string | null;
  tags: string[];
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a mock message
 */
export function createMockMessage(overrides?: Partial<MockMessage>): MockMessage {
  return {
    id: 'test-message-id',
    roomId: 'test-room-id',
    senderId: 'test-user-id',
    content: 'Test message content',
    contentType: 'TEXT',
    replyToId: null,
    metadata: {},
    isEdited: false,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface MockMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  contentType: string;
  replyToId: string | null;
  metadata: Record<string, unknown>;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Helper to get a service from a testing module
 */
export function getService<T>(module: TestingModule, service: Type<T>): T {
  return module.get<T>(service);
}

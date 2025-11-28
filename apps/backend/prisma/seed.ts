import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed the database with initial data for development
 */
async function main() {
  console.log('🌱 Starting database seed...');

  // Create test users
  console.log('Creating test users...');

  const user1 = await prisma.user.upsert({
    where: { username: 'testuser1' },
    update: {},
    create: {
      username: 'testuser1',
      email: 'test1@example.com',
      displayName: 'Test User 1',
      passwordHash: '$2b$10$EIXsv2K0XMQZ6qJ8KgX9AuJZ8vXrQr5K5Q5ZQZQZQZQZQZQZQZQZQZQZ', // password123 for dev
      isVerified: true,
      currentLocation: {
        type: 'Point',
        coordinates: [34.7818, 32.0853], // Tel Aviv
        latitude: 32.0853,
        longitude: 34.7818,
      },
      settings: {
        notifications: true,
        locationSharing: true,
        discoverable: true,
      },
    },
  });

  const user2 = await prisma.user.upsert({
    where: { username: 'testuser2' },
    update: {},
    create: {
      username: 'testuser2',
      email: 'test2@example.com',
      displayName: 'Test User 2',
      passwordHash: '$2b$10$EIXsv2K0XMQZ6qJ8KgX9AuJZ8vXrQr5K5Q5ZQZQZQZQZQZQZQZQZQZQZ', // password123 for dev
      isVerified: true,
      currentLocation: {
        type: 'Point',
        coordinates: [34.775, 32.08], // Near Tel Aviv
        latitude: 32.08,
        longitude: 34.775,
      },
      settings: {
        notifications: true,
        locationSharing: true,
        discoverable: true,
      },
    },
  });

  const user3 = await prisma.user.upsert({
    where: { username: 'testuser3' },
    update: {},
    create: {
      username: 'testuser3',
      email: 'test3@example.com',
      displayName: 'Test User 3',
      passwordHash: '$2b$10$EIXsv2K0XMQZ6qJ8KgX9AuJZ8vXrQr5K5Q5ZQZQZQZQZQZQZQZQZQZQZ', // password123 for dev
      isVerified: true,
      currentLocation: {
        type: 'Point',
        coordinates: [34.85, 32.1], // Herzliya area
        latitude: 32.1,
        longitude: 34.85,
      },
      settings: {
        notifications: true,
        locationSharing: false,
        discoverable: false,
      },
    },
  });

  console.log(`Created users: ${user1.username}, ${user2.username}, ${user3.username}`);

  // Create test chat rooms
  console.log('Creating test chat rooms...');

  const room1 = await prisma.chatRoom.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Tel Aviv Pride',
      description: 'A welcoming space for the Tel Aviv LGBT community',
      creatorId: user1.id,
      location: {
        type: 'Point',
        coordinates: [34.7818, 32.0853],
        latitude: 32.0853,
        longitude: 34.7818,
      },
      radiusMeters: 5000,
      tags: ['pride', 'community', 'social', 'tel-aviv'],
      isPublic: true,
      isActive: true,
      maxMembers: 500,
      settings: {
        allowMedia: true,
        requireLocationCheck: true,
        voiceEnabled: true,
        videoEnabled: true,
      },
    },
  });

  const room2 = await prisma.chatRoom.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Rothschild Hangout',
      description: 'Chat with locals around Rothschild Boulevard',
      creatorId: user1.id,
      location: {
        type: 'Point',
        coordinates: [34.775, 32.065],
        latitude: 32.065,
        longitude: 34.775,
      },
      radiusMeters: 1000,
      tags: ['hangout', 'rothschild', 'casual'],
      isPublic: true,
      isActive: true,
      maxMembers: 100,
      settings: {
        allowMedia: true,
        requireLocationCheck: false,
        voiceEnabled: true,
        videoEnabled: false,
      },
    },
  });

  const room3 = await prisma.chatRoom.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Private Group',
      description: 'A private room for close friends',
      creatorId: user2.id,
      location: {
        type: 'Point',
        coordinates: [34.79, 32.09],
        latitude: 32.09,
        longitude: 34.79,
      },
      radiusMeters: 500,
      tags: ['private', 'friends'],
      isPublic: false,
      isActive: true,
      maxMembers: 20,
      settings: {
        allowMedia: true,
        requireLocationCheck: true,
        voiceEnabled: true,
        videoEnabled: true,
      },
    },
  });

  console.log(`Created rooms: ${room1.name}, ${room2.name}, ${room3.name}`);

  // Add members to rooms
  console.log('Adding room members...');

  // User 1 is creator of room1 and room2
  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room1.id, userId: user1.id } },
    update: {},
    create: {
      roomId: room1.id,
      userId: user1.id,
      role: 'CREATOR',
      joinLocation: {
        type: 'Point',
        coordinates: [34.7818, 32.0853],
        latitude: 32.0853,
        longitude: 34.7818,
      },
    },
  });

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room2.id, userId: user1.id } },
    update: {},
    create: {
      roomId: room2.id,
      userId: user1.id,
      role: 'CREATOR',
      joinLocation: {
        type: 'Point',
        coordinates: [34.775, 32.065],
        latitude: 32.065,
        longitude: 34.775,
      },
    },
  });

  // User 2 is creator of room3 and member of room1
  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room3.id, userId: user2.id } },
    update: {},
    create: {
      roomId: room3.id,
      userId: user2.id,
      role: 'CREATOR',
      joinLocation: {
        type: 'Point',
        coordinates: [34.79, 32.09],
        latitude: 32.09,
        longitude: 34.79,
      },
    },
  });

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room1.id, userId: user2.id } },
    update: {},
    create: {
      roomId: room1.id,
      userId: user2.id,
      role: 'MEMBER',
      joinLocation: {
        type: 'Point',
        coordinates: [34.78, 32.085],
        latitude: 32.085,
        longitude: 34.78,
      },
    },
  });

  // User 3 is member of room1
  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room1.id, userId: user3.id } },
    update: {},
    create: {
      roomId: room1.id,
      userId: user3.id,
      role: 'MEMBER',
      joinLocation: {
        type: 'Point',
        coordinates: [34.85, 32.1],
        latitude: 32.1,
        longitude: 34.85,
      },
    },
  });

  console.log('Room members added');

  // Create some test messages
  console.log('Creating test messages...');

  await prisma.message.createMany({
    data: [
      {
        roomId: room1.id,
        senderId: user1.id,
        content: 'Welcome to Tel Aviv Pride! 🏳️‍🌈',
        contentType: 'TEXT',
      },
      {
        roomId: room1.id,
        senderId: user2.id,
        content: 'Hey everyone! Excited to be here!',
        contentType: 'TEXT',
      },
      {
        roomId: room1.id,
        senderId: user3.id,
        content: 'Hello from Herzliya!',
        contentType: 'TEXT',
      },
      {
        roomId: room2.id,
        senderId: user1.id,
        content: 'Anyone at Rothschild right now?',
        contentType: 'TEXT',
      },
    ],
    skipDuplicates: true,
  });

  console.log('Test messages created');

  // Create user presence records
  console.log('Creating presence records...');

  await prisma.userPresence.upsert({
    where: { userId_deviceId: { userId: user1.id, deviceId: 'default' } },
    update: { status: 'ONLINE' },
    create: {
      userId: user1.id,
      deviceId: 'default',
      status: 'ONLINE',
    },
  });

  await prisma.userPresence.upsert({
    where: { userId_deviceId: { userId: user2.id, deviceId: 'default' } },
    update: { status: 'AWAY' },
    create: {
      userId: user2.id,
      deviceId: 'default',
      status: 'AWAY',
    },
  });

  await prisma.userPresence.upsert({
    where: { userId_deviceId: { userId: user3.id, deviceId: 'default' } },
    update: { status: 'OFFLINE' },
    create: {
      userId: user3.id,
      deviceId: 'default',
      status: 'OFFLINE',
    },
  });

  console.log('Presence records created');

  console.log('');
  console.log('✅ Database seeding completed!');
  console.log('');
  console.log('Test accounts:');
  console.log('  - testuser1 (test1@example.com)');
  console.log('  - testuser2 (test2@example.com)');
  console.log('  - testuser3 (test3@example.com)');
  console.log('');
  console.log('Test rooms:');
  console.log('  - Tel Aviv Pride (public, 5km radius)');
  console.log('  - Rothschild Hangout (public, 1km radius)');
  console.log('  - Private Group (private, 500m radius)');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

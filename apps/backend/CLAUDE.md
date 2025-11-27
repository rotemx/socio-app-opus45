# Socio Backend

## Overview

NestJS backend service providing REST API and WebSocket gateway for the Socio chat application.

## Tech Stack

- NestJS 10.x with TypeScript
- Socket.io for WebSocket
- Prisma ORM with PostgreSQL/PostGIS
- Redis for caching, pub/sub, and rate limiting
- BullMQ for background jobs

## Commands

```bash
# Development
pnpm dev

# Production build
pnpm build
pnpm start:prod

# Database
pnpm db:migrate    # Run migrations
pnpm db:generate   # Generate Prisma client
pnpm db:push       # Push schema changes

# Testing
pnpm test          # Run tests
pnpm test:cov      # With coverage
```

## Module Structure

```
src/
├── modules/
│   ├── auth/         # Authentication (JWT, OAuth, Phone)
│   ├── chat/         # WebSocket gateway for messaging
│   ├── rooms/        # Room CRUD and discovery
│   ├── messages/     # Message persistence
│   ├── users/        # User management
│   └── presence/     # Online status tracking
├── common/
│   ├── guards/       # Auth guards
│   ├── interceptors/ # Logging, caching
│   └── decorators/   # Custom decorators
└── config/           # App configuration
```

## Key Patterns

### WebSocket Gateway

```typescript
@WebSocketGateway({ cors: true })
export class ChatGateway {
  @SubscribeMessage('send_message')
  handleMessage(@MessageBody() data: SendMessageDto) {
    // Handle message
  }
}
```

### Service Pattern

```typescript
@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async findNearby(lat: number, lng: number, radiusKm: number) {
    // Use PostGIS for spatial queries
  }
}
```

## Database

- PostgreSQL 16 with PostGIS 3.4+ for geospatial queries
- Prisma schema in `prisma/schema.prisma`
- Migrations in `prisma/migrations/`

## Environment Variables

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
JWT_EXPIRY=15m
```

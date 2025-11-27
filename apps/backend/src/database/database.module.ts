import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SpatialService } from './spatial.service';

/**
 * Global database module
 * Provides PrismaService and SpatialService for database operations across all modules
 */
@Global()
@Module({
  providers: [PrismaService, SpatialService],
  exports: [PrismaService, SpatialService],
})
export class DatabaseModule {}

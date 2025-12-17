import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);

    // Environment configuration
    const isProduction = process.env.NODE_ENV === 'production';
    const corsOrigin = process.env.CORS_ORIGIN;

    // SECURITY: In production, CORS_ORIGIN must be explicitly configured
    if (isProduction && !corsOrigin) {
      throw new Error(
        'CORS_ORIGIN must be explicitly configured in production. ' +
          'Set it to your frontend domain(s), e.g., "https://app.socio.com"'
      );
    }

    // Security headers with enhanced configuration
    // CSP configuration - can be customized via environment variables
    const cspImgSrc = process.env.CSP_IMG_SRC
      ? process.env.CSP_IMG_SRC.split(',')
          .map((src) => src.trim())
          .filter((src) => src.length > 0)
      : ["'self'", 'data:'];

    // Build CSP directives - base directives apply to all environments
    const cspDirectives: Record<string, string[]> = {
      defaultSrc: ["'self'"],
      // SECURITY: 'unsafe-inline' is disabled in production for better XSS protection
      // In development, inline styles may be needed for hot reloading
      styleSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'"],
      // SECURITY: Restrict image sources - configure CSP_IMG_SRC for trusted CDNs
      // Example: CSP_IMG_SRC="'self',data:,https://cdn.example.com"
      imgSrc: cspImgSrc,
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'wss:', 'ws:'], // Allow WebSocket connections
      frameAncestors: ["'none'"], // Prevent clickjacking
      formAction: ["'self'"],
    };

    // Only upgrade insecure requests in production
    if (isProduction) {
      cspDirectives.upgradeInsecureRequests = [];
    }

    app.use(
      helmet({
        contentSecurityPolicy: { directives: cspDirectives },
        crossOriginEmbedderPolicy: false, // Required for WebSocket connections
      })
    );

    // Request body size limits to prevent DoS attacks
    app.use(json({ limit: '1mb' }));
    app.use(urlencoded({ limit: '1mb', extended: true }));

    // Enable Zod validation globally
    app.useGlobalPipes(new ZodValidationPipe());

    // CORS configuration - never use wildcard '*' with credentials: true
    app.enableCors({
      origin: corsOrigin || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    });

    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.log(
      `Socio backend running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`
    );
  } catch (error) {
    logger.error('Failed to start application', error instanceof Error ? error.stack : error);
    process.exit(1);
  }
}

bootstrap();

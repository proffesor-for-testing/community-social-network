import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS with explicit origins
  app.enableCors({
    origin: process.env['CORS_ALLOWED_ORIGINS']?.split(',') || [
      'http://localhost:5173',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  const port = process.env['PORT'] || 3000;
  await app.listen(port);
  logger.log(`API is running on http://localhost:${port}`);
}

bootstrap();

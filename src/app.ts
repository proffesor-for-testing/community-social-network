/**
 * Express Application Configuration
 * Main app setup with middleware and routes
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // ============================================================
  // Security Middleware
  // ============================================================
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }));

  // ============================================================
  // Request Parsing
  // ============================================================
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ============================================================
  // Logging
  // ============================================================
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // ============================================================
  // Health Check
  // ============================================================
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      modules: {
        auth: 'M1 - Authentication with JWT & rate limiting',
        profiles: 'M2 - User profiles with media upload',
        posts: 'M3 - Posts & feed with caching',
        comments: 'M4 - Threaded comments with mentions',
        groups: 'M5 - Groups with RBAC permissions',
        social: 'M6 - Follow/block social graph',
        notifications: 'M7 - Real-time notifications',
        admin: 'M8 - Admin panel with 2FA',
      },
    });
  });

  // ============================================================
  // API Routes
  // ============================================================
  const apiPrefix = `/api/${process.env.API_VERSION || 'v1'}`;

  // API documentation endpoint
  app.get(apiPrefix, (req: Request, res: Response) => {
    res.json({
      name: 'Community Social Network API',
      version: process.env.API_VERSION || 'v1',
      status: 'running',
      documentation: 'Routes require dependency injection - see /health for module status',
      endpoints: {
        auth: `${apiPrefix}/auth`,
        profiles: `${apiPrefix}/profiles`,
        posts: `${apiPrefix}/posts`,
        comments: `${apiPrefix}/comments`,
        groups: `${apiPrefix}/groups`,
        social: `${apiPrefix}/social`,
        notifications: `${apiPrefix}/notifications`,
        admin: `${apiPrefix}/admin`,
      },
      note: 'Full route wiring requires database connection. Run with DATABASE_URL configured.',
    });
  });

  // Placeholder routes for each module (shows structure exists)
  const modules = ['auth', 'profiles', 'posts', 'comments', 'groups', 'social', 'notifications', 'admin'];
  modules.forEach(module => {
    app.all(`${apiPrefix}/${module}*`, (req: Request, res: Response) => {
      res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: `${module} routes require database connection and dependency injection`,
        hint: 'Configure DATABASE_URL and run with full bootstrap',
      });
    });
  });

  // ============================================================
  // 404 Handler
  // ============================================================
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  // ============================================================
  // Global Error Handler
  // ============================================================
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);

    const statusCode = (err as any).statusCode || 500;
    const errorCode = (err as any).code || 'INTERNAL_ERROR';

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
  });

  return app;
}

export default createApp;

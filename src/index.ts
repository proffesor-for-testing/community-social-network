/**
 * Application Entry Point
 * Starts the Express server and initializes all services
 */

import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import { createApp } from './app';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function bootstrap(): Promise<void> {
  try {
    console.log('🚀 Starting Community Social Network API...');
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(PORT, HOST, () => {
      console.log(`✅ Server running at http://${HOST}:${PORT}`);
      console.log(`   API Base: http://${HOST}:${PORT}/api/${process.env.API_VERSION || 'v1'}`);
      console.log(`   Health: http://${HOST}:${PORT}/health`);
      console.log('');
      console.log('📋 Available endpoints:');
      console.log('   GET  /health              - Health check');
      console.log('   GET  /api/v1              - API documentation');
      console.log('   *    /api/v1/profiles/*   - Profile operations');
      console.log('');
    });

    // Graceful shutdown
    const shutdown = (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
bootstrap();

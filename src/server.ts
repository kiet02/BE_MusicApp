import { config } from '@shared/config/env';
import { connectDatabase, disconnectDatabase } from '@shared/config/database';
import { logger } from '@shared/utils/logger';
import app from './app';

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Start server
    const server = app.listen(config.port, () => {
      const baseUrl =
        config.env === 'production' ? `Port ${config.port}` : `http://localhost:${config.port}`;

      logger.info(`🚀 Server is running on ${baseUrl}`);
      logger.info(`📍 Environment: ${config.env}`);
      if (config.env !== 'production') {
        logger.info(`📋 Health check: ${baseUrl}/health`);
        logger.info(`📋 API base URL: ${baseUrl}/api/v1`);
        logger.info(`📖 Swagger docs: ${baseUrl}/docs`);
      }
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabase();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason: Error) => {
      logger.error('Unhandled Rejection:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

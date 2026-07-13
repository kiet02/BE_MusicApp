import mongoose from 'mongoose';
import { config } from './env';
import { logger } from '@shared/utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoose.url, {
      serverSelectionTimeoutMS: 5000, // Timeout sau 5s nếu không kết nối được
      connectTimeoutMS: 5000,
    });
    logger.info('✅ MongoDB connected successfully');
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    logger.warn('⚠️  Server will start without database. Please check your MongoDB connection.');
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️  MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('❌ MongoDB error:', err);
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('✅ MongoDB reconnected');
  });
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected gracefully');
};

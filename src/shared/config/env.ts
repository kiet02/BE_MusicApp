import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),

  // MongoDB
  MONGODB_HOST: z.string({ message: 'MongoDB host is required' }),
  MONGODB_USER: z.string({ message: 'MongoDB username is required' }),
  MONGODB_PASS: z.string({ message: 'MongoDB password is required' }),
  MONGODB_DB: z.string({ message: 'MongoDB database name is required' }),

  // JWT
  JWT_SECRET: z.string({ message: 'JWT secret key is required' }),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string({ message: 'JWT refresh secret key is required' }),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().default(''),

  // MinIO Storage
  MINIO_ENDPOINT: z.string({ message: 'MinIO endpoint is required' }),
  MINIO_PORT: z.string({ message: 'MinIO port is required' }).transform(Number),
  MINIO_USE_SSL: z
    .enum(['true', 'false'], { message: 'MinIO use SSL must be true or false' })
    .transform((val) => val === 'true'),
  MINIO_ACCESS_KEY: z.string({ message: 'MinIO access key is required' }),
  MINIO_SECRET_KEY: z.string({ message: 'MinIO secret key is required' }),
  MINIO_BUCKET_NAME: z.string({ message: 'MinIO bucket name is required' }),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Config validation error: ${parsedEnv.error.message}`);
}

const envVars = parsedEnv.data;

// Compose MongoDB URI from individual components
const mongoUri = `mongodb+srv://${envVars.MONGODB_USER}:${envVars.MONGODB_PASS}@${envVars.MONGODB_HOST}/${envVars.MONGODB_DB}?retryWrites=true&w=majority`;

export const config = {
  env: envVars.NODE_ENV as string,
  port: envVars.PORT as number,
  mongoose: {
    url: mongoUri,
    host: envVars.MONGODB_HOST as string,
    user: envVars.MONGODB_USER as string,
    db: envVars.MONGODB_DB as string,
  },
  jwt: {
    secret: envVars.JWT_SECRET as string,
    expiresIn: envVars.JWT_EXPIRES_IN as string,
    refreshSecret: envVars.JWT_REFRESH_SECRET as string,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN as string,
  },
  google: {
    clientId: envVars.GOOGLE_CLIENT_ID as string,
  },
  minio: {
    endpoint: envVars.MINIO_ENDPOINT as string,
    port: envVars.MINIO_PORT as number,
    useSSL: envVars.MINIO_USE_SSL as boolean,
    accessKey: envVars.MINIO_ACCESS_KEY as string,
    secretKey: envVars.MINIO_SECRET_KEY as string,
    bucketName: envVars.MINIO_BUCKET_NAME as string,
  },
  isDevelopment: envVars.NODE_ENV === 'development',
  isProduction: envVars.NODE_ENV === 'production',
  isTest: envVars.NODE_ENV === 'test',
};

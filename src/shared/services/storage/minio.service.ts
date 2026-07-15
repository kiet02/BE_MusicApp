import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { IStorageService } from './storage.interface';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';

export class MinioService implements IStorageService {
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor() {
    this.bucketName = config.minio.bucketName;

    this.minioClient = new Minio.Client({
      endPoint: config.minio.endpoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });

    this.initializeBucket();
  }

  /**
   * Ensure the bucket exists, and create it if it doesn't.
   * Also set the bucket policy to public read so files can be accessed via URL.
   */
  private async initializeBucket() {
    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        logger.info(`MinIO bucket '${this.bucketName}' created successfully.`);

        // Set public read policy for the bucket
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Action: ['s3:GetObject'],
              Effect: 'Allow',
              Principal: {
                AWS: ['*'],
              },
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
        logger.info(`Set public read policy for bucket '${this.bucketName}'.`);
      }
    } catch (error) {
      logger.error('Error initializing MinIO bucket:', error);
    }
  }

  public async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    try {
      // Generate a unique filename to prevent overwriting
      const extension = path.extname(fileName);
      const uniqueFileName = `${uuidv4()}${extension}`;

      // Upload file to MinIO
      await this.minioClient.putObject(
        this.bucketName,
        uniqueFileName,
        fileBuffer,
        fileBuffer.length,
        { 'Content-Type': mimeType },
      );

      return uniqueFileName;
    } catch (error) {
      logger.error('Error uploading file to MinIO:', error);
      throw new Error('Failed to upload file');
    }
  }

  public async deleteFile(fileName: string): Promise<boolean> {
    try {
      await this.minioClient.removeObject(this.bucketName, fileName);
      return true;
    } catch (error) {
      logger.error(`Error deleting file ${fileName} from MinIO:`, error);
      return false;
    }
  }

  public async getFileUrl(fileName: string): Promise<string> {
    // For public buckets, we can construct the URL directly
    // If you need presigned URLs for private buckets, use this.minioClient.presignedGetObject(this.bucketName, fileName)
    const protocol = config.minio.useSSL ? 'https' : 'http';
    const portString =
      config.minio.port === 80 || config.minio.port === 443 ? '' : `:${config.minio.port}`;

    return `${protocol}://${config.minio.endpoint}${portString}/${this.bucketName}/${fileName}`;
  }

  public async generatePresignedPutUrl(
    fileName: string,
    mimeType: string,
  ): Promise<{ uploadUrl: string; finalUrl: string; fileName: string }> {
    try {
      const extension = path.extname(fileName);
      const uniqueFileName = `${uuidv4()}${extension}`;

      // 5 minutes expiration
      const uploadUrl = await this.minioClient.presignedPutObject(
        this.bucketName,
        uniqueFileName,
        5 * 60,
      );

      const finalUrl = await this.getFileUrl(uniqueFileName);

      return { uploadUrl, finalUrl, fileName: uniqueFileName };
    } catch (error) {
      logger.error('Error generating presigned URL for MinIO:', error);
      throw new Error('Failed to generate presigned URL');
    }
  }

  public async getFileBuffer(
    fileName: string,
    onProgress?: (percent: number) => void,
  ): Promise<Buffer> {
    try {
      // Lấy thông tin dung lượng file trước
      const stat = await this.minioClient.statObject(this.bucketName, fileName);
      const totalSize = stat.size;
      let downloadedSize = 0;
      let lastReportedPercent = 0;

      const dataStream = await this.minioClient.getObject(this.bucketName, fileName);
      return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        dataStream.on('data', (chunk) => {
          chunks.push(chunk);
          downloadedSize += chunk.length;

          if (onProgress && totalSize > 0) {
            const percent = Math.round((downloadedSize / totalSize) * 100);
            // Chỉ gửi progress khi tăng ít nhất 5% để tránh spam event loop
            if (percent - lastReportedPercent >= 5 || percent === 100) {
              onProgress(percent);
              lastReportedPercent = percent;
            }
          }
        });
        dataStream.on('end', () => resolve(Buffer.concat(chunks)));
        dataStream.on('error', (err) => reject(err));
      });
    } catch (error) {
      logger.error(`Error getting file buffer for ${fileName} from MinIO:`, error);
      throw new Error('Failed to get file buffer');
    }
  }
}

// Export a singleton instance
export const minioService = new MinioService();

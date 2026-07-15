import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { minioService } from '../../shared/services/storage/minio.service';
import { logger } from '../../shared/utils/logger';

export const generateMinioUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileName, contentType } = req.body;

    if (!fileName || !contentType) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'fileName and contentType are required',
      });
    }

    const {
      uploadUrl,
      finalUrl,
      fileName: uniqueFileName,
    } = await minioService.generatePresignedPutUrl(fileName, contentType);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        uploadUrl,
        finalUrl,
        fileName: uniqueFileName,
      },
    });
  } catch (error) {
    logger.error('Error in generateMinioUrl controller:', error);
    next(error);
  }
};

export const saveSongDb = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, audioUrl } = req.body;

    // Giả lập lưu vào DB
    logger.info(`Saved song to DB: ${title} - ${audioUrl}`);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Song saved to database successfully',
      data: {
        title,
        audioUrl,
      },
    });
  } catch (error) {
    logger.error('Error in saveSongDb controller:', error);
    next(error);
  }
};

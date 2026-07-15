import multer from 'multer';
import { Request } from 'express';

// Define the maximum file size (e.g., 20MB) to accommodate MP3s
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Filter to allow only specific formats (images and audio)
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and audio files are allowed!') as any);
  }
};

// Use memory storage so we can upload the Buffer directly to MinIO
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE, // Consider increasing if MP3 files are larger than 5MB
  },
});

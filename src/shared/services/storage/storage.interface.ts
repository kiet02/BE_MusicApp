export interface IStorageService {
  /**
   * Uploads a file buffer to the storage service.
   * @param fileBuffer The binary content of the file
   * @param fileName The name (including extension) of the file
   * @param mimeType The MIME type of the file (e.g., 'image/jpeg')
   * @returns The relative path or unique identifier of the uploaded file
   */
  uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string>;

  /**
   * Deletes a file from the storage service.
   * @param fileName The relative path or unique identifier of the file
   * @returns boolean indicating success
   */
  deleteFile(fileName: string): Promise<boolean>;

  /**
   * Gets a fully qualified URL to download or view the file.
   * @param fileName The relative path or unique identifier of the file
   * @returns The download URL string
   */
  getFileUrl(fileName: string): Promise<string>;

  /**
   * Generates a presigned URL for direct upload from the client.
   * @param fileName The name (including extension) of the file
   * @param mimeType The MIME type of the file
   * @returns An object containing the uploadUrl and the finalUrl
   */
  generatePresignedPutUrl(
    fileName: string,
    mimeType: string,
  ): Promise<{ uploadUrl: string; finalUrl: string; fileName: string }>;

  /**
   * Retrieves the file as a buffer from the storage service.
   * @param fileName The relative path or unique identifier of the file
   * @param onProgress Optional callback to track download percentage
   * @returns A Promise resolving to the file Buffer
   */
  getFileBuffer(fileName: string, onProgress?: (percent: number) => void): Promise<Buffer>;
}

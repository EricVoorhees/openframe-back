import AWS from 'aws-sdk';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

class BackblazeService {
  private s3: AWS.S3;
  private bucketName: string;

  constructor() {
    // Backblaze B2 is S3-compatible
    this.s3 = new AWS.S3({
      endpoint: `https://s3.${config.B2_REGION}.backblazeb2.com`,
      accessKeyId: config.B2_APPLICATION_KEY_ID,
      secretAccessKey: config.B2_APPLICATION_KEY,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });

    this.bucketName = config.B2_BUCKET_NAME;
    logger.info('Backblaze B2 service initialized');
  }

  /**
   * Upload a file to B2
   */
  async uploadFile(
    key: string,
    content: string | Buffer,
    contentType: string = 'text/plain'
  ): Promise<string> {
    try {
      const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
        Body: content,
        ContentType: contentType,
      };

      const result = await this.s3.upload(params).promise();
      logger.info('File uploaded to B2', { key, location: result.Location });
      return result.Location;
    } catch (error) {
      logger.error('Failed to upload file to B2', { key, error });
      throw new AppError('Failed to upload file to storage', 500);
    }
  }

  /**
   * Download a file from B2
   */
  async downloadFile(key: string): Promise<string> {
    try {
      const params: AWS.S3.GetObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
      };

      const result = await this.s3.getObject(params).promise();
      const content = result.Body?.toString('utf-8');

      if (!content) {
        throw new AppError('File content is empty', 404);
      }

      logger.debug('File downloaded from B2', { key });
      return content;
    } catch (error) {
      logger.error('Failed to download file from B2', { key, error });
      
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        throw new AppError('File not found', 404);
      }
      
      throw new AppError('Failed to download file from storage', 500);
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(prefix: string): Promise<string[]> {
    try {
      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: this.bucketName,
        Prefix: prefix,
      };

      const result = await this.s3.listObjectsV2(params).promise();
      const files = result.Contents?.map((obj) => obj.Key || '') || [];

      logger.debug('Files listed from B2', { prefix, count: files.length });
      return files;
    } catch (error) {
      logger.error('Failed to list files from B2', { prefix, error });
      throw new AppError('Failed to list files from storage', 500);
    }
  }

  /**
   * Delete a file from B2
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const params: AWS.S3.DeleteObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
      };

      await this.s3.deleteObject(params).promise();
      logger.info('File deleted from B2', { key });
    } catch (error) {
      logger.error('Failed to delete file from B2', { key, error });
      throw new AppError('Failed to delete file from storage', 500);
    }
  }

  /**
   * Upload multiple files for a project
   */
  async uploadProjectFiles(
    projectId: string,
    files: Array<{ path: string; content: string }>
  ): Promise<string[]> {
    try {
      const uploadPromises = files.map((file) => {
        const key = `projects/${projectId}/${file.path}`;
        return this.uploadFile(key, file.content, this.getContentType(file.path));
      });

      const locations = await Promise.all(uploadPromises);
      logger.info('Project files uploaded', { projectId, count: files.length });
      return locations;
    } catch (error) {
      logger.error('Failed to upload project files', { projectId, error });
      throw new AppError('Failed to upload project files', 500);
    }
  }

  /**
   * Download all files for a project
   */
  async downloadProjectFiles(
    projectId: string
  ): Promise<Array<{ path: string; content: string }>> {
    try {
      const prefix = `projects/${projectId}/`;
      const fileKeys = await this.listFiles(prefix);

      const downloadPromises = fileKeys.map(async (key) => {
        const content = await this.downloadFile(key);
        const path = key.replace(prefix, '');
        return { path, content };
      });

      const files = await Promise.all(downloadPromises);
      logger.info('Project files downloaded', { projectId, count: files.length });
      return files;
    } catch (error) {
      logger.error('Failed to download project files', { projectId, error });
      throw new AppError('Failed to download project files', 500);
    }
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      js: 'application/javascript',
      jsx: 'application/javascript',
      ts: 'application/typescript',
      tsx: 'application/typescript',
      json: 'application/json',
      html: 'text/html',
      css: 'text/css',
      md: 'text/markdown',
      txt: 'text/plain',
    };

    return contentTypes[ext || ''] || 'text/plain';
  }

  /**
   * Create a signed URL for temporary access
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expiresIn,
      };

      const url = await this.s3.getSignedUrlPromise('getObject', params);
      logger.debug('Signed URL generated', { key, expiresIn });
      return url;
    } catch (error) {
      logger.error('Failed to generate signed URL', { key, error });
      throw new AppError('Failed to generate signed URL', 500);
    }
  }
}

export default new BackblazeService();


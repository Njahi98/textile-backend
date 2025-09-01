import cloudinary from './cloudinary';
import { UploadApiResponse } from 'cloudinary';

export interface ImageUploadResult {
  url: string;
  publicId: string;
}
export interface FileUploadResult extends ImageUploadResult {
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export const uploadImageToCloudinary = async (
  buffer: Buffer,
  folder: string = 'products'
): Promise<ImageUploadResult> => {
  return new Promise((resolve, reject) => {
    // Different transformations based on folder type
    const getTransformations = (folder: string) => {
      if (folder === 'avatars') {
        return [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' }, // Square crop focusing on face
          { quality: 'auto' },
          { format: 'auto' }
        ];
      }
      
      // Default transformations for products
      return [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto' },
        { format: 'auto' }
      ];
    };

    cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'image',
        transformation: getTransformations(folder)
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id
          });
        } else {
          reject(new Error('Upload failed: no result returned'));
        }
      }
    ).end(buffer);
  });
};

export const deleteImageFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

export const uploadFileToCloudinary = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder: string = 'chat-files'
): Promise<FileUploadResult> => {
  return new Promise((resolve, reject) => {
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    
    const getResourceType = () => {
      if (isImage) return 'image';
      if (isVideo) return 'video';
      return 'raw'; // For documents, Excel, CSV files
    };

    const getTransformations = () => {
      if (isImage) {
        return [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto' },
          { format: 'auto' }
        ];
      }
      if (isVideo) {
        return [
          { width: 1280, height: 720, crop: 'limit' },
          { quality: 'auto' }
        ];
      }
      return undefined; // No transformations for raw files
    };

    cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: getResourceType(),
        transformation: getTransformations(),
        public_id: `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9.]/g, '_')}`,
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            fileName: originalName,
            fileSize: result.bytes,
            mimeType: mimeType
          });
        } else {
          reject(new Error('Upload failed: no result returned'));
        }
      }
    ).end(buffer);
  });
};
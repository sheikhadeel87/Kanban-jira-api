import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create Cloudinary storage for Multer
export const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'kanban-board', // Optional: organize files in a folder
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'],
    resource_type: 'auto', // Automatically detect file type
  },
});

// Helper function to delete file from Cloudinary
export const deleteFromCloudinary = async (urlOrPublicId) => {
  try {
    if (!urlOrPublicId) return null;
    
    let publicId = urlOrPublicId;
    
    // If it's a Cloudinary URL, extract the public_id
    if (urlOrPublicId.startsWith('http://') || urlOrPublicId.startsWith('https://')) {
      // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{version}/{public_id}.{format}
      // We need to extract the public_id part
      try {
        // Try to extract public_id from URL
        const urlParts = urlOrPublicId.split('/');
        const uploadIndex = urlParts.findIndex(part => part === 'upload');
        
        if (uploadIndex !== -1 && urlParts.length > uploadIndex + 2) {
          // Get the part after 'upload' and before the version (if exists)
          // Format: /upload/v1234567890/folder/filename.jpg
          const afterUpload = urlParts.slice(uploadIndex + 1);
          // Skip version if it starts with 'v' and is numeric
          let startIndex = 0;
          if (afterUpload[0] && afterUpload[0].startsWith('v') && /^\d+$/.test(afterUpload[0].substring(1))) {
            startIndex = 1;
          }
          // Join the remaining parts and remove file extension
          publicId = afterUpload.slice(startIndex).join('/').split('.')[0];
        } else {
          // Fallback: try to extract from end of URL
          const lastPart = urlParts[urlParts.length - 1];
          publicId = lastPart.split('.')[0];
        }
      } catch (error) {
        console.error('Error parsing Cloudinary URL:', error);
        // Fallback: use the last part of the URL
        const urlParts = urlOrPublicId.split('/');
        publicId = urlParts[urlParts.length - 1].split('.')[0];
      }
    }
    
    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    // Don't throw - allow task deletion to continue even if file deletion fails
    return null;
  }
};

export default cloudinary;


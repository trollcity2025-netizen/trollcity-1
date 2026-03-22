/**
 * City Ad Image Upload Utility
 * Handles uploading promo images to Supabase Storage
 */
import { supabase } from './supabase';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a city ad image to Supabase Storage
 * 
 * @param file - The Blob/File to upload
 * @param userId - The admin/secretary user's UUID
 * @returns Promise with the public URL or error
 */
export async function uploadCityAdImage(file: Blob, userId: string): Promise<UploadResult> {
  try {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false,
        error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`
      };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large. Maximum size is 5MB.`
      };
    }

    // Generate unique file path: city-ads/{userId}/{timestamp}.{ext}
    const timestamp = Date.now();
    const extension = file.type.split('/')[1] || 'jpg';
    const filePath = `${userId}/${timestamp}.${extension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('city-ads')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload image'
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('city-ads')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return {
        success: false,
        error: 'Failed to get public URL'
      };
    }

    return {
      success: true,
      url: urlData.publicUrl
    };
  } catch (error) {
    console.error('Upload city ad image error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Delete a city ad image from Supabase Storage
 * 
 * @param imageUrl - The public URL of the image to delete
 * @returns Promise with success status
 */
export async function deleteCityAdImage(imageUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract path from URL
    const urlParts = imageUrl.split('/');
    const pathIndex = urlParts.findIndex(part => part === 'city-ads');
    if (pathIndex === -1) {
      return { success: false, error: 'Invalid image URL' };
    }
    
    const filePath = urlParts.slice(pathIndex + 1).join('/');

    const { error } = await supabase.storage
      .from('city-ads')
      .remove([filePath]);

    if (error) {
      console.error('Supabase storage delete error:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete image'
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete city ad image error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Compress an image blob to reduce file size
 * 
 * @param blob - The original image blob
 * @param maxWidth - Maximum width (default 800)
 * @param quality - JPEG quality (default 0.8)
 * @returns Promise with the compressed blob
 */
export async function compressAdImage(
  blob: Blob,
  maxWidth: number = 800,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Determine output format
      const outputType = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';

      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
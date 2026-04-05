import { supabase } from './supabase'

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024

// Allowed MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export interface UploadCoverResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Upload a cover photo to Supabase Storage
 * 
 * @param file - The Blob/File to upload
 * @param userId - The user's UUID
 * @returns Promise with the public URL or error
 */
export async function uploadCover(file: Blob, userId: string): Promise<UploadCoverResult> {
  try {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false,
        error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`
      }
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large. Maximum size is 5MB.`
      }
    }

    // Generate unique file path: covers/{userId}/{timestamp}.jpg
    const timestamp = Date.now()
    const filePath = `${userId}/${timestamp}.jpg`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('covers')
      .upload(filePath, file, {
        contentType: 'image/jpeg',
        upsert: false
      })

    if (error) {
      console.error('Supabase storage upload error:', error)
      return {
        success: false,
        error: error.message || 'Failed to upload cover photo'
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('covers')
      .getPublicUrl(filePath)

    if (!urlData?.publicUrl) {
      return {
        success: false,
        error: 'Failed to get public URL'
      }
    }

    return {
      success: true,
      url: urlData.publicUrl
    }
  } catch (error) {
    console.error('Upload cover error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Delete a cover photo from Supabase Storage
 * 
 * @param filePath - The full path to the file in storage
 * @returns Promise with success status
 */
export async function deleteCover(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from('covers')
      .remove([filePath])

    if (error) {
      console.error('Supabase storage delete error:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete cover photo'
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete cover error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Update the user's profile with the cover URL
 * 
 * @param userId - The user's UUID
 * @param coverUrl - The public URL of the uploaded cover
 * @returns Promise with success status
 */
export async function updateProfileCover(userId: string, coverUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ cover_url: coverUrl })
      .eq('id', userId)

    if (error) {
      console.error('Profile update error:', error)
      return {
        success: false,
        error: error.message || 'Failed to update profile'
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Update profile cover error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Compress and convert an image blob to JPEG format
 * This helps reduce file size before upload
 * 
 * @param blob - The original image blob
 * @param maxWidth - Maximum width (default 1920)
 * @param quality - JPEG quality (default 0.85)
 * @returns Promise with the compressed blob
 */
export async function compressImage(
  blob: Blob,
  maxWidth: number = 1920,
  quality: number = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Convert to blob with JPEG format
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result)
          } else {
            reject(new Error('Failed to convert canvas to blob'))
          }
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

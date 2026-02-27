import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import CoverPhotoEditor from './CoverPhotoEditor';
import { Area } from 'react-easy-crop';

interface CoverPhotoUploadProps {
  onUploadComplete?: (url: string | null) => void;
  currentCoverUrl?: string | null;
  userId?: string; // Optional: if not provided, uses current user
}

// Utility function to create a cropped image blob
async function createCroppedImage(
  imageSrc: string,
  croppedAreaPixels: Area
): Promise<Blob> {
  const image = new Image();
  const url = imageSrc.startsWith('data:') ? imageSrc : imageSrc;
  
  return new Promise((resolve, reject) => {
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      
      canvas.width = croppedAreaPixels.width * scaleX;
      canvas.height = croppedAreaPixels.height * scaleY;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(
        image,
        croppedAreaPixels.x * scaleX,
        croppedAreaPixels.y * scaleY,
        croppedAreaPixels.width * scaleX,
        croppedAreaPixels.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        0.9 // High quality JPEG
      );
    };
    
    image.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    image.src = url;
  });
}

export default function CoverPhotoUpload({
  onUploadComplete,
  currentCoverUrl,
  userId: propUserId
}: CoverPhotoUploadProps) {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Use provided userId or fall back to current user
  const effectiveUserId = propUserId || user?.id;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Create preview URL
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setShowEditor(true);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (croppedAreaPixels: Area) => {
    if (!effectiveUserId || !selectedImage) {
      toast.error('You must be logged in to upload a cover photo');
      return;
    }

    setIsSaving(true);
    try {
      // Create cropped image blob
      const croppedBlob = await createCroppedImage(selectedImage, croppedAreaPixels);
      
      // Generate unique file path: covers/{userId}/{timestamp}.jpg
      const timestamp = Date.now();
      const filePath = `${effectiveUserId}/${timestamp}.jpg`;

      // Upload to Supabase Storage 'covers' bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('covers')
        .upload(filePath, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload cover photo: ' + uploadError.message);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('covers')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) {
        toast.error('Failed to get public URL');
        return;
      }

      // Update user profile with cover_url
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ cover_url: publicUrl })
        .eq('id', effectiveUserId);

      if (profileError) {
        console.error('Profile update error:', profileError);
        toast.error('Failed to save cover photo to profile');
        return;
      }

      toast.success('Cover photo saved!');
      setShowEditor(false);
      setSelectedImage(null);
      
      // Callback
      onUploadComplete?.(publicUrl);
    } catch (err) {
      console.error('Error saving cover photo:', err);
      toast.error('Failed to save cover photo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setShowEditor(false);
    setSelectedImage(null);
  };

  const handleRemoveCover = async () => {
    if (!effectiveUserId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ cover_url: null })
        .eq('id', effectiveUserId);

      if (error) throw error;
      
      toast.success('Cover photo removed');
      onUploadComplete?.(null);
    } catch (err) {
      console.error('Error removing cover photo:', err);
      toast.error('Failed to remove cover photo');
    }
  };

  return (
    <>
      <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-purple-500/20">
        {/* Upload Button */}
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !effectiveUserId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 hover:from-pink-400 hover:via-purple-400 hover:to-pink-400 text-white font-semibold transition-all transform hover:scale-105 shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isUploading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={18} />
                Change Cover
              </>
            )}
          </button>

          {currentCoverUrl && (
            <button
              onClick={handleRemoveCover}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 font-medium transition-all"
            >
              🗑️ Remove
            </button>
          )}
        </div>

        {/* Help Text */}
        <p className="text-sm text-purple-200/60">
          📐 Recommended: 1500x500 pixels (3:1 ratio) • JPG or PNG up to 5MB
        </p>
      </div>

      {/* Cover Photo Editor Modal */}
      {showEditor && selectedImage && (
        <CoverPhotoEditor
          image={selectedImage}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isSaving}
        />
      )}
    </>
  );
}

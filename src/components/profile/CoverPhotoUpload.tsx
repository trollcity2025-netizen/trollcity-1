import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { Upload, Camera, Image as ImageIcon } from 'lucide-react';
import CoverPhotoEditor from './CoverPhotoEditor';

interface CoverPhotoUploadProps {
  onUploadComplete?: (url: string, positionX: number, positionY: number, zoom: number) => void;
  currentCoverUrl?: string | null;
  currentPositionX?: number;
  currentPositionY?: number;
  currentZoom?: number;
}

export default function CoverPhotoUpload({
  onUploadComplete,
  currentCoverUrl,
  currentPositionX = 50,
  currentPositionY = 50,
  currentZoom = 1
}: CoverPhotoUploadProps) {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
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

  const handleSave = async (crop: { x: number; y: number }, zoom: number) => {
    if (!user || !selectedImage) return;

    setIsSaving(true);
    try {
      // Convert base64 to blob
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `covers/${user.id}/${timestamp}.jpg`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload cover photo');
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(fileName);

      // Calculate crop percentages (convert from pixels to percentage)
      // The crop.x and crop.y are in pixels, we need to convert to percentages
      const positionX = currentPositionX; // Default to center
      const positionY = currentPositionY;
      
      // Update user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          cover_photo_url: publicUrl,
          cover_position_x: positionX,
          cover_position_y: positionY,
          cover_zoom: zoom
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        toast.error('Failed to save cover photo');
        return;
      }

      toast.success('Cover photo saved!');
      setShowEditor(false);
      setSelectedImage(null);
      
      // Callback
      onUploadComplete?.(publicUrl, positionX, positionY, zoom);
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
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          cover_photo_url: null,
          cover_position_x: 50,
          cover_position_y: 50,
          cover_zoom: 1
        })
        .eq('id', user.id);

      if (error) throw error;
      
      toast.success('Cover photo removed');
      onUploadComplete?.(null, 50, 50, 1);
    } catch (err) {
      console.error('Error removing cover photo:', err);
      toast.error('Failed to remove cover photo');
    }
  };

  return (
    <>
      <div className="space-y-4">
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
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload Cover Photo
              </>
            )}
          </button>

          {currentCoverUrl && (
            <button
              onClick={handleRemoveCover}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        {/* Help Text */}
        <p className="text-sm text-gray-400">
          Recommended: 1500x500 pixels (3:1 ratio). JPG or PNG up to 10MB.
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

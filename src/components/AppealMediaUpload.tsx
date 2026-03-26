import React, { useState, useRef } from 'react';
import { uploadAppealMedia, deleteAppealMedia, updateAppealMedia } from '../lib/sellerApi';
import type { MediaMetadata } from '../lib/sellerTiers';

interface AppealMediaUploadProps {
  appealId: string;
  userId: string;
  initialImages?: string[];
  initialVideos?: string[];
  initialImageMetadata?: any[];
  initialVideoMetadata?: any[];
  readOnly?: boolean;
  onSuccess?: () => void;
}

/**
 * Appeal Media Upload Component
 * 
 * Allows users to upload images and videos with EXIF metadata extraction
 * to support fraud detection in appeals.
 */
export default function AppealMediaUpload({
  appealId,
  userId,
  initialImages = [],
  initialVideos = [],
  initialImageMetadata = [],
  initialVideoMetadata = [],
  readOnly = false,
  onSuccess,
}: AppealMediaUploadProps) {
  const [images, setImages] = useState<MediaMetadata[]>(
    initialImages.map((url, idx) => ({
      url,
      filename: '',
      contentType: 'image/jpeg',
      size: 0,
      ...(initialImageMetadata[idx] || {}),
    }))
  );
  const [videos, setVideos] = useState<MediaMetadata[]>(
    initialVideos.map((url, idx) => ({
      url,
      filename: '',
      contentType: 'video/mp4',
      size: 0,
      ...(initialVideoMetadata[idx] || {}),
    }))
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const newImages: MediaMetadata[] = [];
      for (let i = 0; i < files.length; i++) {
        const result = await uploadAppealMedia(files[i], userId);
        newImages.push(result.metadata);
      }
      setImages([...images, ...newImages]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const newVideos: MediaMetadata[] = [];
      for (let i = 0; i < files.length; i++) {
        const result = await uploadAppealMedia(files[i], userId);
        newVideos.push(result.metadata);
      }
      setVideos([...videos, ...newVideos]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload videos');
    } finally {
      setUploading(false);
      // Reset input
      if (videoInputRef.current) {
        videoInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async (url: string) => {
    if (readOnly) return;
    try {
      await deleteAppealMedia(url);
      setImages(images.filter((img) => img.url !== url));
    } catch (err: any) {
      console.error('Failed to delete image:', err);
    }
  };

  const handleRemoveVideo = async (url: string) => {
    if (readOnly) return;
    try {
      await deleteAppealMedia(url);
      setVideos(videos.filter((vid) => vid.url !== url));
    } catch (err: any) {
      console.error('Failed to delete video:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await updateAppealMedia(appealId, images, videos, images, videos);
      setSuccess(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save media');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleString();
  };

  const calculateTimeDifference = (takenAt?: string, uploadedAt?: string) => {
    if (!takenAt || !uploadedAt) return null;
    const taken = new Date(takenAt).getTime();
    const uploaded = new Date(uploadedAt).getTime();
    const diffMs = uploaded - taken;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 0) {
      return { text: `Uploaded ${Math.abs(diffHours).toFixed(1)} hours BEFORE taken`, suspicious: true };
    }
    if (diffHours > 24 * 7) {
      return { text: `Uploaded ${diffHours.toFixed(1)} hours AFTER taken`, suspicious: true };
    }
    return { text: `Uploaded ${diffHours.toFixed(1)} hours AFTER taken`, suspicious: false };
  };

  return (
    <div className="bg-slate-900 rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Appeal Evidence
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg">
          Media saved successfully!
        </div>
      )}

      {/* Images Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Images ({images.length})
          </label>
          {!readOnly && (
            <label className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer">
              Add Images
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          )}
        </div>

        {uploading && (
          <div className="text-sm text-gray-500 mb-2">Uploading...</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {images.map((img, idx) => (
            <div key={idx} className="relative group">
              <img
                src={img.url}
                alt={`Evidence ${idx + 1}`}
                className="w-full h-32 object-cover rounded-lg"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveImage(img.url)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              )}
              {/* Metadata Badge */}
              {img.metadata_available !== false && (
                <div className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1.5 py-0.5 rounded">
                  {img.metadata_available ? '✓ EXIF' : '? EXIF'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Videos Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Videos ({videos.length})
          </label>
          {!readOnly && (
            <label className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer">
              Add Video
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm"
                onChange={handleVideoUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {videos.map((vid, idx) => (
            <div key={idx} className="relative group">
              <video
                src={vid.url}
                controls
                className="w-full h-32 object-cover rounded-lg"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveVideo(vid.url)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      {!readOnly && (images.length > 0 || videos.length > 0) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Evidence'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Admin View for Appeal Media with Metadata Display
 * Shows timestamps and suspicious activity indicators
 */
interface AppealMediaAdminViewProps {
  images: string[];
  imageMetadata: any[];
}

export function AppealMediaAdminView({ images, imageMetadata }: AppealMediaAdminViewProps) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleString();
  };

  const calculateTimeDifference = (takenAt?: string, uploadedAt?: string) => {
    if (!takenAt || !uploadedAt) return null;
    const taken = new Date(takenAt).getTime();
    const uploaded = new Date(uploadedAt).getTime();
    const diffMs = uploaded - taken;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 0) {
      return { text: `Uploaded ${Math.abs(diffHours).toFixed(1)} hours BEFORE taken`, suspicious: true };
    }
    if (diffHours > 24 * 7) {
      return { text: `Uploaded ${diffHours.toFixed(1)} hours AFTER taken`, suspicious: true };
    }
    return { text: `Uploaded ${diffHours.toFixed(1)} hours AFTER taken`, suspicious: false };
  };

  return (
    <div className="bg-slate-900 rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Appeal Evidence (Admin View)
      </h3>

      {/* Images with Metadata */}
      <div className="space-y-4">
        {images.map((url, idx) => {
          const metadata = imageMetadata[idx] || {};
          const timeDiff = calculateTimeDifference(
            metadata.image_taken_at,
            metadata.upload_time
          );

          return (
            <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex gap-3">
                <img
                  src={url}
                  alt={`Evidence ${idx + 1}`}
                  className="w-24 h-24 object-cover rounded"
                />
                <div className="flex-1 text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">
                    Image {idx + 1}
                  </div>
                  
                  <div className="mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                    <div>Upload Time: {formatDate(metadata.upload_time)}</div>
                    {metadata.image_taken_at && (
                      <>
                        <div>Image Taken: {formatDate(metadata.image_taken_at)}</div>
                        {timeDiff && (
                          <div className={timeDiff.suspicious ? 'text-red-600' : 'text-green-600'}>
                            ⚠️ {timeDiff.text}
                          </div>
                        )}
                      </>
                    )}
                    {!metadata.metadata_available && (
                      <div className="text-yellow-600">
                        ⚠️ No EXIF metadata available
                      </div>
                    )}
                    {metadata.device_make && (
                      <div>Device: {metadata.device_make} {metadata.device_model}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {images.length === 0 && (
          <div className="text-gray-500 text-center py-4">
            No images uploaded
          </div>
        )}
      </div>
    </div>
  );
}

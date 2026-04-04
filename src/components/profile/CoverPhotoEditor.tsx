import React, { useRef, useState, useEffect, useCallback } from 'react';

interface AutoCoverPhotoUploadProps {
  onSave: (result: {
    file: File;
    blob: Blob;
    previewUrl: string;
  }) => void | Promise<void>;
  isSaving?: boolean;
  currentImage?: string;
  targetWidth?: number;
  targetHeight?: number;
  outputQuality?: number;
}

// Recommended for your wide banner (matches the screenshot better)
const DEFAULT_WIDTH = 1800;
const DEFAULT_HEIGHT = 320;
const DEFAULT_QUALITY = 0.92;
const OUTPUT_TYPE = 'image/jpeg';

function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

async function autoCropCover(
  file: File,
  targetWidth: number = DEFAULT_WIDTH,
  targetHeight: number = DEFAULT_HEIGHT,
  quality: number = DEFAULT_QUALITY
): Promise<{
  blob: Blob;
  file: File;
  previewUrl: string;
}> {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await createImage(imageUrl);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not get canvas context');

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const targetAspect = targetWidth / targetHeight;
    const imageAspect = image.width / image.height;

    let sx = 0;
    let sy = 0;
    let sWidth = image.width;
    let sHeight = image.height;

    // === FIXED & IMPROVED CENTER CROP TO FILL ===
    if (imageAspect > targetAspect) {
      // Uploaded image is wider than target → crop left & right
      sHeight = image.height;
      sWidth = Math.round(image.height * targetAspect);
      sx = Math.round((image.width - sWidth) / 2);
    } else {
      // Uploaded image is taller/narrower than target → crop top & bottom
      sWidth = image.width;
      sHeight = Math.round(image.width / targetAspect);
      sy = Math.round((image.height - sHeight) / 2);
    }

    // Draw the cropped portion to exactly fill the canvas
    ctx.drawImage(
      image,
      sx, sy, sWidth, sHeight,   // source rectangle (cropped)
      0, 0, targetWidth, targetHeight  // destination (full target size)
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error('Failed to create image blob'));
            return;
          }
          resolve(result);
        },
        OUTPUT_TYPE,
        quality
      );
    });

    const outputFile = new File([blob], `cover-${Date.now()}.jpg`, {
      type: OUTPUT_TYPE,
    });

    const previewUrl = URL.createObjectURL(blob);

    return { blob, file: outputFile, previewUrl };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function AutoCoverPhotoUpload({
  onSave,
  isSaving = false,
  currentImage = '',
  targetWidth = DEFAULT_WIDTH,
  targetHeight = DEFAULT_HEIGHT,
  outputQuality = DEFAULT_QUALITY,
}: AutoCoverPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>(currentImage);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');

  // Cleanup old blob URLs
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    if (currentImage && currentImage !== preview) {
      setPreview(currentImage);
    }
  }, [currentImage]);

  const handleChooseFile = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Image size should be less than 10MB.');
      return;
    }

    try {
      setError('');
      setIsProcessing(true);

      const result = await autoCropCover(selectedFile, targetWidth, targetHeight, outputQuality);

      setPreview((oldPreview) => {
        if (oldPreview && oldPreview.startsWith('blob:')) {
          URL.revokeObjectURL(oldPreview);
        }
        return result.previewUrl;
      });

      await onSave(result);
    } catch (err) {
      console.error('Cover photo processing error:', err);
      setError('Failed to process the cover photo. Please try again.');
    } finally {
      setIsProcessing(false);
      event.target.value = '';
    }
  };

  return (
    <div className="w-full">
      {/* Cover Preview - Updated to match real banner aspect ratio */}
      <div 
        className="relative w-full overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900"
        style={{ aspectRatio: `${targetWidth} / ${targetHeight}` }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Cover photo preview"
            className="h-full w-full object-cover"
            onError={() => setPreview('')}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
            No cover photo selected
          </div>
        )}

        <div className="absolute inset-0 bg-black/20" />

        <div className="absolute bottom-4 right-4">
          <button
            type="button"
            onClick={handleChooseFile}
            disabled={isSaving || isProcessing}
            className="rounded-xl border border-white/15 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-black/80 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : isSaving ? 'Saving...' : '✏️ Edit Cover'}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
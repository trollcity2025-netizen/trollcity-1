import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CoverPhotoEditorProps {
  image: string;
  onSave: (crop: { x: number; y: number }, zoom: number) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function CoverPhotoEditor({ 
  image, 
  onSave, 
  onCancel, 
  isSaving = false 
}: CoverPhotoEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1); // Always 1 - cover photos auto-crop to fill
  const [rotation, setRotation] = useState(0);

  const aspectRatio = 3 / 1; // 3:1 aspect ratio for cover photos

  const onCropComplete = useCallback((_croppedArea: any, _croppedAreaPixels: any) => {
    // Can be used for further processing if needed
  }, []);

  const handleSave = () => {
    onSave(crop, zoom);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 1.5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 1));
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-purple-500/30 shadow-2xl w-full max-w-4xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-950/50">
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Edit Cover Photo
          </h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative h-[400px] bg-black">
          <Cropper
            image={image}
            crop={crop}
            zoom={1} // Always 1 - cover photos auto-crop to fill
            rotation={rotation}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={() => {}} // Disable zoom changes
            onCropComplete={onCropComplete}
            showGrid={true}
            cropShape="rect"
            style={{
              containerStyle: {
                backgroundColor: '#0f0f0f',
              },
              cropAreaStyle: {
                border: '2px solid rgba(168, 85, 247, 0.5)',
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.3)',
              },
            }}
          />
        </div>

        {/* Controls */}
        <div className="p-4 bg-slate-950/80 border-t border-white/10">
          <div className="flex items-center justify-between gap-4">
            {/* Info - No zoom needed, cover photos auto-crop to fill */}
            <div className="text-sm text-gray-400">
              Drag to reposition • Cover auto-fills area
            </div>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-gray-300"
            >
              <RotateCcw size={16} />
              <span className="text-sm">Reset</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10 bg-slate-950/50">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors text-gray-300 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "px-6 py-2 rounded-xl font-medium transition-all transform",
              "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400",
              "text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                Saving...
              </span>
            ) : (
              'Save Cover Photo'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

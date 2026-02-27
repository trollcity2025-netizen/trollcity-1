import React, { useState, useCallback, useRef } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CoverPhotoEditorProps {
  image: string;
  onSave: (croppedAreaPixels: Area) => void;
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
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const croppedAreaRef = useRef<Area | null>(null);

  const aspectRatio = 3 / 1; // 3:1 aspect ratio for cover photos

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    croppedAreaRef.current = croppedAreaPixels;
  }, []);

  const handleSave = () => {
    if (croppedAreaRef.current) {
      onSave(croppedAreaRef.current);
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 rounded-3xl border-2 border-purple-400/50 shadow-2xl shadow-purple-500/20 w-full max-w-4xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-purple-500/20 bg-black/30">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            ✨ Edit Cover Photo
          </h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative h-[450px] bg-gradient-to-b from-black to-slate-900">
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
        <div className="p-5 bg-black/40 border-t border-purple-500/20">
          <div className="flex items-center justify-between gap-4">
            {/* Info */}
            <div className="text-sm text-purple-200/70 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
              Drag to reposition • Cover auto-fills area
            </div>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-all text-purple-200"
            >
              <RotateCcw size={16} />
              <span className="text-sm font-medium">Reset</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-purple-500/20 bg-black/30">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600 transition-all text-gray-200 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "px-8 py-2.5 rounded-xl font-bold transition-all transform hover:scale-105",
              "bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 hover:from-pink-400 hover:to-pink-400",
              "text-white shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            )}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                Saving...
              </span>
            ) : (
              '💾 Save Cover Photo'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

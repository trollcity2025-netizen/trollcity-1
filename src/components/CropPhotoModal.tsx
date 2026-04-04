import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface CropPhotoModalProps {
  isOpen: boolean;
  imageFile: File | null;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
  aspectRatio?: number;        // e.g. 1800/320 for your banner
  title?: string;
}

const CropPhotoModal: React.FC<CropPhotoModalProps> = ({
  isOpen,
  imageFile,
  onCrop,
  onCancel,
  aspectRatio = 1800 / 320,   // Default to your wide banner
  title = 'Crop Cover Photo',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [imageSrc, setImageSrc] = useState<string>('');
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Load image when file changes
  useEffect(() => {
    if (!imageFile) return;

    const reader = new FileReader();
    reader.onload = (e) => setImageSrc(e.target?.result as string);
    reader.readAsDataURL(imageFile);

    // Reset state
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  }, [imageFile]);

  // Calculate initial scale to "cover" the container (fill without distortion)
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;

    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    // Scale so the image covers the entire container (like object-cover)
    const scaleX = containerWidth / img.naturalWidth;
    const scaleY = containerHeight / img.naturalHeight;
    const initialScale = Math.max(scaleX, scaleY) * 1.05; // slight zoom out for better UX

    setScale(initialScale);

    // Center the image initially
    const scaledWidth = img.naturalWidth * initialScale;
    const scaledHeight = img.naturalHeight * initialScale;

    setOffsetX((containerWidth - scaledWidth) / 2);
    setOffsetY((containerHeight - scaledHeight) / 2);
  }, []);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - offsetX,
      y: e.clientY - offsetY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = containerRef.current.offsetHeight;

    const scaledWidth = (imageRef.current?.naturalWidth || 0) * scale;
    const scaledHeight = (imageRef.current?.naturalHeight || 0) * scale;

    let newX = e.clientX - dragStart.x;
    let newY = e.clientY - dragStart.y;

    // Keep image inside bounds (prevent dragging too far)
    newX = Math.max(containerWidth - scaledWidth, Math.min(0, newX));
    newY = Math.max(containerHeight - scaledHeight, Math.min(0, newY));

    setOffsetX(newX);
    setOffsetY(newY);
  };

  const handleMouseUp = () => setIsDragging(false);

  // Zoom handler
  const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newScale = parseFloat(e.target.value);
    setScale(newScale);
  };

  const handleCrop = () => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const containerWidth = 800;   // Higher resolution for better quality
    const containerHeight = Math.round(containerWidth / aspectRatio);

    canvas.width = containerWidth;
    canvas.height = containerHeight;

    const img = imageRef.current;

    // Draw the visible portion of the image onto the canvas
    ctx.drawImage(
      img,
      -offsetX / scale,           // source x
      -offsetY / scale,           // source y
      containerWidth / scale,     // source width
      containerHeight / scale,    // source height
      0, 0,                       // destination x, y
      containerWidth,             // destination width
      containerHeight             // destination height
    );

    canvas.toBlob(
      (blob) => {
        if (blob && imageFile) {
          const croppedFile = new File([blob], imageFile.name.replace(/\.\w+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          onCrop(croppedFile);
        }
      },
      'image/jpeg',
      0.95
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-2xl border border-[#2C2C2C] max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2C2C2C]">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Crop Area */}
          <div
            ref={containerRef}
            className="relative bg-black rounded-xl overflow-hidden border border-[#2C2C2C] mx-auto cursor-grab active:cursor-grabbing"
            style={{
              width: '400px',
              height: `${400 / aspectRatio}px`,
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {imageSrc && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={handleImageLoad}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                  transformOrigin: '0 0',
                  userSelect: 'none',
                }}
                draggable={false}
              />
            )}
          </div>

          {/* Zoom Slider */}
          <div className="px-4 space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Zoom</span>
              <span>{scale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.05"
              value={scale}
              onChange={handleZoom}
              className="w-full accent-violet-500"
            />
            <p className="text-xs text-gray-500 text-center">
              Drag the image to reposition • Scroll wheel not supported yet
            </p>
          </div>

          {/* Hidden Canvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-[#2C2C2C]">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 rounded-xl bg-[#2C2C2C] text-white hover:bg-[#3C3C3C] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCrop}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-medium hover:brightness-110 transition"
            >
              Crop & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CropPhotoModal;
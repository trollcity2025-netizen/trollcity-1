import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Camera, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  streamTitle: string;
  reportedUserId?: string;
  reportedUsername?: string;
}

type ReportType = 'HARASSMENT' | 'SPAM' | 'INAPPROPRIATE_CONTENT' | 'MINOR_LEFT_UNSUPERVISED' | 'OTHER';

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  {
    value: 'MINOR_LEFT_UNSUPERVISED',
    label: 'Minor Left Unsupervised',
    description: 'A minor is on camera without adult supervision',
  },
  {
    value: 'HARASSMENT',
    label: 'Harassment',
    description: 'User is being harassed or bullied',
  },
  {
    value: 'SPAM',
    label: 'Spam',
    description: 'Repeated unwanted messages or content',
  },
  {
    value: 'INAPPROPRIATE_CONTENT',
    label: 'Inappropriate Content',
    description: 'Content violates community guidelines',
  },
  {
    value: 'OTHER',
    label: 'Other',
    description: 'Something else that needs attention',
  },
];

/**
 * Report Modal with Screenshot Upload
 * Allows users to report streams with optional screenshot evidence
 */
export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  streamId,
  streamTitle,
  reportedUserId,
  reportedUsername,
}) => {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (file: File) => {
    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Invalid file type. Please upload JPG, PNG, or WebP.');
      return;
    }
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }
    
    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleFileChange(file);
        break;
      }
    }
  }, []);

  // Add paste listener
  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [isOpen, handlePaste]);

  const handleSubmit = async () => {
    if (!selectedType) {
      toast.error('Please select a report type');
      return;
    }

    setIsSubmitting(true);
    
    try {
      let screenshotUrl: string | undefined;

      // Upload screenshot if provided
      if (screenshot) {
        const fileExt = screenshot.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('moderation-evidence')
          .upload(filePath, screenshot);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('moderation-evidence')
          .getPublicUrl(filePath);

        screenshotUrl = publicUrl;
      }

      // Submit report
      const { error: reportError } = await supabase
        .from('stream_reports')
        .insert({
          reported_stream_id: streamId,
          reported_user_id: reportedUserId,
          report_type: selectedType,
          description: description || undefined,
          screenshot_url: screenshotUrl,
        });

      if (reportError) throw reportError;

      toast.success('Report submitted successfully. Thank you for helping keep Troll City safe.');
      
      // Reset and close
      setSelectedType(null);
      setDescription('');
      setScreenshot(null);
      setScreenshotPreview(null);
      onClose();
    } catch (err) {
      toast.error('Failed to submit report. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedType(null);
      setDescription('');
      setScreenshot(null);
      setScreenshotPreview(null);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-full max-w-lg max-h-[90vh] overflow-y-auto',
              'bg-zinc-900 rounded-2xl border border-zinc-800',
              'shadow-2xl'
            )}
          >
            {/* Header */}
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="text-red-400" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Report Stream</h2>
                  <p className="text-xs text-zinc-500 truncate max-w-[200px]">{streamTitle}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="text-zinc-400" size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Report Type Selection */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-white">What's the issue?</label>
                <div className="space-y-2">
                  {REPORT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setSelectedType(type.value)}
                      className={cn(
                        'w-full p-3 rounded-xl border text-left transition-all',
                        selectedType === type.value
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          'font-bold',
                          selectedType === type.value ? 'text-yellow-400' : 'text-white'
                        )}>
                          {type.label}
                        </span>
                        {selectedType === type.value && (
                          <span className="text-yellow-400">✓</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Screenshot Upload */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-white flex items-center gap-2">
                  <Camera size={16} className="text-zinc-500" />
                  Screenshot Evidence (Optional)
                </label>
                
                {screenshotPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-zinc-700">
                    <img
                      src={screenshotPreview}
                      alt="Screenshot preview"
                      className="w-full max-h-48 object-cover"
                    />
                    <button
                      onClick={() => {
                        setScreenshot(null);
                        setScreenshotPreview(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-red-500 rounded-lg text-white hover:bg-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-6 text-center transition-colors',
                      isDragging
                        ? 'border-yellow-400 bg-yellow-400/10'
                        : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                    )}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                        <ImageIcon className="text-zinc-500" size={24} />
                      </div>
                      <p className="text-sm text-zinc-400">
                        <span className="text-yellow-400">Click to upload</span> or drag & drop
                      </p>
                      <p className="text-xs text-zinc-600">JPG, PNG, WebP up to 10MB</p>
                      <p className="text-xs text-zinc-600">You can also paste a screenshot (Ctrl+V)</p>
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-white">Additional Details (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you observed..."
                  rows={3}
                  className={cn(
                    'w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3',
                    'text-white placeholder:text-zinc-600',
                    'focus:outline-none focus:border-yellow-400',
                    'resize-none'
                  )}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 p-4 space-y-3">
              <button
                onClick={handleSubmit}
                disabled={!selectedType || isSubmitting}
                className={cn(
                  'w-full py-3 px-4 rounded-xl font-bold',
                  'bg-gradient-to-r from-yellow-500 to-amber-500 text-black',
                  'hover:from-yellow-400 hover:to-amber-400',
                  'transition-all transform hover:scale-[1.02]',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
                  'shadow-lg shadow-yellow-500/25'
                )}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ReportModal;
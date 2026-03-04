import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Users, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MinorSafetyConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDisableIndicator?: () => void;
}

/**
 * Stream Start Safety Confirmation Modal
 * Shown when a user with minor_allowed_on_stream=true starts a broadcast
 */
export const MinorSafetyConfirmationModal: React.FC<MinorSafetyConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onDisableIndicator,
}) => {
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
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-full max-w-md p-6 rounded-2xl',
              'bg-gradient-to-b from-zinc-900 to-black',
              'border-2 border-yellow-400/50',
              'shadow-[0_0_60px_rgba(168,85,247,0.3)]'
            )}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center',
                'bg-purple-500/20 border-2 border-yellow-400',
                'shadow-[0_0_20px_rgba(168,85,247,0.5)]'
              )}>
                <Users size={32} className="text-green-400" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-black text-center text-white mb-2">
              Minor Supervision Notice
            </h2>

            {/* Warning badge */}
            <div className="flex justify-center mb-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/20 border border-yellow-400/50">
                <AlertTriangle size={16} className="text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                  Supervision Required
                </span>
              </div>
            </div>

            {/* Message */}
            <div className="space-y-4 mb-6">
              <p className="text-zinc-300 text-center text-sm leading-relaxed">
                You have indicated that <span className="text-green-400 font-bold">minors may appear</span> on your broadcast.
              </p>

              <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                <p className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                  <span className="text-green-400">✓</span> You must remain present and supervising at all times
                </p>
                <p className="text-zinc-400 text-xs">
                  Leaving minors alone on camera may result in:
                </p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">•</span> Broadcast termination
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">•</span> Court summons
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">•</span> Troll Jail penalties
                  </li>
                </ul>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <button
                onClick={onConfirm}
                className={cn(
                  'w-full py-3 px-4 rounded-xl font-bold text-black',
                  'bg-gradient-to-r from-green-500 to-emerald-500',
                  'hover:from-green-400 hover:to-emerald-400',
                  'transition-all transform hover:scale-[1.02]',
                  'shadow-lg shadow-green-500/25'
                )}
              >
                Start Broadcast
              </button>

              <button
                onClick={onClose}
                className={cn(
                  'w-full py-3 px-4 rounded-xl font-bold',
                  'bg-zinc-800 text-zinc-300',
                  'hover:bg-zinc-700 hover:text-white',
                  'transition-all border border-zinc-700'
                )}
              >
                Cancel
              </button>

              {onDisableIndicator && (
                <button
                  onClick={onDisableIndicator}
                  className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                  Disable minor indicator in settings
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MinorSafetyConfirmationModal;
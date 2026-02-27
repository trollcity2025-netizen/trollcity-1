import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '../../hooks/useStreamChat';
import UserNameWithAge from '../UserNameWithAge';
import { Crown, Shield, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FloatingChatOverlayProps {
  messages: Message[];
  streamMods: string[];
  hostId: string;
}

export const FloatingChatOverlay: React.FC<FloatingChatOverlayProps> = ({ messages, streamMods, hostId }) => {
  const renderBadge = (userId: string, role?: string, troll_role?: string) => {
    if (userId === hostId) {
      return <Crown size={12} className="text-yellow-500 inline mr-1" />;
    }
    if (streamMods.includes(userId)) {
      return <Shield size={12} className="text-green-500 inline mr-1" />;
    }
    const r = role || troll_role;
    if (!r) return null;
    if (r === 'admin' || r === 'staff') {
      return <Shield size={12} className="text-red-500 inline mr-1" />;
    }
    if (r === 'moderator' || r === 'troll_officer') {
      return <Shield size={12} className="text-blue-500 inline mr-1" />;
    }
    if (r === 'broadcaster') {
      return <Crown size={12} className="text-yellow-500/50 inline mr-1" />;
    }
    return null;
  };

  return (
    <div className="absolute bottom-4 left-4 right-[320px] pointer-events-none z-20 overflow-hidden flex flex-col items-start">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            layout
            initial={{ opacity: 0, y: 50, x: -20 }}
            animate={{ opacity: 1, y: 0, x: 0, transition: { type: "spring", damping: 10, stiffness: 100 } }}
            exit={{ opacity: 0, y: -50, transition: { duration: 0.5 } }}
            transition={{ duration: 0.5 }}
            className={cn(
              "mb-2 p-2 rounded-lg shadow-lg text-white max-w-[70%] text-sm break-words",
              "bg-black/60 backdrop-blur-sm border border-white/10",
              msg.type === 'system' ? "italic text-zinc-300" : "font-medium",
              "pointer-events-auto" // Allow clicking for potential future interactions
            )}
          >
            {msg.type === 'system' ? (
              <div className="flex items-center gap-1">
                <Sparkles size={12} className="text-yellow-500 flex-shrink-0" />
                <span className="font-bold text-zinc-300">{msg.user_profiles?.username || 'Guest'}</span>
                <span>{msg.content}</span>
              </div>
            ) : (
              <div className="flex items-start">
                <span className="flex-shrink-0">
                  {renderBadge(msg.user_id, msg.user_profiles?.role, msg.user_profiles?.troll_role)}
                  <UserNameWithAge 
                    username={msg.user_profiles?.username || 'Unknown'}
                    createdAt={msg.user_profiles?.created_at}
                    rgbExpiresAt={msg.user_profiles?.rgb_username_expires_at}
                    glowingColor={msg.user_profiles?.glowing_username_color}
                  />:
                </span>
                <span className="ml-1 flex-grow">
                  {msg.content}
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

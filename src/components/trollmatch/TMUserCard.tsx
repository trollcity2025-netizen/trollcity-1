import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wifi, WifiOff, MessageCircle, UserPlus, Eye, Video, UserMinus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TMAllUser } from '../../types/trollMatch';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { useState } from 'react';

interface TMUserCardProps {
  user: TMAllUser;
  isNew?: boolean;
}

export function TMUserCard({ user, isNew }: TMUserCardProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const [showActions, setShowActions] = useState(false);

  const handleClick = () => {
    if (user.is_live && user.stream_id) {
      navigate(`/stream/${user.username}`);
    } else {
      navigate(`/profile/${user.username}`);
    }
  };

  const handleMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      toast.error('Please log in to send messages');
      return;
    }
    navigate(`/tcps?recipient=${user.user_id}&source=troll_match`);
  };

  const handleViewProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${user.username}`);
  };

  const handleInviteToFamily = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.info('Opening family selector...');
  };

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success(`Followed @${user.username}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className="relative cursor-pointer group"
    >
      {/* Main Bubble Container */}
      <div
        onClick={handleClick}
        className={`
          relative w-32 h-32 mx-auto rounded-full overflow-hidden transition-all duration-300
          ${user.is_live 
            ? 'ring-4 ring-red-500 shadow-xl shadow-red-500/50' 
            : 'ring-2 ring-purple-500/30 hover:ring-purple-500/60'
          }
        `}
      >
        {/* Avatar Image */}
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.username}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
            <span className="text-4xl font-bold text-white">
              {user.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Live Overlay */}
        {user.is_live && (
          <div className="absolute inset-0 bg-gradient-to-t from-red-600/60 to-transparent flex items-end justify-center pb-2">
            <div className="flex items-center gap-1 px-2 py-0.5 bg-red-600 rounded-full">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              <span className="text-white text-xs font-bold">LIVE</span>
            </div>
          </div>
        )}

        {/* New User Badge */}
        {isNew && (
          <div className="absolute -top-1 -right-1 z-20">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full shadow-lg"
            >
              <Sparkles className="w-2 h-2 text-white" />
              <span className="text-white text-[10px] font-bold">NEW</span>
            </motion.div>
          </div>
        )}

        {/* Online Status Indicator */}
        <div className="absolute bottom-1 right-1">
          {user.is_online ? (
            <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800 flex items-center justify-center">
              <Wifi className="w-2 h-2 text-white" />
            </div>
          ) : (
            <div className="w-4 h-4 bg-slate-500 rounded-full border-2 border-slate-800 flex items-center justify-center">
              <WifiOff className="w-2 h-2 text-slate-300" />
            </div>
          )}
        </div>

        {/* Hover Glow Effect */}
        <div 
          className={`
            absolute inset-0 rounded-full transition-opacity duration-300
            ${user.is_live 
              ? 'bg-red-500/20 opacity-0 group-hover:opacity-100' 
              : 'bg-purple-500/20 opacity-0 group-hover:opacity-100'
            }
          `}
        />
      </div>

      {/* Username Below Bubble */}
      <div className="text-center mt-3">
        <h3 className="font-bold text-white text-sm truncate px-2">
          @{user.username}
        </h3>
        <div className="flex items-center justify-center gap-1 mt-1">
          {user.is_online ? (
            <span className="text-green-400 text-xs">Online</span>
          ) : (
            <span className="text-slate-500 text-xs">Offline</span>
          )}
          {user.is_live && (
            <span className="text-red-400 text-xs font-medium ml-1">
              • {user.current_viewers} viewers
            </span>
          )}
        </div>
      </div>

      {/* Hover Action Menu */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full z-30"
          >
            <div className="flex items-center gap-1 px-3 py-2 bg-slate-800/95 backdrop-blur-sm rounded-xl border border-purple-500/30 shadow-xl">
              {/* View Profile */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleViewProfile}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors"
                title="View Profile"
              >
                <Eye className="w-4 h-4" />
              </motion.button>

              {/* Message */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleMessage}
                className="p-2 rounded-lg bg-purple-500/20 text-purple-300 hover:text-white hover:bg-purple-500/40 transition-colors"
                title="Message"
              >
                <MessageCircle className="w-4 h-4" />
              </motion.button>

              {/* Invite to Family */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleInviteToFamily}
                className="p-2 rounded-lg bg-pink-500/20 text-pink-300 hover:text-white hover:bg-pink-500/40 transition-colors"
                title="Invite to Family"
              >
                <UserPlus className="w-4 h-4" />
              </motion.button>

              {/* Follow */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleFollow}
                className="p-2 rounded-lg bg-blue-500/20 text-blue-300 hover:text-white hover:bg-blue-500/40 transition-colors"
                title="Follow"
              >
                <UserMinus className="w-4 h-4" />
              </motion.button>

              {/* Watch Live (if live) */}
              {user.is_live && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/stream/${user.username}`);
                  }}
                  className="p-2 rounded-lg bg-red-500/20 text-red-300 hover:text-white hover:bg-red-500/40 transition-colors"
                  title="Watch Live"
                >
                  <Video className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default TMUserCard;

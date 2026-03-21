import { motion } from 'framer-motion';
import { MessageCircle, Eye, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TMProfileView } from '../../types/trollMatch';
import { useTMMessagePricing, useTMRecordView } from '../../hooks/useTrollMatch';
import { toast } from 'sonner';

interface TMViewerCardProps {
  viewer: TMProfileView;
  onMessage?: (userId: string, price: number) => void;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

export function TMViewerCard({ viewer, onMessage }: TMViewerCardProps) {
  const navigate = useNavigate();
  const { pricing } = useTMMessagePricing(viewer.viewer_id);
  const { recordView } = useTMRecordView();

  const handleViewProfile = async () => {
    await recordView(viewer.viewer_id);
    navigate(`/profile/${viewer.username}`);
  };

  const handleMessage = () => {
    const price = pricing?.price || 0;
    onMessage?.(viewer.viewer_id, price);
  };

  const isOnline = viewer.is_online;
  const price = pricing?.price || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 bg-slate-800/60 backdrop-blur-sm rounded-xl border border-purple-500/10 hover:border-purple-500/30 transition-all"
    >
      {/* Avatar */}
      <div 
        className="relative flex-shrink-0 cursor-pointer"
        onClick={handleViewProfile}
      >
        {viewer.avatar_url ? (
          <img 
            src={viewer.avatar_url} 
            alt={viewer.username}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-xl font-bold text-slate-400">
              {viewer.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Online indicator */}
        {isOnline && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 
          className="font-bold text-white truncate cursor-pointer hover:text-purple-400 transition-colors"
          onClick={handleViewProfile}
        >
          @{viewer.username}
        </h4>
        
        <div className="flex items-center gap-1 text-slate-400 text-sm mt-1">
          <Clock className="w-3 h-3" />
          <span>{formatTimeAgo(viewer.viewed_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleViewProfile}
          className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
          title="View Profile"
        >
          <Eye className="w-4 h-4" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleMessage}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-sm font-medium">
            {price > 0 ? `${price} 💰` : 'Message'}
          </span>
        </motion.button>
      </div>
    </motion.div>
  );
}

export default TMViewerCard;

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Video, UserPlus, Star, Heart, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TMMatch } from '../../types/trollMatch';
import { useAuthStore } from '../../lib/store';
import { useTMMessagePricing, useTMRecordView, useTMFamilyInvites } from '../../hooks/useTrollMatch';
import { toast } from 'sonner';

interface TMMatchCardProps {
  match: TMMatch;
  type: 'friends' | 'dating';
  onMessage?: (userId: string, price: number) => void;
}

export function TMMatchCard({ match, type, onMessage }: TMMatchCardProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const { pricing, loading: pricingLoading } = useTMMessagePricing(match.user_id);
  const { recordView } = useTMRecordView();
  const { createInvite } = useTMFamilyInvites();
  
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const handleViewProfile = async () => {
    // Record the view
    await recordView(match.user_id);
    navigate(`/profile/${match.username}`);
  };

  const handleMessage = () => {
    if (!user || !profile) {
      toast.error('Please log in to send messages');
      return;
    }

    // If there's a price, show the confirmation modal
    if (pricing && pricing.price > 0) {
      setShowPricingModal(true);
    } else {
      // Free message - navigate to TCPS
      onMessage?.(match.user_id, 0);
    }
  };

  const handleSendPaidMessage = async () => {
    if (!messageText.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!profile || profile.troll_coins < pricing!.price) {
      toast.error('Insufficient coins');
      navigate('/coins');
      return;
    }

    setSending(true);
    try {
      onMessage?.(match.user_id, pricing!.price);
      setShowPricingModal(false);
      setMessageText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleInviteToFamily = async () => {
    // For now, just show a toast - in real implementation, would open family selector
    toast.info('Opening family selector...');
    // TODO: Open family selector modal
  };

  const handleFollow = () => {
    toast.success(`Followed @${match.username}`);
  };

  const isOnline = match.is_online;
  const price = pricing?.price || 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        className="relative bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-purple-500/20 overflow-hidden group"
      >
        {/* Online Indicator */}
        {isOnline && (
          <div className="absolute top-3 right-3 z-10">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
          </div>
        )}

        {/* Avatar */}
        <div 
          className="relative h-40 bg-gradient-to-br from-purple-900/50 to-pink-900/50 cursor-pointer"
          onClick={handleViewProfile}
        >
          {match.avatar_url ? (
            <img 
              src={match.avatar_url} 
              alt={match.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-3xl font-bold text-slate-400">
                  {match.username.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Glow effect for online users */}
          {isOnline && (
            <div className="absolute inset-0 bg-gradient-to-t from-green-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Username */}
          <h3 
            className="font-bold text-white text-lg cursor-pointer hover:text-purple-400 transition-colors"
            onClick={handleViewProfile}
          >
            @{match.username}
          </h3>

          {/* Match Score */}
          {match.match_score > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-purple-400 font-medium">
                {match.match_score}% Match
              </span>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${
                      i < Math.ceil(match.match_score / 20) 
                        ? 'bg-purple-500' 
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Shared Interests */}
          {match.shared_interests && match.shared_interests.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {match.shared_interests.slice(0, 3).map((interest) => (
                <span 
                  key={interest}
                  className="px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-300 rounded-full"
                >
                  {interest}
                </span>
              ))}
              {match.shared_interests.length > 3 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-slate-700 text-slate-400 rounded-full">
                  +{match.shared_interests.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Dating indicator */}
          {type === 'dating' && (
            <div className="flex items-center gap-1 mt-3 text-pink-400">
              <Heart className="w-4 h-4" />
              <span className="text-xs font-medium">Dating</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleMessage}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                {price > 0 ? `${price} 💰` : 'Message'}
              </span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleViewProfile}
              className="p-2 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
              title="View Profile"
            >
              <Eye className="w-4 h-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleInviteToFamily}
              className="p-2 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
              title="Invite to Family"
            >
              <UserPlus className="w-4 h-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleFollow}
              className="p-2 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
              title="Follow"
            >
              <Star className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Pricing Modal */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-slate-800 rounded-2xl border border-purple-500/20 overflow-hidden"
          >
            <div className="p-6 bg-gradient-to-r from-purple-600 to-pink-600">
              <h3 className="text-xl font-bold text-white">Send Message</h3>
              <p className="text-purple-100 text-sm mt-1">
                This user charges {price} coins per message
              </p>
            </div>

            <div className="p-6">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Write your message..."
                className="w-full h-32 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 resize-none"
              />

              <div className="flex items-center justify-between mt-4 p-3 bg-slate-700/50 rounded-xl">
                <span className="text-slate-300">Price:</span>
                <span className="text-xl font-bold text-white">{price} 💰</span>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowPricingModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendPaidMessage}
                  disabled={sending || !messageText.trim()}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50"
                >
                  {sending ? 'Sending...' : `Send - ${price} Coins`}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

export default TMMatchCard;

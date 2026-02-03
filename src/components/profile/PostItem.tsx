import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { Heart, MessageCircle, Gift, Share2, Trash2, Smile } from 'lucide-react';

import { toast } from 'sonner';
import UserNameWithAge from '../UserNameWithAge';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import GiftModal from '../trollWall/GiftModal';

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  user_profiles: {
    username: string;
    avatar_url: string | null;
    created_at?: string;
  };
  replies?: Comment[];
  likes_count?: number; // Future proofing
}

interface PostItemProps {
  post: any;
  onDelete?: (id: string) => void;
}

export default function PostItem({ post, onDelete }: PostItemProps) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [_loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [liked, setLiked] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [_gifting, setGifting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setCommentText(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Check if user liked this post on mount
  useEffect(() => {
    if (user && post.id) {
        supabase
            .from('troll_post_reactions')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', user.id)
            .eq('reaction_type', 'like')
            .maybeSingle()
            .then(({ data }) => {
                if (data) setLiked(true);
            });
    }
  }, [user, post.id]);

  const toggleLike = async () => {
    if (!user) {
        toast.error('Login to like');
        return;
    }

    // Optimistic update
    const previousLiked = liked;
    const previousCount = likesCount;
    setLiked(!liked);
    setLikesCount(prev => liked ? prev - 1 : prev + 1);

    try {
        const { data, error } = await supabase.rpc('toggle_post_like', {
            p_post_id: post.id
        });

        if (error) throw error;
        if (data && data.success) {
            setLiked(data.liked);
            setLikesCount(data.count);
        } else {
             // Revert
             setLiked(previousLiked);
             setLikesCount(previousCount);
        }
    } catch (err) {
        console.error('Error toggling like:', err);
        setLiked(previousLiked);
        setLikesCount(previousCount);
        toast.error('Failed to like post');
    }
  };

  // Load comments
  const loadComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }
    
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('troll_post_comments')
        .select(`
          *,
          user_profiles (username, avatar_url, created_at)
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Organize into tree
      const commentMap = new Map<string, Comment>();
      const rootComments: Comment[] = [];

      data?.forEach((c: any) => {
        c.replies = [];
        commentMap.set(c.id, c);
      });

      data?.forEach((c: any) => {
        if (c.parent_id) {
          const parent = commentMap.get(c.parent_id);
          if (parent) {
            parent.replies?.push(c);
          } else {
            rootComments.push(c); // Orphaned or parent not found, treat as root
          }
        } else {
          rootComments.push(c);
        }
      });

      setComments(rootComments);
      setShowComments(true);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    if (!user) {
      toast.error('Login to comment');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('troll_post_comments')
        .insert({
          post_id: post.id,
          user_id: user.id,
          content: commentText.trim(),
          parent_id: replyingTo?.id || null
        })
        .select(`
          *,
          user_profiles (username, avatar_url, created_at)
        `)
        .single();

      if (error) throw error;

      // Add to local state
      const newComment = { ...data, replies: [] } as Comment;
      
      if (replyingTo) {
        // Find parent and append (this is tricky with recursive state, simplified for now: reload or naive append)
        // For deep nesting, it's easier to reload or flatten. 
        // Let's just reload for correctness or try to append if simple.
         // A simple reload is safer for now to ensure tree structure
         loadComments();
         setShowComments(true); // Ensure open
      } else {
        setComments([...comments, newComment]);
      }

      setCommentText('');
      setReplyingTo(null);
      toast.success('Comment posted');
    } catch (err) {
      console.error('Error posting comment:', err);
      toast.error('Failed to post comment');
    }
  };

  const handleGift = async (amount: number) => {
    if (!user) return toast.error('Login to gift');
    setGifting(true);
    try {
      const { data, error } = await supabase.rpc('gift_post', {
        p_post_id: post.id,
        p_amount: amount,
        p_message: 'Loved your post!'
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      toast.success(`Gifted ${amount} coins!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to gift');
    } finally {
      setGifting(false);
    }
  };

  const handleGiftSent = async (giftType: string, cost: number) => {
    await handleGift(cost);
    setShowGiftModal(false);
  };

  const CommentNode = ({ comment, depth = 0 }: { comment: Comment, depth?: number }) => (
    <div className={`flex gap-3 mb-4 ${depth > 0 ? 'ml-8 relative' : ''}`}>
      {depth > 0 && (
         <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-white/10 rounded-full" />
      )}
      <div className="flex-shrink-0">
         {comment.user_profiles?.avatar_url ? (
            <img 
              src={comment.user_profiles.avatar_url} 
              alt={comment.user_profiles.username} 
              className="w-8 h-8 rounded-full object-cover border border-white/10"
            />
         ) : (
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white">
                {comment.user_profiles?.username?.substring(0, 2).toUpperCase()}
            </div>
         )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-white/5 rounded-2xl px-4 py-2 inline-block max-w-full">
            <div className="font-bold text-sm text-white block">
              <UserNameWithAge 
                user={{
                  username: comment.user_profiles?.username,
                  id: comment.user_id,
                  ...comment.user_profiles
                }}
              />
            </div>
            <p className="text-sm text-gray-200 break-words">{comment.content}</p>
        </div>
        <div className="flex items-center gap-4 mt-1 ml-2 text-xs text-gray-400 font-medium">
            <span>{new Date(comment.created_at).toLocaleDateString()}</span>
            {/* <button className="hover:text-white">Like</button> */}
            <button 
                onClick={() => {
                    setReplyingTo(comment);
                    const input = document.getElementById(`comment-input-${post.id}`);
                    if (input) input.focus();
                }}
                className="hover:text-white text-gray-400"
            >
                Reply
            </button>
        </div>

        {/* Nested Replies */}
        {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3">
                {comment.replies.map(reply => (
                    <CommentNode key={reply.id} comment={reply} depth={depth + 1} />
                ))}
            </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4 mb-4 hover:border-purple-500/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 p-0.5">
              {post.user_profiles?.avatar_url ? (
                <img 
                  src={post.user_profiles.avatar_url} 
                  className="w-full h-full rounded-full object-cover bg-black" 
                  alt={post.user_profiles.username}
                />
              ) : (
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-white font-bold">
                    {post.user_profiles?.username?.substring(0, 2).toUpperCase()}
                </div>
              )}
           </div>
           <div>
              <UserNameWithAge 
                user={{
                  username: post.user_profiles?.username,
                  id: post.user_id,
                  ...post.user_profiles
                }}
                className="font-bold text-white hover:text-purple-400"
              />
              <div className="text-xs text-gray-400">{new Date(post.created_at).toLocaleString()}</div>
           </div>
        </div>
        
        {user?.id === post.user_id && onDelete && (
            <button onClick={() => onDelete(post.id)} className="text-gray-500 hover:text-red-500 p-1">
                <Trash2 className="w-4 h-4" />
            </button>
        )}
      </div>

      {/* Content */}
      <div className="mb-4 text-gray-100 whitespace-pre-wrap leading-relaxed">
        {post.content}
      </div>
      
      {post.image_url && (
        <div className="mb-4 rounded-lg overflow-hidden border border-white/10 bg-black/50">
            <img src={post.image_url} alt="Post content" className="w-full max-h-[500px] object-contain" />
        </div>
      )}

      {post.video_url && (
        <div className="mb-4 rounded-lg overflow-hidden border border-white/10 bg-black/50">
            <video src={post.video_url} controls className="w-full max-h-[400px] object-contain" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-white/5 pt-3 mb-2">
        <button 
            className={`flex-1 flex items-center justify-center gap-2 py-2 hover:bg-white/5 rounded-lg transition-colors ${liked ? 'text-pink-500' : 'text-gray-400 hover:text-pink-500'}`}
            onClick={toggleLike}
        >
            <Heart className={`w-5 h-5 ${liked ? 'fill-pink-500' : ''}`} />
            <span className="text-sm">{likesCount} Likes</span>
        </button>
        
        <button 
            className="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-blue-400 transition-colors"
            onClick={loadComments}
        >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">Comment</span>
        </button>

        <button 
            className="flex-1 px-4 flex items-center justify-center gap-2 py-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-yellow-400 transition-colors"
            onClick={() => setShowGiftModal(true)}
        >
            <Gift className="w-5 h-5" />
            <span className="text-sm">Gift</span>
        </button>
      </div>

      {showGiftModal && (
        <GiftModal 
            postId={post.id}
            onClose={() => setShowGiftModal(false)}
            onGiftSent={handleGiftSent}
        />
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2">
            {/* Input */}
            <div className="flex gap-3 mb-6">
                 <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0" />
                 <div className="flex-1">
                    {replyingTo && (
                        <div className="flex items-center justify-between text-xs text-blue-400 mb-1 bg-blue-500/10 px-2 py-1 rounded">
                            <span>Replying to @{replyingTo.user_profiles?.username}</span>
                            <button onClick={() => setReplyingTo(null)} className="hover:text-white"><XIcon className="w-3 h-3" /></button>
                        </div>
                    )}
                    <div className="relative">
                        <input
                            ref={inputRef}
                            id={`comment-input-${post.id}`}
                            type="text"
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handlePostComment()}
                            placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                            className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-20 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <div className="relative" ref={emojiPickerRef}>
                                <button 
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className="p-1.5 text-gray-400 hover:text-yellow-400 transition-colors"
                                >
                                    <Smile className="w-4 h-4" />
                                </button>
                                {showEmojiPicker && (
                                    <div className="absolute bottom-full right-0 mb-2 z-50">
                                        <EmojiPicker 
                                            onEmojiClick={onEmojiClick}
                                            theme={Theme.DARK}
                                            width={300}
                                            height={400}
                                        />
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={handlePostComment}
                                className="p-1.5 text-purple-400 hover:text-purple-300 transition-colors"
                            >
                                <Share2 className="w-4 h-4 rotate-90" />
                            </button>
                        </div>
                    </div>
                 </div>
            </div>

            {/* List */}
            <div className="space-y-4">
                {comments.map(comment => (
                    <CommentNode key={comment.id} comment={comment} />
                ))}
            </div>
        </div>
      )}
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M18 6 6 18"/><path d="m6 6 18 18"/>
        </svg>
    )
}

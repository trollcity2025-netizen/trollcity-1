import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import PostItem from './PostItem';
import { Image, Send, Smile, X, Loader2 } from 'lucide-react';

import { toast } from 'sonner';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

interface ProfileFeedProps {
  userId: string;
}

export default function ProfileFeed({ userId }: ProfileFeedProps) {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast.error('File size must be less than 50MB');
        return;
    }

    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
    if (!type) {
        toast.error('Invalid file type. Please upload an image or video.');
        return;
    }

    setMediaFile(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaType(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setContent(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };


  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('troll_posts')
        .select(`
            *,
            user_profiles (username, avatar_url, created_at),
            likes_count: troll_post_reactions(count),
            comments_count: troll_post_comments(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Transform data if needed (e.g. likes_count is array of objects)
      const formattedPosts = data?.map(post => ({
         ...post,
         likes_count: post.likes_count?.[0]?.count || 0,
         comments_count: post.comments_count?.[0]?.count || 0
      }));

      setPosts(formattedPosts || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel(`profile-feed-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'troll_posts', filter: `user_id=eq.${userId}` },
        () => fetchPosts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchPosts]);

  const handleCreatePost = async () => {
    if (!content.trim() && !mediaFile) return;
    if (!user) return toast.error('Login to post');

    setIsPosting(true);
    try {
      let mediaUrl = null;
      let postType = 'text';

      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(fileName, mediaFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('post-media')
          .getPublicUrl(fileName);
          
        mediaUrl = publicUrl;
        postType = mediaType || 'image';
      }

      const postData: any = {
        user_id: user.id,
        content: content.trim(),
        post_type: postType
      };

      if (postType === 'image') postData.image_url = mediaUrl;
      if (postType === 'video') postData.video_url = mediaUrl;

      const { error } = await supabase
        .from('troll_posts')
        .insert(postData);

      if (error) throw error;
      
      setContent('');
      clearMedia();
      toast.success('Post created!');
      fetchPosts(); // Refresh immediately
    } catch (err: any) {
      console.error('Post error:', err);
      toast.error(err.message || 'Failed to post');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
        const { error } = await supabase
            .from('troll_posts')
            .delete()
            .eq('id', postId);
        
        if (error) throw error;
        toast.success('Post deleted');
        setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error('Failed to delete post', err);
      toast.error('Failed to delete post');
    }

  };

  return (
    <div className="max-w-2xl mx-auto py-4">
      {/* Create Post Input */}
      {user?.id === userId && (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4 mb-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 p-0.5 flex-shrink-0">
               <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-white font-bold">
                  {(user.user_metadata?.username || user.email || 'U').substring(0, 2).toUpperCase()}
               </div>
            </div>
            <div className="flex-1 relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none min-h-[80px]"
              />
              
              {mediaPreview && (
                <div className="relative mb-4 mt-2 rounded-lg overflow-hidden bg-black/50 border border-white/10 inline-block">
                  <button 
                    onClick={clearMedia}
                    className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors z-10"
                  >
                    <X size={16} />
                  </button>
                  {mediaType === 'image' ? (
                    <img src={mediaPreview} alt="Preview" className="max-h-60 rounded-lg object-contain" />
                  ) : (
                    <video src={mediaPreview} className="max-h-60 rounded-lg" controls />
                  )}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2 relative">
                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*,video/*"
                        className="hidden"
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 hover:bg-white/5 rounded-full text-green-400 transition-colors"
                        title="Upload Image/Video"
                    >
                        <Image className="w-5 h-5" />
                    </button>
                    <div className="relative" ref={emojiPickerRef}>
                        <button 
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="p-2 hover:bg-white/5 rounded-full text-yellow-400 transition-colors"
                        >
                            <Smile className="w-5 h-5" />
                        </button>
                        {showEmojiPicker && (
                            <div className="absolute top-full left-0 mt-2 z-50">
                                <EmojiPicker
                                    onEmojiClick={onEmojiClick}
                                    theme={Theme.DARK}
                                    width={300}
                                    height={400}
                                />
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={handleCreatePost}
                    disabled={isPosting || (!content.trim() && !mediaFile)}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all"
                >
                    {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-10 text-gray-500 bg-white/5 rounded-xl border border-white/5">
            No posts yet. Be the first to share something!
        </div>
      ) : (
        <div className="space-y-4">
            {posts.map(post => (
                <PostItem key={post.id} post={post} onDelete={handleDeletePost} />
            ))}
        </div>
      )}
    </div>
  );
}

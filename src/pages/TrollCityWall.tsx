import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";
import ClickableUsername from "../components/ClickableUsername";
import { PlusCircle } from "lucide-react";

const TrollCityWall: React.FC = () => {
  const { user, profile } = useAuthStore();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from("troll_posts")
        .select(`
          id, user_id, content, image_url, coins_earned, created_at,
          user_profiles!user_id(username, avatar_url)
        `)
        .order("created_at", { ascending: false });
      setPosts(data || []);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    if (!content.trim() && !imageFile) {
      toast.error("Please add some content or an image");
      return;
    }
    if (!user || !profile) {
      toast.error("You must be logged in");
      return;
    }

    setCreating(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(fileName, imageFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      const { error } = await supabase
        .from("troll_posts")
        .insert({
          user_id: user.id,
          content: content.trim(),
          image_url: imageUrl,
          coins_earned: 0
        });

      if (error) throw error;

      toast.success("Post created!");
      setContent("");
      setImageFile(null);
      setShowCreateModal(false);
      loadPosts();
    } catch (error: any) {
      console.error("Error creating post:", error);
      toast.error("Failed to create post");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  return (
    <div className="min-h-screen bg-[#06010F] text-white">
      {/* Header */}
      <div className="sticky top-0 bg-[#070113]/90 backdrop-blur-xl p-5 shadow-[0_0_25px_rgba(124,0,245,0.6)] z-20">
        <h1 className="text-3xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text drop-shadow-lg">
          🧌 Troll City Wall
        </h1>
        <p className="text-sm text-gray-400">Share. Troll. Gift. Earn.</p>
      </div>

      {/* Feed */}
      <div className="max-w-3xl mx-auto p-5 space-y-6">
        {loading ? (
          <p className="text-center text-gray-500 animate-pulse">
            Loading Troll City…
          </p>
        ) : posts.length === 0 ? (
          <p className="text-center text-gray-500">No posts yet 👹</p>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="bg-black/60 border border-purple-800/40 rounded-xl p-5 shadow-[0_0_15px_rgba(150,50,220,0.3)] hover:shadow-[0_0_30px_rgba(150,50,220,0.6)] transition-all"
            >
              {/* User Header */}
              <div className="flex items-center mb-3">
                <img
                  src={
                    post.user_profiles?.[0]?.avatar_url ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${post.user_profiles?.[0]?.username}`
                  }
                  className="w-10 h-10 rounded-full border border-green-400 shadow-[0_0_10px_rgba(0,255,150,0.4)]"
                />
                <div className="ml-3">
                  <ClickableUsername
                    username={post.user_profiles?.[0]?.username || "Unknown"}
                    className="text-lg font-semibold text-green-300 drop-shadow"
                  />
                  <p className="text-xs text-gray-500">
                    {new Date(post.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Post Content */}
              {post.content && (
                <p className="text-sm text-gray-200 whitespace-pre-line mb-3">
                  {post.content}
                </p>
              )}

              {/* Post Image */}
              {post.image_url && (
                <img
                  src={post.image_url}
                  className="rounded-xl mb-3 max-h-[450px] w-full object-cover shadow-[0_0_15px_rgba(0,255,255,0.3)]"
                />
              )}

              {/* Metrics & Actions */}
              <div className="flex justify-between items-center text-xs mt-3">
                <span className="text-gray-400">
                  💰 {post.coins_earned} Coins Earned
                </span>
                <button className="px-3 py-1 bg-gradient-to-r from-purple-600 to-green-500 rounded-full shadow-[0_0_10px_rgba(120,0,200,0.8)]">
                  🎁 Send Troll Heart
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Create Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-br from-green-400 to-purple-500 p-4 rounded-full shadow-[0_0_30px_rgba(140,0,240,0.9)] hover:scale-110 transition"
      >
        <PlusCircle className="text-black" size={32} />
      </button>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center p-6">
          <div className="bg-[#08010A] p-6 rounded-xl border border-purple-600 w-full max-w-md shadow-[0_0_40px_rgba(130,0,200,0.6)]">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-black/50 border border-purple-600 p-3 rounded-lg mb-3 text-sm"
              placeholder="Speak to Troll City..."
            />
            <input
              type="file"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="w-full bg-black/50 border border-purple-600 p-2 rounded-lg mb-3 text-sm"
            />
            <div className="flex justify-between">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={creating}
                onClick={createPost}
                className="px-4 py-2 bg-gradient-to-br from-green-400 to-purple-500 text-black rounded-lg font-semibold"
              >
                {creating ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrollCityWall;

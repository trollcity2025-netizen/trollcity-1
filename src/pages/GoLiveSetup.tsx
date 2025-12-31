import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";

const CATEGORIES = [
  "Just Chatting",
  "Tromody Show",
  "Troll Family",
  "Music",
  "Gaming",
  "Entertainment",
  "Sleep",
];

const SLEEP_COST_PER_HOUR = 30;

export default function GoLiveSetup() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [streamTitle, setStreamTitle] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [messagePrice, setMessagePrice] = useState(0);
  const [profileViewPrice, setProfileViewPrice] = useState(0);
  const [guestBoxPrice, setGuestBoxPrice] = useState(0);
  const [sleepDuration, setSleepDuration] = useState(1);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setThumbnailPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadThumbnail = async (): Promise<string | null> => {
    if (!thumbnailFile || !user?.id) return null;

    setUploadingThumbnail(true);
    try {
      const fileExt = thumbnailFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `stream-thumbnails/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(filePath, thumbnailFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      return null;
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleStartGoLive = async () => {
    if (!selectedCategory || !streamTitle.trim()) {
      alert("Please select a category and enter a stream title");
      return;
    }

    setIsStarting(true);

    try {
      // Upload thumbnail if provided
      let thumbnailUrl = null;
      if (thumbnailFile) {
        thumbnailUrl = await uploadThumbnail();
      }

      // Create stream record in database
      const { data: streamData, error } = await supabase
        .from('streams')
        .insert({
          title: streamTitle,
          category: selectedCategory,
          broadcaster_id: user?.id,
          is_live: true,
          start_time: new Date().toISOString(),
          thumbnail_url: thumbnailUrl,
          pricing_type: messagePrice > 0 || profileViewPrice > 0 || guestBoxPrice > 0 ? 'paid' : 'free',
          pricing_value: Math.max(messagePrice, profileViewPrice, guestBoxPrice),
        })
        .select()
        .single();

      if (error) throw error;

      navigate(`/live/${streamData.id}`, {
        state: {
          category: selectedCategory,
          title: streamTitle,
          pricing: {
            messagePrice,
            profileViewPrice,
            guestBoxPrice,
          },
          sleepDuration: selectedCategory === "Sleep" ? sleepDuration : 0,
          sleepCost: selectedCategory === "Sleep" ? sleepDuration * SLEEP_COST_PER_HOUR : 0,
        },
      });
    } catch (error) {
      console.error('Error creating stream:', error);
      alert('Failed to start stream. Please try again.');
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 flex items-center justify-center p-4">
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }

        .purple-neon {
          border: 2px solid #A78BFA;
          box-shadow: 0 0 15px rgba(167, 139, 250, 0.6), inset 0 0 15px rgba(167, 139, 250, 0.2);
        }

        .purple-neon:hover {
          box-shadow: 0 0 25px rgba(167, 139, 250, 0.8), inset 0 0 15px rgba(167, 139, 250, 0.3);
        }
      `}</style>

      <div className="w-full max-w-2xl animate-fadeIn">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Video size={40} className="text-purple-400" />
            <h1 className="text-4xl font-bold text-white">Go Live</h1>
          </div>
          <p className="text-gray-400 text-lg">Set up your broadcast</p>
        </div>

        <div className="bg-gray-900/80 rounded-xl p-8 purple-neon">
          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">
              Stream Title
            </label>
            <input
              type="text"
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              placeholder="Enter your stream title..."
              className="w-full bg-gray-800 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
              maxLength={100}
            />
            <p className="text-xs text-gray-500 mt-1">{streamTitle.length}/100</p>
           </div>

           <div className="mb-8">
             <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">
               Stream Thumbnail (Optional)
             </label>
             <div className="flex items-center gap-4">
               <div className="flex-1">
                 <input
                   type="file"
                   accept="image/*"
                   onChange={handleThumbnailChange}
                   className="w-full bg-gray-800 border border-purple-500/30 rounded-lg px-4 py-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 transition"
                 />
                 <p className="text-xs text-gray-500 mt-1">Recommended: 1280x720px, max 5MB</p>
               </div>
               {thumbnailPreview && (
                 <div className="w-24 h-16 rounded-lg overflow-hidden border border-purple-500/30">
                   <img
                     src={thumbnailPreview}
                     alt="Thumbnail preview"
                     className="w-full h-full object-cover"
                   />
                 </div>
               )}
             </div>
             {uploadingThumbnail && (
               <p className="text-xs text-purple-400 mt-2">Uploading thumbnail...</p>
             )}
           </div>

           <div className="mb-8">
            <label className="block text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">
              Category
            </label>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`p-4 rounded-lg font-semibold transition-all text-center ${
                    selectedCategory === category
                      ? "bg-purple-600 text-white border-2 border-purple-400 shadow-lg shadow-purple-500/50"
                      : "bg-gray-800 text-gray-300 border-2 border-transparent hover:border-purple-500/50"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {selectedCategory === "Sleep" && (
            <div className="mb-8 p-4 rounded-lg bg-purple-900/30 border border-purple-500/30">
              <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">
                Sleep Duration (Hours)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={sleepDuration}
                  onChange={(e) => setSleepDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  className="flex-1 bg-gray-800 border border-purple-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition"
                />
                <div className="text-right">
                  <p className="text-xs text-gray-400">Cost per hour:</p>
                  <p className="text-lg font-bold text-yellow-400">{SLEEP_COST_PER_HOUR} 🪙</p>
                </div>
              </div>
              <p className="text-sm text-purple-300 mt-3">
                Total cost: <span className="font-bold">{sleepDuration * SLEEP_COST_PER_HOUR} coins</span>
              </p>
            </div>
          )}

          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">
              Pricing Settings
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Message Price</label>
                <input
                  type="number"
                  value={messagePrice}
                  onChange={(e) => setMessagePrice(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full bg-gray-800 border border-purple-500/30 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
                  min="0"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Profile View Price</label>
                <input
                  type="number"
                  value={profileViewPrice}
                  onChange={(e) => setProfileViewPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full bg-gray-800 border border-purple-500/30 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
                  min="0"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Guest Box Price</label>
                <input
                  type="number"
                  value={guestBoxPrice}
                  onChange={(e) => setGuestBoxPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full bg-gray-800 border border-purple-500/30 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
                  min="0"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleStartGoLive}
            disabled={isStarting || !selectedCategory || !streamTitle.trim()}
            className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${
              isStarting || !selectedCategory || !streamTitle.trim()
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 purple-neon"
            }`}
          >
            {isStarting ? (
              <>
                <div className="animate-spin">
                  <Video size={20} />
                </div>
                Starting...
              </>
            ) : (
              <>
                Start Broadcasting
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          You'll be able to invite guests and manage your stream once you go live
        </p>
      </div>
    </div>
  );
}

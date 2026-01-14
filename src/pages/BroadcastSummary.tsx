import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Gift, Heart, Users, AlertCircle, TrendingUp, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";

interface StreamSummaryState {
  title: string;
  category: string;
  duration: number;
  totalGifts: number;
  totalCoins: number;
  viewerCount: number;
  newFollowers: string[];
  reports: string[];
  violations: number;
  level: number;
  recording_url?: string | null;
  peakViewers?: number | null;
}

interface StreamRowUpdate {
  title?: string | null;
  category?: string | null;
  total_gifts_coins?: number | null;
  current_viewers?: number | null;
  peak_viewers?: number | null;
  recording_url?: string | null;
}


export default function BroadcastSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { streamId } = useParams();
  const [loading, setLoading] = useState(false);
  const [streamData, setStreamData] = useState<StreamSummaryState | null>(
    (location.state as StreamSummaryState | null) || null
  );
  const [coinRate, setCoinRate] = useState({
    usdPerCoin: 0.00449,
    coinsPerDollar: 222,
    per100Usd: 0.45,
    packageLabel: "Bronze Pack"
  });
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!streamData && streamId) {
      const fetchStreamSummary = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('streams')
            .select('*')
            .eq('id', streamId)
            .single();

          if (error) throw error;

          if (data) {
             // Transform DB data to summary format if needed
             // For now, we map what we can. 
             // Note: real earnings/gifts stats might need a separate query if not in 'streams' table.
             // But for now, we'll use what's in the stream record or defaults.
             
             // Calculate duration
             const start = new Date(data.start_time);
             const end = data.end_time ? new Date(data.end_time) : new Date();
             const duration = (end.getTime() - start.getTime()) / 1000; // seconds

            setStreamData({
              title: data.title || "Stream Summary",
              category: data.category || "General",
              duration: duration,
              totalGifts: data.total_gifts_coins || 0, // Assuming this field stores gifts count or value
              totalCoins: data.total_gifts_coins || 0, // Simplify for now
              viewerCount: data.peak_viewers || data.current_viewers || 0,
              newFollowers: [], // Would need separate query
              reports: [], // Would need separate query
               violations: 0,
               level: 1, // Default
               recording_url: data.recording_url
             });
          }
        } catch (error) {
          console.error('Error fetching stream summary:', error);
          toast.error('Failed to load stream summary');
        } finally {
          setLoading(false);
        }
      };
      fetchStreamSummary();
    }
  }, [streamId, streamData]);

  useEffect(() => {
    let mounted = true;
    const loadCoinRate = async () => {
      try {
        const { data, error } = await supabase
          .from("coin_packages")
          .select("coins, price_usd, coin_amount, price, name")
          .eq("is_active", true)
          .order("coins", { ascending: true })
          .limit(1);

        if (error) throw error;

        const pkg = data?.[0];
        const coins = pkg?.coins ?? pkg?.coin_amount;
        const price = pkg?.price_usd ?? pkg?.price;

        if (!coins || !price) return;

        const usdPerCoin = Number(price) / Number(coins);
        const coinsPerDollar = usdPerCoin > 0 ? Math.round(1 / usdPerCoin) : 0;
        const per100Usd = usdPerCoin * 100;

        if (mounted) {
          setCoinRate({
            usdPerCoin,
            coinsPerDollar,
            per100Usd,
            packageLabel: pkg?.name || "Coin Pack",
          });
        }
      } catch (err) {
        console.error("Failed to load coin rate", err);
      }
    };

    void loadCoinRate();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!streamId) return;
    const channel = supabase
      .channel(`stream-summary-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "streams",
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          const updated = payload.new as StreamRowUpdate;
          if (!updated) return;
          setStreamData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              ...{
                title: updated.title || prev.title,
                category: updated.category || prev.category,
                totalGifts: updated.total_gifts_coins ?? prev.totalGifts,
                totalCoins: updated.total_gifts_coins ?? prev.totalCoins,
                viewerCount: updated.current_viewers ?? prev.viewerCount,
                peakViewers: updated.peak_viewers ?? prev.peakViewers,
                recording_url: updated.recording_url ?? prev.recording_url,
              },
            };
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [streamId]);

  const [downloadLoading, setDownloadLoading] = useState(false);

  const data: StreamSummaryState = streamData || {
    title: "My Stream",
    category: "Just Chatting",
    duration: 3600,
    totalGifts: 2450,
    totalCoins: 12500,
    viewerCount: 245,
    newFollowers: ["User123", "StreamFan", "TrollKing"],
    reports: ["Toxicity"],
    violations: 0,
    level: 5,
    recording_url: null,
  };

  const coinsPerDollar = coinRate.coinsPerDollar || 100;
  const usdPerCoin = coinRate.usdPerCoin || 0.01;
  const estimatedEarnings = ((data.totalCoins || 0) * usdPerCoin).toFixed(2);
  const per100Usd = coinRate.per100Usd.toFixed(2);

  const handleDownload = async () => {
    if (!data.recording_url) {
      toast.info("Recording is still processing. Please check back later.");
      return;
    }

    setDownloadLoading(true);
    try {
      const response = await fetch(data.recording_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch recording: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const fallbackName = "trollcity-recording";
      const rawName = data.title ? data.title.replace(/[^\w\d_-]/g, "-") : fallbackName;
      const extensionMatch = data.recording_url.split(/[#?]/)[0].split(".").pop();
      const filename = `${rawName}.${extensionMatch ?? "mp4"}`;

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading recording:", error);
      toast.error("Unable to download the recording right now. Please try again later.");
    } finally {
      setDownloadLoading(false);
    }
  };

  const durationMinutes = Math.floor(data.duration / 60);
  const durationHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Loading summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white p-4">

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 animate-slideIn">
          <h1 className="text-4xl font-black mb-2 text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
            Stream Summary
          </h1>
          <p className="text-gray-400">Thanks for streaming with us!</p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-slideIn">
          {/* Earnings */}
          <div className="bg-gray-900/80 rounded-lg p-6 purple-neon">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp size={24} className="text-green-400" />
              <h3 className="text-lg font-bold">Earnings</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Coins Earned</span>
                <span className="font-bold text-yellow-400">{data.totalCoins.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Estimated USD</span>
                <span className="font-bold text-green-400">${estimatedEarnings}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Rate</span>
                <span>{coinsPerDollar.toLocaleString()} coins = $1</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>100 coins</span>
                <span>${per100Usd}</span>
              </div>
            </div>
          </div>

          {/* Stream Info */}
          <div className="bg-gray-900/80 rounded-lg p-6 purple-neon">
            <div className="flex items-center gap-3 mb-4">
              <Users size={24} className="text-blue-400" />
              <h3 className="text-lg font-bold">Stream Info</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Category</span>
                <span className="font-bold">{data.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Duration</span>
                <span className="font-bold">
                  {durationHours}h {remainingMinutes}m
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Peak Viewers</span>
                <span className="font-bold">{data.viewerCount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Gifts */}
          <div className="bg-gray-900/80 rounded-lg p-6 purple-neon">
            <div className="flex items-center gap-3 mb-4">
              <Gift size={24} className="text-pink-400" />
              <h3 className="text-lg font-bold">Gifts Received</h3>
            </div>
            <div className="text-3xl font-bold text-pink-400 mb-2">
              {data.totalGifts.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400">Total gifts sent during stream</p>
          </div>

          {/* Performance */}
          <div className="bg-gray-900/80 rounded-lg p-6 purple-neon">
            <div className="flex items-center gap-3 mb-4">
              <Heart size={24} className="text-red-400" />
              <h3 className="text-lg font-bold">Performance</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Level</span>
                <span className="font-bold text-purple-300">Level {data.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Violations</span>
                <span className={`font-bold ${data.violations === 0 ? "text-green-400" : "text-red-400"}`}>
                  {data.violations}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* New Followers */}
        {data.newFollowers.length > 0 && (
          <div className="bg-gray-900/80 rounded-lg p-6 purple-neon mb-6 animate-slideIn">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users size={20} />
              New Followers ({data.newFollowers.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.newFollowers.map((follower, idx) => (
                <div
                  key={idx}
                  className="bg-gray-800/50 rounded p-3 text-center text-sm font-semibold text-purple-300 hover:bg-gray-800 transition"
                >
                  {follower}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reports */}
        {data.reports.length > 0 && (
          <div className="bg-gray-900/80 rounded-lg p-6 border-2 border-red-600/50 mb-6 animate-slideIn">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-400">
              <AlertCircle size={20} />
              Reports ({data.reports.length})
            </h3>
            <div className="space-y-2">
              {data.reports.map((report, idx) => (
                <div key={idx} className="bg-red-900/20 rounded p-3 text-sm text-red-300">
                  • {report}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center animate-slideIn">
          <button
            onClick={() => navigate("/go-live")}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition purple-neon"
          >
            Go Live Again
          </button>
          <button
            onClick={handleDownload}
            disabled={downloadLoading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg font-bold transition flex items-center gap-2"
          >
            <Download size={20} />
            {downloadLoading ? "Saving..." : "Download"}
          </button>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
          >
            Return Home
          </button>
        </div>
      </div>
    </div>
  );
}

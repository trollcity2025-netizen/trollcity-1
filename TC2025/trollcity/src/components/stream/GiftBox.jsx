import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Gift } from "lucide-react";
import { GIFTS, generateRandomGifts, getGiftById, recordGiftTransaction } from "@/lib/gifts";
import { debitCoins, debitPurchasedCoinsWithNegative } from "@/lib/coins";
import { supabase } from "@/api/supabaseClient";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const GiftBox = ({ userId, streamId, streamerId, streamerName, onGiftSent }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [displayGifts, setDisplayGifts] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const openGiftBox = () => {
    // Generate 30 random gifts from the catalog
    const randomGifts = generateRandomGifts(30);
    setDisplayGifts(randomGifts);
    setIsOpen(true);
  };

  const handleSendGift = async (gift) => {
    if (!userId) {
      toast.error("Please log in first");
      return;
    }

    if (!streamId) {
      toast.error("Stream not found");
      return;
    }

    setIsSending(true);
    try {
      // Get user's coin balance
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("coins, purchased_coins, free_coins")
        .eq("id", userId)
        .single();

      if (profileErr) throw profileErr;

      // Try to debit coins using the new negative coin system
      let debitResult;
      try {
        debitResult = await debitPurchasedCoinsWithNegative(userId, gift.value, {
          reason: "gift_sent",
          source: "stream_gift",
          reference: streamId,
        });
        
        // Check if user needs to be redirected to store
        if (debitResult.needsStoreRedirect) {
          toast.error("Insufficient coins. Redirecting to store...");
          setTimeout(() => navigate('/store'), 2000);
          setIsSending(false);
          return;
        }
      } catch (debitError) {
        // Fallback to regular debitCoins if the new function fails
        if ((profile?.coins || 0) < gift.value) {
          toast.error(`Insufficient coins. Need ${gift.value}, you have ${profile?.coins || 0}`);
          setIsSending(false);
          return;
        }
        
        await debitCoins(userId, gift.value, {
          reason: "gift_sent",
          source: "stream_gift",
        });
      }

      // Record the gift transaction
      await recordGiftTransaction(supabase, userId, streamerId, gift.id, streamId);

      toast.success(`${gift.emoji} Sent ${gift.name} to ${streamerName}!`);
      setSelectedGift(null);

      // Notify parent component
      if (onGiftSent) {
        onGiftSent({ gift, userId, timestamp: new Date() });
      }

      // Auto-close after short delay
      setTimeout(() => {
        setIsOpen(false);
        setDisplayGifts([]);
      }, 500);
    } catch (error) {
      console.error("Gift send error:", error);
      toast.error(error.message || "Failed to send gift");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Gift Button */}
      <Button
        onClick={openGiftBox}
        className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"
      >
        <Gift className="w-5 h-5" />
        Gifts
      </Button>

      {/* Gift Box Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="bg-[#1a1a2e] border-purple-500/50 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-purple-500/30 sticky top-0 bg-[#1a1a2e]">
              <div className="flex items-center gap-3">
                <Gift className="w-6 h-6 text-pink-500" />
                <h2 className="text-2xl font-bold text-white">Send a Gift to {streamerName}</h2>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSelectedGift(null);
                  setDisplayGifts([]);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {selectedGift ? (
                // Gift Confirmation View
                <div className="text-center space-y-6">
                  <div className="text-8xl">{selectedGift.emoji}</div>
                  <h3 className="text-3xl font-bold text-white">{selectedGift.name}</h3>
                  <div className="bg-purple-500/20 rounded-lg p-4">
                    <p className="text-gray-400 mb-2">Cost:</p>
                    <p className="text-4xl font-bold text-purple-400">{selectedGift.value} 🪙</p>
                  </div>
                  <div className="flex gap-4 justify-center">
                    <Button
                      onClick={() => handleSendGift(selectedGift)}
                      disabled={isSending}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-6 text-lg"
                    >
                      {isSending ? "Sending..." : "Send Gift"}
                    </Button>
                    <Button
                      onClick={() => setSelectedGift(null)}
                      disabled={isSending}
                      variant="outline"
                      className="px-8 py-6"
                    >
                      Back
                    </Button>
                  </div>
                </div>
              ) : (
                // Gift Grid View
                <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                  {displayGifts.map((gift) => (
                    <button
                      key={gift.id}
                      onClick={() => setSelectedGift(gift)}
                      className="group relative p-4 bg-[#0f0f1a] rounded-lg hover:bg-purple-500/20 transition-all duration-200 border border-purple-500/20 hover:border-purple-500/60"
                    >
                      <div className="text-5xl mb-2 group-hover:scale-110 transition-transform duration-200">
                        {gift.emoji}
                      </div>
                      <p className="text-xs font-bold text-white truncate">{gift.name}</p>
                      <p className="text-xs text-purple-400 font-bold mt-1">{gift.value} 🪙</p>
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                        <span className="text-white font-bold">Select</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="border-t border-purple-500/30 p-4 bg-blue-500/10">
              <p className="text-xs text-gray-400">
                💡 Tip: Gifts are displayed on stream for 4 seconds and visible to all viewers and the broadcaster!
              </p>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};

export default GiftBox;

import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/api/supabaseClient";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Coins, RotateCcw, Trophy, Ban, Shield, X, Zap } from "lucide-react";
import { debitPurchasedCoins, creditFreeCoins } from "@/lib/coins";

const WHEEL_SEGMENTS = [
  { label: "1 Coin", value: 1, color: "#10b981", type: "coins" },
  { label: "100 Coins", value: 100, color: "#3b82f6", type: "coins" },
  { label: "1,000 Coins", value: 1000, color: "#8b5cf6", type: "coins" },
  { label: "10,000 Coins", value: 10000, color: "#f59e0b", type: "coins" },
  { label: "100,000 Coins", value: 100000, color: "#ef4444", type: "coins" },
  { label: "BANKRUPT", value: 0, color: "#dc2626", type: "bankrupt" },
  { label: "No Kick Day", value: 1, color: "#06b6d4", type: "no_kick" },
  { label: "No Ban Day", value: 1, color: "#10b981", type: "no_ban" },
  { label: "0 Coins", value: 0, color: "#6b7280", type: "zero" },
  { label: "FREE SPIN", value: 1, color: "#fbbf24", type: "free_spin" }
];

const SPIN_COST = 500;

export default function TrollWheel() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [spinHistory, setSpinHistory] = useState([]);
  const wheelRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: profile } = await supabase
          .from("profiles")
          .select("id, username, coins, free_coins, purchased_coins")
          .eq("id", authUser.id)
          .single();
          setUser(profile);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  const canAffordSpin = () => {
    return user && user.purchased_coins >= SPIN_COST;
  };

  const spinWheel = async () => {
    if (isSpinning) return;
    if (!canAffordSpin()) {
      toast.error("Insufficient paid coins! You need 500 paid coins to spin.");
      return;
    }

    setIsSpinning(true);
    
    try {
      // Deduct spin cost
      await debitPurchasedCoins(user.id, SPIN_COST, { reason: "troll_wheel_spin" });
      
      // Calculate random result
      const randomIndex = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
      const result = WHEEL_SEGMENTS[randomIndex];
      
      // Calculate rotation (multiple full rotations + target segment)
      const segmentAngle = 360 / WHEEL_SEGMENTS.length;
      const targetAngle = randomIndex * segmentAngle + segmentAngle / 2;
      const totalRotation = 1800 + (360 - targetAngle); // 5 full rotations + alignment
      
      setRotation(totalRotation);
      
      // Wait for spin animation to complete
      setTimeout(async () => {
        setLastResult(result);
        setSpinHistory(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 spins
        
        // Handle result
        switch (result.type) {
          case "coins":
            await creditFreeCoins(user.id, result.value, { source: "troll_wheel_prize" });
            toast.success(`🎉 You won ${result.value.toLocaleString()} coins!`);
            break;
            
          case "bankrupt":
            toast.error("💸 BANKRUPT! You lost all your coins!");
            // Set coins to 0
            await supabase.from("profiles").update({ coins: 0, free_coins: 0 }).eq("id", user.id);
            break;
            
          case "no_kick":
            toast.success("🛡️ No kick protection for 24 hours!");
            // Add protection (you'll need to implement this logic)
            break;
            
          case "no_ban":
            toast.success("🛡️ No ban protection for 24 hours!");
            // Add protection (you'll need to implement this logic)
            break;
            
          case "zero":
            toast.info("😅 You got 0 coins!");
            break;
            
          case "free_spin":
            toast.success("🎁 FREE SPIN! Spin again for free!");
            // Refund the spin cost
            await creditFreeCoins(user.id, SPIN_COST, { source: "troll_wheel_free_spin" });
            break;
        }
        
        // Refresh user data
        const { data: updatedUser } = await supabase
          .from("profiles")
          .select("id, username, coins, free_coins, purchased_coins")
          .eq("id", user.id)
          .single();
        setUser(updatedUser);
        
        setIsSpinning(false);
      }, 3000); // 3 second spin duration
      
    } catch (error) {
      console.error("Error spinning wheel:", error);
      toast.error("Failed to spin wheel. Please try again.");
      setIsSpinning(false);
    }
  };

  const getSegmentPath = (index, total) => {
    const angle = (2 * Math.PI) / total;
    const startAngle = index * angle;
    const endAngle = (index + 1) * angle;
    
    const x1 = 50 + 40 * Math.cos(startAngle);
    const y1 = 50 + 40 * Math.sin(startAngle);
    const x2 = 50 + 40 * Math.cos(endAngle);
    const y2 = 50 + 40 * Math.sin(endAngle);
    
    const largeArcFlag = angle > Math.PI ? 1 : 0;
    
    return `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            🎰 Troll Wheel of Trolling 🎰
          </h1>
          <p className="text-gray-300 text-lg">Spin the wheel and win amazing prizes!</p>
          <div className="mt-4 flex justify-center items-center gap-4">
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
              <Coins className="w-4 h-4 mr-1" />
              Cost: {SPIN_COST} paid coins
            </Badge>
            <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
              <Coins className="w-4 h-4 mr-1" />
              Paid Coins: {user?.purchased_coins?.toLocaleString() || 0}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Wheel */}
          <div className="lg:col-span-2">
            <Card className="bg-black/30 backdrop-blur-sm border-purple-500/30 p-8">
              <div className="relative flex justify-center items-center">
                {/* Wheel Container */}
                <div className="relative">
                  <svg
                    ref={wheelRef}
                    width="400"
                    height="400"
                    viewBox="0 0 100 100"
                    className="drop-shadow-2xl"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transition: isSpinning ? "transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)" : "none"
                    }}
                  >
                    {WHEEL_SEGMENTS.map((segment, index) => (
                      <g key={index}>
                        <path
                          d={getSegmentPath(index, WHEEL_SEGMENTS.length)}
                          fill={segment.color}
                          stroke="#000"
                          strokeWidth="0.5"
                          className="hover:opacity-80 transition-opacity"
                        />
                        <text
                          x={50 + 25 * Math.cos((index + 0.5) * (2 * Math.PI) / WHEEL_SEGMENTS.length)}
                          y={50 + 25 * Math.sin((index + 0.5) * (2 * Math.PI) / WHEEL_SEGMENTS.length)}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-white text-xs font-bold"
                          transform={`rotate(${index * (360 / WHEEL_SEGMENTS.length) + (360 / WHEEL_SEGMENTS.length / 2)}, ${50 + 25 * Math.cos((index + 0.5) * (2 * Math.PI) / WHEEL_SEGMENTS.length)}, ${50 + 25 * Math.sin((index + 0.5) * (2 * Math.PI) / WHEEL_SEGMENTS.length)})`}
                        >
                          {segment.label}
                        </text>
                      </g>
                    ))}
                    {/* Center circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="8"
                      fill="#1a1a1a"
                      stroke="#fff"
                      strokeWidth="1"
                    />
                  </svg>
                  
                  {/* Pointer */}
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">
                    <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-red-500"></div>
                  </div>
                </div>
              </div>
              
              {/* Spin Button */}
              <div className="text-center mt-8">
                <Button
                  onClick={spinWheel}
                  disabled={isSpinning || !canAffordSpin()}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-4 px-8 text-xl rounded-full shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSpinning ? (
                    <>
                      <RotateCcw className="w-6 h-6 mr-2 animate-spin inline" />
                      Spinning...
                    </>
                  ) : (
                    <>
                      <Zap className="w-6 h-6 mr-2 inline" />
                      SPIN THE WHEEL!
                    </>
                  )}
                </Button>
                
                {!canAffordSpin() && (
                  <p className="text-red-400 mt-2 text-sm">
                    You need {SPIN_COST} paid coins to spin. 
                    <Button
                      variant="link"
                      onClick={() => navigate(createPageUrl("Store"))}
                      className="text-yellow-400 hover:text-yellow-300 p-0 h-auto"
                    >
                      Buy coins
                    </Button>
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Last Result */}
            {lastResult && (
              <Card className="bg-black/30 backdrop-blur-sm border-green-500/30 p-6">
                <h3 className="text-white font-bold mb-4 flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                  Last Result
                </h3>
                <div className="text-center">
                  <div 
                    className="text-2xl font-bold mb-2"
                    style={{ color: lastResult.color }}
                  >
                    {lastResult.label}
                  </div>
                  <Badge 
                    className={`${
                      lastResult.type === 'coins' ? 'bg-green-500/20 text-green-300' :
                      lastResult.type === 'bankrupt' ? 'bg-red-500/20 text-red-300' :
                      lastResult.type === 'free_spin' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-blue-500/20 text-blue-300'
                    } border-0`}
                  >
                    {lastResult.type === 'coins' ? '💰 Coins Won' :
                     lastResult.type === 'bankrupt' ? '💸 Bankrupt' :
                     lastResult.type === 'free_spin' ? '🎁 Free Spin' :
                     '🛡️ Protection'}
                  </Badge>
                </div>
              </Card>
            )}

            {/* Spin History */}
            <Card className="bg-black/30 backdrop-blur-sm border-purple-500/30 p-6">
              <h3 className="text-white font-bold mb-4">Spin History</h3>
              {spinHistory.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {spinHistory.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-black/20 rounded">
                      <span className="text-white text-sm">{result.label}</span>
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: result.color }}
                      ></div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No spins yet. Start spinning!</p>
              )}
            </Card>

            {/* Prize Info */}
            <Card className="bg-black/30 backdrop-blur-sm border-blue-500/30 p-6">
              <h3 className="text-white font-bold mb-4">Prize Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">💰 Coin Prizes:</span>
                  <span className="text-green-400">1 - 100,000</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">💸 Bankrupt:</span>
                  <span className="text-red-400">Lose all coins</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">🛡️ Protection:</span>
                  <span className="text-blue-400">24h safety</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">🎁 Free Spin:</span>
                  <span className="text-yellow-400">Refund cost</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
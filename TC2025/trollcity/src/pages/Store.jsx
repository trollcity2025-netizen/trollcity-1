import { useState, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { processSquarePayment } from "@/api/square";
import { getUserPaymentMethods, processUserPaymentMethod, getAvailablePaymentMethods } from "@/api/userPaymentMethods";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

import {
  Coins,
  ShoppingCart,
  CreditCard,
  Loader2,
  DollarSign,
  CheckCircle,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { creditCoins, debitCoins } from "@/lib/coins";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import AdminEditPanel from "@/components/AdminEditPanel";
import { getAdminContent, updateAdminContent } from "@/api/admin";

export default function StorePage() {
  const queryClient = useQueryClient();
  
  const [customAmount, setCustomAmount] = useState("");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [adminContent, setAdminContent] = useState("");

  // Get current user
  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("*, purchased_coins, free_coins")
        .eq("id", user.id)
        .single();
      
      return profile;
    },
  });

  // Get user payment methods
  const { data: userPaymentMethods } = useQuery({
    queryKey: ["userPaymentMethods", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const methods = await getUserPaymentMethods(user.id);
      console.log('User payment methods loaded:', methods);
      return methods;
    },
    enabled: !!user?.id,
  });

  // Get available payment methods
  const { data: availableMethods } = useQuery({
    queryKey: ["availablePaymentMethods", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const methods = await getAvailablePaymentMethods(user.id);
      console.log('Available payment methods:', methods);
      return methods;
    },
    enabled: !!user?.id,
  });

  // Get admin content
  const { isLoading: isLoadingAdminContent } = useQuery({
    queryKey: ["adminContent", "Store"],
    queryFn: async () => {
      const content = await getAdminContent("Store", "header_content");
      setAdminContent(content || "");
      return content;
    },
  });

  // Get coin packages
  const { data: coinPackages = [] } = useQuery({
    queryKey: ["coinPackages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_packages")
        .select("*")
        .order("price", { ascending: true });
      
      if (error) {
        console.error("Error fetching coin packages:", error);
        return [];
      }
      
      return data || [];
    },
  });

  // Get purchase history
  const { data: purchaseHistory = [] } = useQuery({
    queryKey: ["purchaseHistory", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get coin purchases
      const { data: coinPurchases, error: coinError } = await supabase
        .from("coin_purchases")
        .select("*")
        .eq("user_id", user.id)
        .order("created_date", { ascending: false })
        .limit(10);
      
      if (coinError) {
        console.error("Error fetching purchase history:", coinError);
        return [];
      }
      
      // Format and return coin purchases only
      return (coinPurchases || []).map(purchase => ({
        ...purchase,
        type: 'coins',
        date: purchase.created_date,
      }));
    },
    enabled: !!user?.id,
  });

  // Calculate coins for custom amount
  const getCustomTotal = useMemo(() => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount === 0) return 0;
    return Math.floor(calculateCoinsForAmount(amount));
  }, [customAmount]);

  const getCoinsPerDollar = useMemo(() => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount === 0) return 0;
    return Math.floor(calculateCoinsForAmount(amount) / amount);
  }, [customAmount]);

  // Purchase coins mutation
  const purchaseMutation = useMutation({
    mutationFn: async ({ packageData, paymentMethod }) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const amount = Math.round(packageData.price * 100); // Convert to cents
      const idempotencyKey = `${user.id}-${packageData.id}-${Date.now()}`;
      
      let result;
      
      // If using user's saved payment method
      if (paymentMethod && userPaymentMethods) {
        // Map frontend method names to backend method names
        const methodMapping = {
          'apple_pay': 'applePay',
          'google_wallet': 'googleWallet',
          'chime': 'chime',
          'cashapp': 'cashApp'
        };
        
        const backendMethod = methodMapping[paymentMethod];
        const methodId = userPaymentMethods[backendMethod];
        
        if (methodId) {
          result = await processUserPaymentMethod(
            user.id,
            paymentMethod,
            methodId,
            amount,
            "usd",
            `Purchase of ${packageData.coins} Troll Coins`,
            packageData.coins,
            idempotencyKey
          );
        } else {
          toast.error(`No saved ${paymentMethod} payment method found`);
          return;
        }
      } else if (selectedMethod && selectedMethod !== "new_card") {
        // Use Square payment with existing payment method
        const squareSourceId = selectedMethod; // selectedMethod contains the Square source ID
        result = await processSquarePayment(
          squareSourceId,
          amount,
          "usd",
          `Purchase of ${packageData.coins + (packageData.bonus || 0)} Troll Coins`,
          idempotencyKey
        );
      } else {
        toast.error("Please select a payment method");
        return;
      }
      
      if (result.success) {
        // Credit coins to user
        await creditCoins(user.id, packageData.coins, "purchase");
        
        // Record purchase
        await supabase.from("coin_purchases").insert({
          user_id: user.id,
          coin_amount: packageData.coins,
          usd_amount: packageData.price,
          status: "completed",
          square_charge_id: result.transactionId,
          package_id: packageData.id,
          created_date: new Date().toISOString(),
        });
        
        return result;
      } else {
        throw new Error(result.error || "Payment failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["user"]);
      queryClient.invalidateQueries(["purchaseHistory"]);
      toast.success("Purchase successful! Coins have been added to your account.");
      setShowPaymentDialog(false);
      setSelectedPackage(null);
      setSelectedMethod("");
      setCardNumber("");
      setExpiry("");
      setCvv("");
    },
    onError: (error) => {
      toast.error(error.message || "Purchase failed");
    },
  });

  // Handle coin package purchase
  const handlePurchaseCoins = (pkg) => {
    console.log('Opening payment dialog:', {
      pkg,
      userPaymentMethods,
      availableMethods,
      selectedMethod
    });
    setSelectedPackage(pkg);
    setShowPaymentDialog(true);
  };

  // Handle custom amount purchase
  const handleCustomPurchase = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount < 0.10) {
      toast.error("Please enter a valid amount (minimum $0.10)");
      return;
    }
    
    const customPackage = {
      id: "custom",
      coins: getCustomTotal,
      bonus: 0,
      price: amount,
      emoji: "💎",
      name: "Custom Amount",
      description: "Custom coin purchase",
    };
    
    setSelectedPackage(customPackage);
    setShowPaymentDialog(true);
  };

  // Note: Entrance effect purchases are handled directly via purchaseEffectMutation.mutate()

  // Handle payment confirmation
  const handleConfirmPurchase = () => {
    if (!selectedPackage) return;
    
    console.log('Purchase confirmation:', {
      selectedMethod,
      userPaymentMethods,
      availableMethods,
      selectedPackage
    });
    
    if (selectedMethod === "new_card" && (!cardNumber || !expiry || !cvv)) {
      toast.error("Please fill in all card details");
      return;
    }
    
    purchaseMutation.mutate({ 
      packageData: selectedPackage, 
      paymentMethod: selectedMethod === "new_card" ? null : selectedMethod 
    });
  };

  // Calculate coins for amount
  function calculateCoinsForAmount(amount) {
    // Simple conversion: $1 = 160 coins (adjust as needed)
    return Math.floor(amount * 160);
  }

  // Purchase entrance effect
  const purchaseEntranceEffect = async (effect) => {
    if (!user) {
      toast.error("Please login to purchase entrance effects");
      return;
    }
    
    if (user.coins < effect.price) {
      toast.error("Insufficient coins");
      return;
    }
    
    try {
      // Deduct coins
      await debitCoins(user.id, effect.price, "entrance_effect_purchase");
      
      // Create user entrance effect
      await supabase.from("user_entrance_effects").insert({
        user_id: user.id,
        effect_name: effect.name,
        animation_type: effect.animation,
        price: effect.price,
        is_active: false,
        created_date: new Date().toISOString()
      });
      
      toast.success(`Successfully purchased ${effect.name}!`);
      queryClient.invalidateQueries(["user"]);
    } catch (error) {
      toast.error("Failed to purchase entrance effect");
      console.error("Entrance effect purchase error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6 md:p-8">
      <style>{`.neon-troll { color: #00ff88; text-shadow: 0 0 10px #00ff88, 0 0 20px #00ff88; }`}</style>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center justify-center text-center gap-2 mb-8">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-5xl md:text-6xl font-extrabold">
                <span className="neon-troll">Troll</span> <span className="text-yellow-400">Store</span>
              </h1>
              <p className="text-base text-gray-400 mt-2">
                💰 Purchased Troll Coins have REAL VALUE and can be cashed out by streamers
              </p>
            </div>

            {/* Admin Edit Panel - Only visible to admins */}
            <AdminEditPanel
              pageName="Store Header"
              currentContent={adminContent}
              onSave={async (newContent) => {
                await updateAdminContent("Store", newContent, "header_content");
                setAdminContent(newContent);
              }}
              fieldName="header_content"
            />

            {/* Custom Admin Content Display */}
            {adminContent && !isLoadingAdminContent && (
              <div className="mb-8 p-4 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-lg">
                <div className="text-white prose prose-invert max-w-none"
                     dangerouslySetInnerHTML={{ __html: adminContent.replace(/\n/g, '<br />') }} />
              </div>
            )}
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="coins" className="space-y-8">
          <TabsList className="bg-[#1a1a24] border-[#2a2a3a] p-1">
            <TabsTrigger value="coins" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Coins className="w-4 h-4 mr-2" />
              Coin Packages
            </TabsTrigger>
            <TabsTrigger value="effects" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              Entrance Effects
            </TabsTrigger>
          </TabsList>

          {/* Coin Packages Tab */}
          <TabsContent value="coins">
            <div className="space-y-8">
              {/* Coin Packages */}
              <div id="coins-section">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Coins className="w-6 h-6 text-yellow-400" />
                  Purchase Troll Coins
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {coinPackages.map((pkg) => {
                    return (
                      <motion.div
                        key={pkg.id}
                        whileHover={{ scale: 1.05, y: -5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <Card
                          className={`relative overflow-hidden cursor-pointer transition-all duration-300 ${
                            pkg.popular
                              ? "bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-2 border-purple-500 shadow-xl shadow-purple-500/30"
                              : "bg-[#1a1a24] border-[#2a2a3a] hover:border-purple-500/50"
                          }`}
                        >
                          {pkg.popular && (
                            <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
                              MOST POPULAR
                            </div>
                          )}
                          <div className="p-6">
                            <div className="text-center mb-4">
                              <div className="text-6xl mb-3">{pkg.emoji}</div>
                              <div className="text-4xl font-bold text-yellow-400 mb-2 flex items-center justify-center gap-2">
                                <Coins className="w-8 h-8" /> {pkg.coins.toLocaleString()}
                              </div>
                              <div className="text-2xl font-bold text-white mt-2">
                                ${pkg.price.toFixed(2)}
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                {Math.floor(pkg.coins / pkg.price)} Troll Coins per $1
                              </p>
                              <Button
                                type="button"
                                onClick={() => handlePurchaseCoins(pkg)}
                                className={`w-full mt-4 ${
                                  pkg.popular
                                    ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                                    : "bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700"
                                }`}
                              >
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Purchase Now
                              </Button>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Amount */}
              <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  Custom Amount - Buy Any Amount You Want!
                </h2>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <p className="text-blue-300 text-sm">
                    💰 <strong>No maximum limit!</strong> Buy exactly the amount you need, from $0.10 to any amount you want.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-gray-400 mb-2 block">Enter Amount (USD)</label>
                    <Input
                      type="number"
                      placeholder="0.10"
                      min="0.10"
                      step="0.01"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="bg-[#0a0a0f] border-[#2a2a3a] text-white text-2xl py-6"
                    />
                    <p className="text-xs text-gray-500 mt-2">Minimum $0.10 - no maximum limit!</p>
                  </div>
                  
                  <Card className="bg-[#0a0a0f] border-[#2a2a3a] p-6">
                    <h3 className="text-lg font-bold text-white mb-4">You&apos;ll Receive:</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-yellow-400 text-2xl">
                        <span className="font-bold">Total:</span>
                        <span className="font-bold flex items-center gap-2">
                          <Coins className="w-6 h-6" />
                          {getCustomTotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-center text-sm text-gray-400">
                        {getCoinsPerDollar} Troll Coins per $1
                      </div>
                    </div>
                    
                    <div className="mt-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                      <p className="text-green-300 text-sm font-bold mb-2">✅ These are PAID Troll Coins</p>
                      <p className="text-green-200 text-xs">
                        • Have real cash value ($0.00625 per coin)
                      </p>
                      <p className="text-green-200 text-xs">
                        • Can be used for EVERYTHING (gifts, messages, etc)
                      </p>
                      <p className="text-green-200 text-xs">
                        • Streamers can cash them out for real money
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={handleCustomPurchase}
                      disabled={!customAmount || parseFloat(customAmount) < 0.10}
                      className="w-full mt-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 py-6 text-lg font-bold"
                    >
                      <CreditCard className="w-5 h-5 mr-2" />
                      Purchase {getCustomTotal.toLocaleString()} Troll Coins
                    </Button>
                  </Card>
                </div>
              </Card>

              {/* Gifts Preview */}
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Available Gifts</h2>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {[{emoji: "🌹", name: "Rose", coin_value: 1}, {emoji: "🎁", name: "Gift", coin_value: 5}, {emoji: "💎", name: "Diamond", coin_value: 10}, {emoji: "👑", name: "Crown", coin_value: 25}, {emoji: "🔥", name: "Fire", coin_value: 50}, {emoji: "⚡", name: "Lightning", coin_value: 100}].map((gift) => (
                    <Card key={gift.name} className="bg-[#1a1a24] border-[#2a2a3a] p-4 text-center">
                      <div className="text-4xl mb-2">{gift.emoji}</div>
                      <p className="text-white text-sm font-semibold">{gift.name}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Coins className="w-3 h-3 text-yellow-400" />
                        <span className="text-yellow-400 text-xs">{gift.coin_value}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Entrance Effects Tab */}
          <TabsContent value="effects">
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                  Entrance Effects
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { 
                      id: 1, 
                      name: "Royal Entrance", 
                      description: "Make a grand entrance with golden sparkles",
                      animation: "sparkle", 
                      price: 500, 
                      rarity: "epic"
                    },
                    { 
                      id: 2, 
                      name: "Fireworks", 
                      description: "Enter with explosive fireworks display",
                      animation: "fireworks", 
                      price: 1000, 
                      rarity: "legendary"
                    },
                    { 
                      id: 3, 
                      name: "Rainbow Trail", 
                      description: "Leave a colorful rainbow trail as you enter",
                      animation: "rainbow", 
                      price: 300, 
                      rarity: "rare"
                    },
                    { 
                      id: 4, 
                      name: "Neon Glow", 
                      description: "Enter with a bright neon glow effect",
                      animation: "neon", 
                      price: 200, 
                      rarity: "common"
                    },
                    { 
                      id: 5, 
                      name: "Confetti Blast", 
                      description: "Celebrate your entrance with confetti",
                      animation: "confetti", 
                      price: 400, 
                      rarity: "rare"
                    },
                    { 
                      id: 6, 
                      name: "Lightning Strike", 
                      description: "Make a shocking entrance with lightning",
                      animation: "lightning", 
                      price: 750, 
                      rarity: "epic"
                    }
                  ].map((effect) => (
                    <motion.div
                      key={effect.id}
                      whileHover={{ scale: 1.05, y: -5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Card
                        className={`relative overflow-hidden cursor-pointer transition-all duration-300 bg-[#1a1a24] border-[#2a2a3a] hover:border-purple-500/50`}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${RARITY_COLORS[effect.rarity]} opacity-10`} />
                        <div className="p-6 relative z-10">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">{effect.name}</h3>
                            <Badge className={`bg-gradient-to-r ${RARITY_COLORS[effect.rarity]} text-white border-0`}>
                              {effect.rarity.toUpperCase()}
                            </Badge>
                          </div>
                          
                          <p className="text-gray-400 text-sm mb-4">{effect.description}</p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Coins className="w-4 h-4 text-yellow-400" />
                              <span className="text-yellow-400 font-semibold">{effect.price.toLocaleString()}</span>
                            </div>
                            
                            <Button 
                              onClick={() => purchaseEntranceEffect(effect)}
                              disabled={!user || user.coins < effect.price}
                              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                              Purchase
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Payment Banner */}
        <Card className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500 p-4 mb-6">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div>
              <h3 className="text-base font-bold text-white">💳 Secure Payment</h3>
              <p className="text-sm text-blue-200">
                Pay using your saved payment methods or enter a new card
              </p>
            </div>
          </div>
        </Card>

        {/* Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50 p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-gray-400 text-sm">Total Balance</p>
                <p className="text-3xl font-bold text-yellow-400">
                  {(user?.coins || 0).toLocaleString()}
                </p>
              </div>
              <Coins className="w-12 h-12 text-yellow-400/50" />
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">Total Value:</span>
                <span className="text-lg font-bold text-green-400">
                  ${((user?.coins || 0) * 0.00625).toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50 p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-gray-400 text-sm">Troll Coins</p>
                <p className="text-3xl font-bold text-green-400">
                  {(user?.purchased_coins || 0).toLocaleString()}
                </p>
              </div>
              <div className="text-2xl">✓</div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-2 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">Value:</span>
                <span className="text-lg font-bold text-purple-400">
                  ${((user?.purchased_coins || 0) * 0.00625).toFixed(2)}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Real value • Can spend</p>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/20 to-pink-500/20 border-red-500/50 p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-gray-400 text-sm">Free Coins</p>
                <p className="text-3xl font-bold text-red-400">
                  {(user?.free_coins || 0).toLocaleString()}
                </p>
              </div>
              <X className="w-12 h-12 text-red-400/50" />
            </div>
            <div className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-2 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">Value:</span>
                <span className="text-lg font-bold text-gray-400">$0.00</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">No cash value • Can spend</p>
          </Card>
        </div>

        {/* Purchase History */}
        <div className="space-y-2" id="history-section">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-400" />
            Purchase History
          </h2>
          
          {purchaseHistory.length === 0 ? (
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-12 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No purchases yet</p>
              <p className="text-gray-600 text-sm mt-2">Your purchase history will appear here</p>
            </Card>
          ) : (
            <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6">
              <div className="space-y-3">
                {purchaseHistory.map((purchase) => (
                  <motion.div
                    key={purchase.id || `${purchase.type}-${purchase.effect_id || ''}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-[#0a0a0f] rounded-lg p-4 border border-[#2a2a3a]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                          <Coins className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-bold text-lg">
                            {(purchase.coin_amount || 0).toLocaleString()} Coins
                          </p>
                          <p className="text-gray-400 text-sm">{purchase.package_type || 'Troll Coin Package'}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            {format(new Date(purchase.date || purchase.created_date), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-bold text-xl">
                          {formatCurrency(purchase.usd_amount)}
                        </p>
                        <Badge className={
                          purchase.status === 'completed' ? 'bg-green-500' :
                          purchase.status === 'pending' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }>
                          {purchase.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {purchase.status}
                        </Badge>
                        <p className="text-gray-500 text-xs mt-1">Square</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Summary Stats */}
              <div className="mt-6 pt-6 border-t border-[#2a2a3a] grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Total Spent</p>
                  <p className="text-3xl font-bold text-green-400">
                    {formatCurrency(purchaseHistory.filter(p => p.status === 'completed').reduce((sum, p) => sum + (Number(p.usd_amount) || 0), 0))}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Total Coins Bought</p>
                  <p className="text-3xl font-bold text-yellow-400">
                    {purchaseHistory.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.coin_amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="bg-[#1a1a24] border-[#2a2a3a]">
            <DialogHeader>
              <DialogTitle className="text-white text-2xl">Confirm Purchase</DialogTitle>
              <DialogDescription className="text-gray-400">
                Select your payment method to complete the purchase
              </DialogDescription>
            </DialogHeader>
            
            {selectedPackage && (
              <div className="space-y-6 my-4">
                <div className="bg-[#0a0a0f] rounded-lg p-4">
                  <div className="text-center mb-3">
                    <div className="text-4xl mb-2">{selectedPackage.emoji}</div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {(selectedPackage.coins + (selectedPackage.bonus || 0)).toLocaleString()} Troll Coins
                    </div>
                    <div className="text-xl text-white mt-1">
                      ${selectedPackage.price.toFixed(2)}
                    </div>
                    {selectedPackage.isTest && (
                      <div className="mt-3 bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                        <p className="text-green-300 text-sm">
                          ✅ <strong>Test Payment - Full Refund</strong>
                        </p>
                        <p className="text-green-200 text-xs mt-1">
                          This $0.01 will be refunded to your account within 24 hours
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Saved Payment Methods */}
                  {(availableMethods?.applePay || userPaymentMethods?.applePay) && (
                    <div
                      className={`p-4 rounded-lg border ${selectedMethod === 'apple_pay' ? 'border-blue-500 bg-blue-500/10' : 'border-[#2a2a3a] bg-[#0a0a0f]'}`}
                      onClick={() => setSelectedMethod('apple_pay')}
                      role="button"
                    >
                      <div className="text-white font-semibold mb-2">Apple Pay</div>
                      <p className="text-gray-400 text-sm">Use saved Apple Pay</p>
                      {selectedMethod === 'apple_pay' && (
                        <div className="mt-2 text-green-400 text-sm">✓ Selected</div>
                      )}
                    </div>
                  )}
                  
                  {(availableMethods?.googleWallet || userPaymentMethods?.googleWallet) && (
                    <div
                      className={`p-4 rounded-lg border ${selectedMethod === 'google_wallet' ? 'border-blue-500 bg-blue-500/10' : 'border-[#2a2a3a] bg-[#0a0a0f]'}`}
                      onClick={() => setSelectedMethod('google_wallet')}
                      role="button"
                    >
                      <div className="text-white font-semibold mb-2">Google Wallet</div>
                      <p className="text-gray-400 text-sm">Use saved Google Wallet</p>
                      {selectedMethod === 'google_wallet' && (
                        <div className="mt-2 text-green-400 text-sm">✓ Selected</div>
                      )}
                    </div>
                  )}
                  
                  {(availableMethods?.chime || userPaymentMethods?.chime) && (
                    <div
                      className={`p-4 rounded-lg border ${selectedMethod === 'chime' ? 'border-green-600 bg-green-600/10' : 'border-[#2a2a3a] bg-[#0a0a0f]'}`}
                      onClick={() => setSelectedMethod('chime')}
                      role="button"
                    >
                      <div className="text-white font-semibold mb-2">Chime</div>
                      <p className="text-gray-400 text-sm">Use saved Chime account</p>
                      {selectedMethod === 'chime' && (
                        <div className="mt-2 text-green-400 text-sm">✓ Selected</div>
                      )}
                    </div>
                  )}
                  
                  {(availableMethods?.cashApp || userPaymentMethods?.cashApp) && (
                    <div
                      className={`p-4 rounded-lg border ${selectedMethod === 'cashapp' ? 'border-green-600 bg-green-600/10' : 'border-[#2a2a3a] bg-[#0a0a0f]'}`}
                      onClick={() => setSelectedMethod('cashapp')}
                      role="button"
                    >
                      <div className="text-white font-semibold mb-2">Cash App</div>
                      <p className="text-gray-400 text-sm">Use saved Cash App account</p>
                      {selectedMethod === 'cashapp' && (
                        <div className="mt-2 text-green-400 text-sm">✓ Selected</div>
                      )}
                    </div>
                  )}
                  
                  {/* New Card Option */}
                  <div
                    className={`p-4 rounded-lg border ${selectedMethod === 'new_card' ? 'border-blue-500 bg-blue-500/10' : 'border-[#2a2a3a] bg-[#0a0a0f]'}`}
                    onClick={() => setSelectedMethod('new_card')}
                    role="button"
                  >
                    <div className="text-white font-semibold mb-2">💳 New Card</div>
                    <p className="text-gray-400 text-sm">Enter new card details</p>
                    {selectedMethod === 'new_card' && (
                      <div className="mt-2 text-green-400 text-sm">✓ Selected</div>
                    )}
                  </div>
                </div>

                {selectedMethod === 'new_card' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-white">Card Number</Label>
                      <Input
                        placeholder="1234 5678 9012 3456"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-white">Expiry</Label>
                        <Input
                          placeholder="MM/YY"
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                          className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-white">CVV</Label>
                        <Input
                          placeholder="123"
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value)}
                          className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPaymentDialog(false)}
                    className="flex-1 bg-transparent border-[#2a2a3a] text-white hover:bg-[#2a2a3a]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmPurchase}
                    disabled={!selectedMethod || purchaseMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    {purchaseMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Confirm Purchase
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
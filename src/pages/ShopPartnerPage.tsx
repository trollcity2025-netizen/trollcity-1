import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Store, ExternalLink, CheckCircle, AlertCircle, Clock } from "lucide-react";

export default function ShopPartnerPage() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [shop, setShop] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load current user shop connection from Supabase (shop_partners table)
  useEffect(() => {
    const loadShop = async () => {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Please log in to connect your store.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("shop_partners")
        .select("id, shop_domain, shop_name, status, last_synced_at, created_at")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("shop_partner load error", error);
        setError("Unable to load your shop connection.");
      } else if (data) {
        setShop(data);
        setConnected(data.status === "connected");
      }

      setLoading(false);
    };

    loadShop();
  }, []);

  const handleConnectClick = () => {
    // This should redirect to your backend Shopify OAuth endpoint
    window.location.href = "/api/shopify/connect";
  };

  const handleDisconnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("shop_partners")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("Disconnect error:", error);
      alert("Failed to disconnect store. Please try again.");
    } else {
      setShop(null);
      setConnected(false);
      setError(null);
    }
  };

  const connectionStatus = () => {
    if (loading) return "Checking connection…";
    if (error) return "Disconnected";
    if (connected) return "Connected";
    return "Not connected";
  };

  const statusColor = () => {
    if (loading) return "text-yellow-400";
    if (error) return "text-red-400";
    if (connected) return "text-green-400";
    return "text-gray-400";
  };

  const getStatusIcon = () => {
    if (loading) return <Clock className="w-4 h-4" />;
    if (error) return <AlertCircle className="w-4 h-4" />;
    if (connected) return <CheckCircle className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-[#0A0A14] text-gray-200 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Store className="w-8 h-8 text-green-400" />
            <h1 className="text-3xl font-extrabold text-green-400">
              Sell on Troll City
            </h1>
          </div>
          <p className="text-sm text-gray-400 max-w-3xl">
            Connect your Shopify store and sell products directly during your
            Troll City livestreams. Troll City takes a fair{" "}
            <span className="text-purple-300 font-semibold">12% platform fee</span>,
            you keep the rest.
          </p>
        </header>

        {/* Connection status + CTA */}
        <section className="grid gap-6 lg:grid-cols-3 mb-8">
          <div className="lg:col-span-2 bg-gray-900 border border-green-700 rounded-2xl p-6 shadow-lg shadow-green-500/20">
            <h2 className="text-xl font-semibold mb-2 text-green-400 flex items-center gap-2">
              <Store className="w-5 h-5" />
              1. Connect Your Shopify Store
            </h2>
            <p className="text-gray-300 text-sm mb-6">
              Use the button below to start the Shopify connection. After
              connecting, your products can be shown live on-screen while you
              stream, and orders will appear in your Shop Dashboard.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-3">
                <button
                  disabled={loading}
                  onClick={handleConnectClick}
                  className={`px-6 py-3 rounded-lg font-semibold text-white transition-all ${
                    connected
                      ? "bg-gray-700 hover:bg-gray-600 border border-gray-600"
                      : "bg-green-600 hover:bg-green-700 border border-green-500"
                  }`}
                >
                  {connected ? "Reconnect Shopify" : "Connect Shopify Store"}
                </button>
                
                {connected && (
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-700 hover:border-red-600 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <div className={statusColor()}>
                  {getStatusIcon()}
                </div>
                <span>
                  Status:{" "}
                  <span className={statusColor()}>
                    {connectionStatus()}
                  </span>
                </span>
                {shop?.shop_domain && (
                  <>
                    {" "}
                    · <span className="text-purple-300">{shop.shop_domain}</span>
                  </>
                )}
              </div>
            </div>

            {shop?.last_synced_at && (
              <p className="text-xs text-gray-500">
                Last synced:{" "}
                {new Date(shop.last_synced_at).toLocaleString()}
              </p>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Benefits card */}
          <div className="bg-gray-900 border border-purple-700 rounded-2xl p-6 shadow-lg shadow-purple-500/20">
            <h3 className="text-lg font-semibold mb-4 text-purple-300 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Why Sell on Troll City?
            </h3>
            <ul className="text-sm text-gray-300 space-y-3">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span>Live product drops during your streams</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span>Troll City only takes 12% platform fee</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span>Instant visibility to your Troll fans</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span>Orders tracked in your Shop Dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span>Works with your existing Shopify setup</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Product management section */}
        <section className="grid gap-6 lg:grid-cols-3 mb-10">
          <div className="lg:col-span-2 bg-gray-900 border border-purple-700 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-2 text-purple-400 flex items-center gap-2">
              <Store className="w-5 h-5" />
              2. Manage Imported Products
            </h2>
            <p className="text-gray-300 text-sm mb-6">
              After connecting your store, your Shopify products will sync to
              Troll City. You will be able to choose which products appear on
              screen during your shows.
            </p>

            <div className="min-h-[160px] flex items-center justify-center bg-gray-950/60 border-2 border-dashed border-gray-700 rounded-xl">
              <div className="text-center">
                <Store className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  {connected
                    ? "No products imported yet. Once your Shopify integration is live, products will appear here."
                    : "Connect your Shopify store first to start importing products."}
                </p>
                {connected && (
                  <button className="mt-3 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                    Sync Products Now
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick checklist */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">
              Quick Start Checklist
            </h3>
            <ol className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold mt-1">1.</span>
                <span>Connect your Shopify account</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold mt-1">2.</span>
                <span>Choose products for livestream promotion</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold mt-1">3.</span>
                <span>Go live on Troll City with your shop enabled</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold mt-1">4.</span>
                <span>View sales in the Shop Dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold mt-1">5.</span>
                <span>Receive payouts after Troll City's 12% fee</span>
              </li>
            </ol>
          </div>
        </section>

        {/* FAQ / Terms */}
        <section className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-200">
            Troll City Shop Terms (Simple Version)
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-purple-300 mb-2">Platform Fees</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Troll City charges a <span className="text-purple-300 font-semibold">12% fee</span> on all shop sales</li>
                <li>• You keep 88% of all sales made through the platform</li>
                <li>• Fees help maintain Troll City's streaming infrastructure</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-purple-300 mb-2">Seller Responsibilities</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• You're responsible for shipping and handling</li>
                <li>• Customer service for all products sold</li>
                <li>• Fraudulent or illegal items are prohibited</li>
                <li>• Troll City may suspend shops for violations</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="font-semibold text-purple-300 mb-2">Need Help?</h3>
            <p className="text-sm text-gray-400">
              Contact Troll City support or check our{" "}
              <a href="/help/shop" className="text-purple-400 hover:text-purple-300 underline">
                Shop Integration Guide
              </a>{" "}
              for detailed setup instructions.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
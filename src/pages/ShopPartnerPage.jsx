import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ShopPartnerPage() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [shop, setShop] = useState(null);
  const [error, setError] = useState(null);

  // Load current user shop connection from Supabase (shop_partners table)
  useEffect(() => {
    const loadShop = async () => {
      setLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setError("Please log in to connect your store.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("shop_partners")
        .select("id, shop_domain, shop_name, status, last_synced_at")
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

  return (
    <div className="p-6 w-full max-w-6xl mx-auto text-gray-200">
      {/* Page header */}
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-green-400 mb-2">
          Sell on Troll City
        </h1>
        <p className="text-sm text-gray-400">
          Connect your Shopify store and sell products directly during your
          Troll City livestreams. Troll City takes a fair <span className="text-purple-300 font-semibold">12% platform fee</span>,
          you keep the rest.
        </p>
      </header>

      {/* Connection status + CTA */}
      <section className="grid gap-6 md:grid-cols-3 mb-8">
        <div className="md:col-span-2 bg-gray-900 border border-green-700 rounded-2xl p-6 shadow-lg shadow-green-500/20">
          <h2 className="text-xl font-semibold mb-2 text-green-400">
            1. Connect Your Shopify Store
          </h2>
          <p className="text-gray-300 text-sm mb-4">
            Use the button below to start the Shopify connection. After
            connecting, your products can be shown live on-screen while you
            stream, and orders will appear in your Shop Dashboard.
          </p>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <button
              disabled={loading}
              onClick={handleConnectClick}
              className={`px-5 py-2 rounded-md font-semibold text-white transition ${
                connected
                  ? "bg-gray-700 cursor-pointer hover:bg-gray-600"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {connected ? "Reconnect Shopify" : "Connect Shopify Store"}
            </button>

            <div className="text-xs text-gray-400">
              Status:{" "}
              <span className={statusColor()}>
                {connectionStatus()}
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
            <p className="text-xs text-gray-500 mt-2">
              Last synced:{" "}
              {new Date(shop.last_synced_at).toLocaleString()}
            </p>
          )}

          {error && (
            <p className="text-xs text-red-400 mt-2">
              {error}
            </p>
          )}
        </div>

        {/* Benefits card */}
        <div className="bg-gray-900 border border-purple-700 rounded-2xl p-6 shadow-lg shadow-purple-500/20">
          <h3 className="text-lg font-semibold mb-2 text-purple-300">
            Why Sell on Troll City?
          </h3>
          <ul className="text-xs text-gray-300 space-y-2">
            <li>• Live product drops during your streams</li>
            <li>• Troll City only takes 12% platform fee</li>
            <li>• Instant visibility to your Troll fans</li>
            <li>• Orders tracked in your Shop Dashboard</li>
            <li>• Works with your existing Shopify setup</li>
          </ul>
        </div>
      </section>

      {/* Product management section */}
      <section className="grid gap-6 md:grid-cols-3 mb-10">
        <div className="md:col-span-2 bg-gray-900 border border-purple-700 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-2 text-purple-400">
            2. Manage Imported Products
          </h2>
          <p className="text-gray-300 text-sm mb-4">
            After connecting your store, your Shopify products will sync to
            Troll City. You will be able to choose which products appear on
            screen during your shows.
          </p>

          <div className="h-40 flex items-center justify-center bg-gray-950/60 border border-dashed border-gray-700 rounded-xl text-gray-500 text-sm">
            {connected
              ? "No products imported yet. Once your Shopify integration is live, products will appear here."
              : "Connect your Shopify store first to start importing products."}
          </div>
        </div>

        {/* Quick checklist */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-200">
            Quick Start Checklist
          </h3>
          <ol className="list-decimal list-inside text-xs text-gray-300 space-y-1.5">
            <li>Connect your Shopify account</li>
            <li>Choose products for livestream promotion</li>
            <li>Go live on Troll City with your shop enabled</li>
            <li>View sales in the Shop Dashboard</li>
            <li>Receive payouts after Troll City's 12% fee</li>
          </ol>
        </div>
      </section>

      {/* FAQ / Terms */}
      <section className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-3 text-gray-200">
          Troll City Shop Terms (Simple Version)
        </h2>
        <ul className="text-xs text-gray-300 space-y-2">
          <li>
            • Troll City charges a <span className="text-purple-300 font-semibold">12% fee</span> on all shop
            sales made through the platform.
          </li>
          <li>
            • You are responsible for shipping, handling, and customer service
            for all products sold.
          </li>
          <li>
            • Fraudulent, illegal, or dangerous items are strictly prohibited.
          </li>
          <li>
            • Troll City may pause or remove your shop access if violations are
            detected.
          </li>
        </ul>
      </section>
    </div>
  );
}
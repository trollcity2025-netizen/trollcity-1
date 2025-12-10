import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";

export default function ShopDashboard() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [error, setError] = useState(null);

  const PLATFORM_FEE_PERCENT = 12;

  // Load orders & payouts for current user
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setError("Please log in to view your shop dashboard.");
        setLoading(false);
        return;
      }

      const [ordersRes, payoutsRes] = await Promise.all([
        supabase
          .from("shop_orders")
          .select(
            "id, product_name, customer_name, total_usd, created_at, status"
          )
          .eq("seller_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("shop_payouts")
          .select("id, amount_usd, status, method, created_at")
          .eq("seller_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (ordersRes.error) {
        console.error("shop_orders error", ordersRes.error);
        setError("Unable to load orders.");
      } else {
        setOrders(ordersRes.data || []);
      }

      if (payoutsRes.error) {
        console.error("shop_payouts error", payoutsRes.error);
      } else {
        setPayouts(payoutsRes.data || []);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  // Derived stats
  const stats = useMemo(() => {
    const totalSales = orders.reduce(
      (sum, o) => sum + (o.total_usd || 0),
      0
    );
    const platformFee = (totalSales * PLATFORM_FEE_PERCENT) / 100;
    const yourEarnings = totalSales - platformFee;

    const pendingPayouts = payouts
      .filter((p) => p.status === "pending")
      .reduce((sum, p) => sum + (p.amount_usd || 0), 0);

    return {
      totalSales,
      platformFee,
      yourEarnings,
      pendingPayouts,
    };
  }, [orders, payouts]);

  return (
    <div className="p-6 w-full max-w-6xl mx-auto text-gray-200">
      {/* Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-purple-400 mb-1">
            Shop Earnings
          </h1>
          <p className="text-sm text-gray-400">
            Track sales from your Shopify-powered Troll City shop. Troll City
            keeps <span className="font-semibold text-purple-300">12%</span>,
            you keep <span className="font-semibold text-green-300">88%</span>.
          </p>
        </div>
        <div className="text-xs text-gray-500">
          Platform fee:{" "}
          <span className="text-purple-300 font-semibold">
            {PLATFORM_FEE_PERCENT}%
          </span>
        </div>
      </header>

      {error && (
        <div className="mb-4 text-xs text-red-400 bg-red-900/30 border border-red-600 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Stats cards */}
      <section className="grid gap-4 grid-cols-1 md:grid-cols-4 mb-8">
        <div className="bg-gray-900 border border-purple-700 rounded-xl p-4">
          <h3 className="text-xs text-gray-400 uppercase tracking-wide">
            Total Sales
          </h3>
          <p className="text-2xl font-bold text-white mt-1">
            ${stats.totalSales.toFixed(2)}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            Gross revenue from Troll City shop.
          </p>
        </div>

        <div className="bg-gray-900 border border-green-700 rounded-xl p-4">
          <h3 className="text-xs text-gray-400 uppercase tracking-wide">
            Your Earnings
          </h3>
          <p className="text-2xl font-bold text-green-300 mt-1">
            ${stats.yourEarnings.toFixed(2)}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            Gross sales minus the 12% Troll City fee.
          </p>
        </div>

        <div className="bg-gray-900 border border-purple-500 rounded-xl p-4">
          <h3 className="text-xs text-gray-400 uppercase tracking-wide">
            Troll City Fee
          </h3>
          <p className="text-2xl font-bold text-purple-300 mt-1">
            ${stats.platformFee.toFixed(2)}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            12% kept by the platform to keep the lights on.
          </p>
        </div>

        <div className="bg-gray-900 border border-yellow-600 rounded-xl p-4">
          <h3 className="text-xs text-gray-400 uppercase tracking-wide">
            Pending Payouts
          </h3>
          <p className="text-2xl font-bold text-yellow-300 mt-1">
            ${stats.pendingPayouts.toFixed(2)}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            Approved but not yet paid to you.
          </p>
        </div>
      </section>

      {/* Recent orders */}
      <section className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-gray-200">
            Recent Orders
          </h2>
          {loading && (
            <span className="text-xs text-gray-500">Loading…</span>
          )}
        </div>

        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-gray-300">
            <thead className="bg-gray-800 text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="p-2 text-left">Order</th>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Customer</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-right">Your Cut (88%)</th>
                <th className="p-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-gray-600"
                  >
                    No orders yet. Go live and promote your products on
                    Troll City!
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const total = order.total_usd || 0;
                  const yourCut = total * (1 - PLATFORM_FEE_PERCENT / 100);

                  return (
                    <tr
                      key={order.id}
                      className="border-t border-gray-800 bg-black/20"
                    >
                      <td className="p-2 align-middle">
                        <span className="text-gray-400 text-[11px]">
                          #{order.id.slice(0, 8)}
                        </span>
                        <div className="text-[10px] text-gray-500">
                          {order.created_at
                            ? new Date(
                                order.created_at
                              ).toLocaleString()
                            : ""}
                        </div>
                      </td>
                      <td className="p-2 align-middle">
                        {order.product_name || "—"}
                      </td>
                      <td className="p-2 align-middle">
                        {order.customer_name || "—"}
                      </td>
                      <td className="p-2 text-right align-middle">
                        ${total.toFixed(2)}
                      </td>
                      <td className="p-2 text-right align-middle text-green-300">
                        ${yourCut.toFixed(2)}
                      </td>
                      <td className="p-2 text-right align-middle">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] ${
                            order.status === "paid"
                              ? "bg-green-700/40 text-green-200 border border-green-500/60"
                              : order.status === "pending"
                              ? "bg-yellow-700/40 text-yellow-200 border border-yellow-500/60"
                              : "bg-gray-700/40 text-gray-200 border border-gray-500/60"
                          }`}
                        >
                          {order.status || "unknown"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payout history */}
      <section className="bg-gray-900 border border-purple-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-purple-300">
            Payout History
          </h2>
          {loading && (
            <span className="text-xs text-gray-500">Loading…</span>
          )}
        </div>

        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-gray-300">
            <thead className="bg-gray-800 text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="p-2 text-left">Payout</th>
                <th className="p-2 text-left">Method</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-right">Status</th>
                <th className="p-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-4 text-center text-gray-600"
                  >
                    No payouts yet. Once your shop orders are processed, payouts
                    will appear here.
                  </td>
                </tr>
              ) : (
                payouts.map((payout) => (
                  <tr
                    key={payout.id}
                    className="border-t border-gray-800 bg-black/20"
                  >
                    <td className="p-2 align-middle text-[11px] text-gray-400">
                      #{payout.id.slice(0, 8)}
                    </td>
                    <td className="p-2 align-middle">
                      {payout.method || "—"}
                    </td>
                    <td className="p-2 text-right align-middle text-green-300">
                      ${Number(payout.amount_usd || 0).toFixed(2)}
                    </td>
                    <td className="p-2 text-right align-middle">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] ${
                          payout.status === "completed"
                            ? "bg-green-700/40 text-green-200 border border-green-500/60"
                            : payout.status === "pending"
                            ? "bg-yellow-700/40 text-yellow-200 border border-yellow-500/60"
                            : "bg-gray-700/40 text-gray-200 border border-gray-500/60"
                        }`}
                      >
                        {payout.status || "unknown"}
                      </span>
                    </td>
                    <td className="p-2 align-middle text-[11px] text-gray-400">
                      {payout.created_at
                        ? new Date(payout.created_at).toLocaleString()
                        : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

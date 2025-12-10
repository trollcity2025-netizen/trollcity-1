import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { DollarSign, TrendingUp, Users, Crown, Calendar, Star } from "lucide-react";

function StatCard({ label, value, sub, icon: Icon }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<any>;
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5 text-cyan-400" />
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-cyan-400">
        {value}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function TrollTractDashboard() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [recentGifts, setRecentGifts] = useState<any[]>([]);
  const [contractHistory, setContractHistory] = useState<any[]>([]);
  const [empireEarnings, setEmpireEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      setLoading(true);

      const [{ data: p }, { data: gifts }, { data: history }, { data: empire }] =
        await Promise.all([
          supabase.from("user_profiles").select("*").eq("id", user.id).single(),
          supabase
            .from("trollmond_ledger")
            .select("*")
            .eq("user_id", user.id)
            .ilike("reason", "%gift%")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("trolltract_history")
            .select("*")
            .eq("user_id", user.id)
            .order("activated_at", { ascending: false }),
          supabase
            .from("trollmond_ledger")
            .select("amount")
            .eq("user_id", user.id)
            .ilike("reason", "%Empire%"),
        ]);

      setProfile(p || null);
      setRecentGifts(gifts || []);
      setContractHistory(history || []);
      setEmpireEarnings(
        (empire || []).reduce((sum, row) => sum + (row.amount || 0), 0)
      );
      setLoading(false);
    };

    load();
  }, [user?.id]);

  if (!user) return <div>Please log in to view TrollTract Dashboard</div>;

  if (loading || !profile) {
    return <div className="p-4 text-slate-300">Loading TrollTract Dashboard…</div>;
  }

  const active = profile.trolltract_active;
  const tier = profile.trolltract_tier || "basic";
  const expires = profile.trolltract_expires_at
    ? new Date(profile.trolltract_expires_at)
    : null;
  const daysLeft = expires
    ? Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const tierColors = {
    basic: "text-blue-400",
    gold: "text-yellow-400",
    platinum: "text-purple-400"
  };

  const tierBoosts = {
    basic: "+10% qualifying gifts",
    gold: "+15% qualifying gifts",
    platinum: "+20% qualifying gifts"
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Star className="w-8 h-8 text-cyan-400" />
        <h1 className="text-3xl font-bold">TrollTract Creator Dashboard</h1>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Contract Status"
          value={active ? "Active" : "Not Active"}
          sub={active && expires ? `Expires in ${daysLeft} days` : ""}
          icon={Calendar}
        />
        <StatCard
          label="Tier"
          value={tier.toUpperCase()}
          sub={tierBoosts[tier as keyof typeof tierBoosts]}
          icon={Crown}
        />
        <StatCard
          label="Empire Earnings"
          value={`${empireEarnings} TrollMonds`}
          sub="From recruited creators & viewers"
          icon={Users}
        />
        <StatCard
          label="Recent Gifts Tracked"
          value={recentGifts.length}
          sub="Last 10 qualifying gifts"
          icon={TrendingUp}
        />
      </div>

      {/* Recent gifts table */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-xl font-semibold mb-4">Recent Gift Earnings</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-400 text-xs border-b border-slate-700">
              <tr>
                <th className="text-left py-2 pr-4">When</th>
                <th className="text-left py-2 pr-4">Reason</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentGifts.map((g) => (
                <tr key={g.id} className="border-b border-slate-900/60">
                  <td className="py-2 pr-4">
                    {new Date(g.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">{g.reason}</td>
                  <td className="py-2 text-right">
                    <span className={g.amount > 0 ? "text-green-400" : "text-red-400"}>
                      {g.amount > 0 ? "+" : ""}{g.amount} {g.currency || "coins"}
                    </span>
                  </td>
                </tr>
              ))}
              {recentGifts.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-slate-500 text-xs">
                    No gift earnings logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract history + Empire impact */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">TrollTract Contract History</h3>
          <ul className="space-y-2">
            {contractHistory.map((row) => (
              <li key={row.id} className="border border-slate-700 rounded-xl p-3">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span className={tierColors[row.tier as keyof typeof tierColors] || "text-slate-400"}>
                    {row.tier || "basic"} tier
                  </span>
                  <span>
                    {new Date(row.activated_at).toLocaleDateString()} —{" "}
                    {row.amount_paid} coins
                  </span>
                </div>
                {row.notes && (
                  <p className="text-slate-200 text-xs">{row.notes}</p>
                )}
              </li>
            ))}
            {contractHistory.length === 0 && (
              <li className="text-xs text-slate-500">
                No contract history yet. Once your TrollTract is approved,
                you'll see your contract timeline here.
              </li>
            )}
          </ul>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Empire Program Impact</h3>
          <p className="text-sm text-slate-300 mb-4">
            Track how your recruited creators and viewers boosted your
            earnings under the Empire Partner program.
          </p>
          <div className="text-sm text-slate-300">
            <div className="flex justify-between py-1">
              <span>Total Empire Coins Earned</span>
              <span className="font-semibold text-cyan-400">
                {empireEarnings} TrollMonds
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// src/components/admin/AdminTrollTractPanel.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export function AdminTrollTractPanel() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContracts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("trolltract_contracts")
        .select("id, user_id, coins_spent, earnings_multiplier, goal_monthly_coins, signed_at, profiles(username, display_name)")
        .order("signed_at", { ascending: false });

      if (error) {
        console.error("Error loading TrollTract contracts:", error);
      } else {
        setContracts(data || []);
      }
      setLoading(false);
    };

    loadContracts();
  }, []);

  return (
    <Card className="bg-slate-950/60 border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-50">
          TrollTract Contracts
          <Badge variant="outline" className="text-xs">
            {contracts.length} active records
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-slate-100/90">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading contracts...
          </div>
        ) : contracts.length === 0 ? (
          <p>No contracts found yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead className="border-b border-slate-700 text-slate-300">
                <tr>
                  <th className="text-left py-2">User</th>
                  <th className="text-left py-2">Coins Spent</th>
                  <th className="text-left py-2">Earnings x</th>
                  <th className="text-left py-2">Goal (Monthly)</th>
                  <th className="text-left py-2">Signed At</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800/60">
                    <td className="py-2">
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {c.profiles?.display_name || c.profiles?.username || c.user_id}
                        </span>
                        <span className="text-xs text-slate-400">
                          {c.profiles?.username && `@${c.profiles.username}`}
                        </span>
                      </div>
                    </td>
                    <td className="py-2">
                      {c.coins_spent?.toLocaleString?.() ?? c.coins_spent}
                    </td>
                    <td className="py-2">
                      {c.earnings_multiplier
                        ? `${Math.round(Number(c.earnings_multiplier) * 100)}%`
                        : "100%"}
                    </td>
                    <td className="py-2">
                      {c.goal_monthly_coins
                        ? c.goal_monthly_coins.toLocaleString()
                        : "-"}
                    </td>
                    <td className="py-2">
                      {c.signed_at
                        ? new Date(c.signed_at).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuthStore } from "../../../lib/store";
import { toast } from "sonner";
import { DollarSign, Check, X, Clock } from "lucide-react";

interface Payout {
  id: string;
  user_id: string;
  coins_requested: number;
  usd_estimate: string;
  payout_address: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  user_profiles?: { username: string | null };
}

export default function AdminPayoutDashboard() {
  const { user, profile } = useAuthStore() as any;
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin" || profile?.is_admin;

  useEffect(() => {
    if (!user || !isAdmin) return;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("payout_requests")
        .select("*, user_profiles(username)")
        .order("created_at", { ascending: false });
      
      if (!error && data) {
        setPayouts(data as any);
      } else if (error) {
        console.error("Error loading payouts:", error);
        toast.error("Failed to load payout requests");
      }
      setLoading(false);
    };

    load();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("payout_requests_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payout_requests" },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin]);

  const updateStatus = async (id: string, status: string) => {
    let note = null;
    if (status === "rejected") {
      const reason = prompt("Rejection reason?");
      if (reason === null) return; // User cancelled
      note = reason;
    }

    const { error } = await supabase
      .from("payout_requests")
      .update({
        status,
        admin_note: note,
        processed_at:
          status === "paid" || status === "rejected"
            ? new Date().toISOString()
            : null
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      toast.error("Failed to update status.");
      return;
    }

    setPayouts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status, admin_note: note } : p))
    );
    toast.success(`Payout ${status}`);
  };

  if (!user || !isAdmin) {
    return (
      <div className="p-6 text-center text-white">
        Admin access only.
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-900 text-green-300";
      case "approved":
        return "bg-blue-900 text-blue-300";
      case "rejected":
        return "bg-red-900 text-red-300";
      default:
        return "bg-yellow-900 text-yellow-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <Check className="w-4 h-4" />;
      case "rejected":
        return <X className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto text-white">
      <div className="flex items-center gap-3 mb-6">
        <DollarSign className="w-8 h-8 text-purple-400" />
        <h1 className="text-2xl font-bold">Admin – Payout Requests</h1>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : payouts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No payout requests.</div>
      ) : (
        <div className="space-y-3">
          {payouts.map((p) => (
            <div
              key={p.id}
              className="rounded-lg bg-black/60 border border-purple-700/70 p-4 flex justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-semibold text-lg">
                    {p.user_profiles?.username || p.user_id.substring(0, 8)}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${getStatusColor(p.status)}`}>
                    {getStatusIcon(p.status)}
                    {p.status}
                  </span>
                </div>
                <div className="text-sm opacity-80 mb-1">
                  {p.coins_requested.toLocaleString()} coins → $
                  {Number(p.usd_estimate).toFixed(2)}
                </div>
                <div className="text-xs opacity-70 mb-1">
                  PayPal: <span className="font-mono">{p.payout_address}</span>
                </div>
                <div className="text-xs opacity-70">
                  Requested: {new Date(p.created_at).toLocaleString()}
                </div>
                {p.processed_at && (
                  <div className="text-xs opacity-70">
                    Processed: {new Date(p.processed_at).toLocaleString()}
                  </div>
                )}
                {p.admin_note && (
                  <div className="text-xs opacity-70 mt-2 p-2 bg-red-900/20 rounded border border-red-700/50">
                    Note: {p.admin_note}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {p.status === "pending" && (
                  <button
                    type="button"
                    className="text-xs px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 transition-colors"
                    onClick={() => updateStatus(p.id, "approved")}
                  >
                    Approve
                  </button>
                )}
                {(p.status === "pending" || p.status === "approved") && (
                  <button
                    className="text-xs px-3 py-2 rounded bg-green-600 hover:bg-green-700 transition-colors"
                    onClick={() => updateStatus(p.id, "paid")}
                  >
                    Mark Paid
                  </button>
                )}
                {p.status !== "rejected" && (
                  <button
                    className="text-xs px-3 py-2 rounded bg-red-600 hover:bg-red-700 transition-colors"
                    onClick={() => updateStatus(p.id, "rejected")}
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


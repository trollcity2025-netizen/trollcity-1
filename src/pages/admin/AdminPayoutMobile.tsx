import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import ReceiptUploadModal from "./components/ReceiptUploadModal";

interface PayoutRequest {
  id: string;
  user_id: string;
  username: string;
  coins: number;
  cash_value: number;
  status: string;
  created_at: string;
  payout_method: string;
  receipt_url?: string;
}

const AdminPayoutMobile: React.FC = () => {
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState<PayoutRequest | null>(null);

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from("payout_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load requests");
      return;
    }

    setRequests(data || []);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      await loadRequests();
    };

    void init();

    const channel = supabase
      .channel("admin-payouts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payout_requests" },
        () => loadRequests()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);


  const handleReject = async (req: PayoutRequest) => {
    try {
      await supabase
        .from("payout_requests")
        .update({ status: "rejected" })
        .eq("id", req.id);

      await supabase.from("notifications").insert([
        {
          user_id: req.user_id,
          type: "payout",
          content: `Your payout request was rejected. Please review your details or contact support.`,
        },
      ]);

      toast.success(`Rejected payout for ${req.username}`);
      loadRequests();
    } catch {
      toast.error("Error rejecting payout");
    }
  };

  if (loading) return <p className="text-center mt-10 text-white">Loading...</p>;

  return (
    <div className="p-4 max-w-md mx-auto text-white">
      <h2 className="text-xl font-semibold mb-4">Payout Requests</h2>

      {requests.map((req) => (
        <div
          key={req.id}
          className="bg-gray-800 rounded-lg p-4 mb-3 shadow border border-gray-700"
        >
          <p className="text-sm">
            <strong>{req.username}</strong> requested{" "}
            <span className="text-green-400">${req.cash_value}</span>
          </p>
          <p className="text-xs text-gray-400">
            Coins: {req.coins.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">Method: {req.payout_method}</p>
          <p
            className={`text-xs font-medium ${
              req.status === "pending"
                ? "text-yellow-400"
                : req.status === "approved"
                ? "text-green-400"
                : req.status === "rejected"
                ? "text-red-400"
                : ""
            }`}
          >
            Status: {req.status.toUpperCase()}
          </p>
          {req.receipt_url && (
            <a
              href={req.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline text-xs block mt-1"
            >
              View Payment Receipt
            </a>
          )}

          {req.status === "pending" && (
            <div className="flex justify-between mt-3">
              <button
                type="button"
                onClick={() => setShowReceiptModal(req)}
                className="bg-green-500 hover:bg-green-600 text-xs px-3 py-1 rounded"
              >
                Approve & Upload Receipt
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleReject(req)
                }}
                className="bg-red-500 hover:bg-red-600 text-xs px-3 py-1 rounded"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}

      {showReceiptModal && (
        <ReceiptUploadModal
          request={showReceiptModal}
          onClose={() => setShowReceiptModal(null)}
          onUploaded={loadRequests}
        />
      )}
    </div>
  );
};

export default AdminPayoutMobile;

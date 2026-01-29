import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";

interface SupportTicket {
  id: string;
  user_id: string;
  username: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  admin_response?: string;
  admin_id?: string;
  response_at?: string;
}

const AdminSupportTickets: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<{ id: string; message: string } | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});

  const loadTickets = useCallback(async () => {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load tickets");
      return;
    }
    setTickets(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTickets();

    const channel = supabase
      .channel("admin-support-tickets")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_tickets" },
        () => loadTickets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTickets]);

  const sendResponse = useCallback(async (ticketId: string, _userId: string) => {
    if (!responding) return;

    try {
      const { error } = await supabase.rpc('resolve_support_ticket', {
        p_ticket_id: ticketId,
        p_response: responding.message
      })

      if (error) throw error

      toast.success("Response sent to user");
      setResponding(null);
      loadTickets();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to send response");
    }
  }, [responding, loadTickets]);

  const closeTicket = useCallback(async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "closed", response_at: new Date().toISOString() })
        .eq("id", ticketId);
      if (error) throw error;
      toast.success("Ticket closed");
      loadTickets();
    } catch (e) {
      console.error("Close ticket failed", e);
      toast.error("Failed to close ticket");
    }
  }, [loadTickets]);

  const deleteTicket = useCallback(async (ticketId: string) => {
    try {
      if (!confirm("Delete this support ticket? This cannot be undone.")) return;
      
      // Optimistically remove from state first
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
      
      const { error } = await supabase.rpc('delete_support_ticket', { p_ticket_id: ticketId })
        
      if (error) {
        console.error("Delete ticket failed", error);
        toast.error("Failed to delete ticket");
        // Reload to restore state on error
        loadTickets();
      } else {
        toast.success("Ticket deleted");
      }
    } catch (e) {
      console.error("Delete ticket failed", e);
      toast.error("Failed to delete ticket");
      // Reload to restore state on error  
      loadTickets();
    }
  }, [loadTickets]);

  const grouped = useMemo(() => {
    const map = new Map<string, { user_id: string; username: string; email: string; tickets: SupportTicket[] }>();
    tickets.forEach((ticket) => {
      const entry = map.get(ticket.user_id);
      if (entry) {
        entry.tickets.push(ticket);
      } else {
        map.set(ticket.user_id, {
          user_id: ticket.user_id,
          username: ticket.username,
          email: ticket.email,
          tickets: [ticket],
        });
      }
    });
    return Array.from(map.values());
  }, [tickets]);

  return (
    <div className="p-4 text-white max-w-5xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Support Tickets</h2>

      {loading && <p className="text-center mt-10 text-gray-400">Loading tickets...</p>}

      {!loading && grouped.length === 0 && (
        <p className="text-center text-gray-400">No tickets yet.</p>
      )}

      {grouped.map((group) => (
        <div
          key={group.user_id}
          className="bg-gray-900 border border-gray-700 rounded-xl shadow mb-4"
        >
          <button
            onClick={() =>
              setExpandedUsers((prev) => ({
                ...prev,
                [group.user_id]: !prev[group.user_id],
              }))
            }
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <p className="text-sm text-gray-400">@{group.username}</p>
              <p className="text-xs text-gray-500">{group.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-300">{group.tickets.length} ticket(s)</span>
              <span className="text-xs text-gray-300">
                {expandedUsers[group.user_id] ? "Collapse" : "Expand"}
              </span>
            </div>
          </button>

          {expandedUsers[group.user_id] && (
            <div className="divide-y divide-gray-800">
              {group.tickets.map((t) => (
                <div
                  key={t.id}
                  className="p-4 space-y-3"
                >
                  <div>
                    <p className="text-xs text-gray-400">Category: <strong>{t.category}</strong></p>
                    <h3 className="font-semibold text-white">{t.subject}</h3>
                    <p className="text-sm text-yellow-400">Status: {t.status}</p>
                  </div>

                  <p className="bg-gray-900 p-3 rounded text-sm">{t.message}</p>

                  {!t.admin_response && (
                    <button
                      onClick={() => setResponding({ id: t.id, message: "" })}
                      className="mt-1 bg-purple-600 px-3 py-1 rounded text-xs"
                    >
                      Reply to Ticket
                    </button>
                  )}

                  {responding?.id === t.id && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={responding.message}
                        onChange={(e) =>
                          setResponding({ ...responding, message: e.target.value })
                        }
                        className="w-full bg-gray-900 p-2 text-sm rounded border border-gray-700"
                        rows={3}
                        placeholder="Write your response..."
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => sendResponse(t.id, t.user_id)}
                          className="bg-green-500 px-3 py-1 rounded text-xs"
                        >
                          Send Response
                        </button>
                        <button
                          onClick={() => setResponding(null)}
                          className="bg-gray-700 px-3 py-1 rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {t.admin_response && (
                    <div className="mt-3 bg-gray-900 p-3 rounded-lg">
                      <p className="text-sm text-green-400">Admin Reply:</p>
                      <p className="text-xs text-gray-200">{t.admin_response}</p>
                    </div>
                  )}

                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => closeTicket(t.id)}
                      className="bg-yellow-600 hover:bg-yellow-500 px-3 py-1 rounded text-xs"
                    >
                      Close Ticket
                    </button>
                    <button
                      onClick={() => deleteTicket(t.id)}
                      className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-xs"
                    >
                      Delete Ticket
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AdminSupportTickets;
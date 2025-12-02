import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/store";
import { Shield, Clock, User, Video } from "lucide-react";

interface OfficerAssignment {
  id: string;
  officer_id: string;
  stream_id: string;
  joined_at: string;
  left_at: string | null;
  status: string;
  user_profiles?: {
    username: string | null;
  };
  streams?: {
    title: string | null;
    host_id: string;
  };
}

export default function AdminLiveOfficersTracker() {
  const { profile } = useAuthStore();
  const [assignments, setAssignments] = useState<OfficerAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin" || profile?.is_admin;

  useEffect(() => {
    if (!isAdmin) return;

    const loadAssignments = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("officer_live_assignments")
          .select(`
            id,
            officer_id,
            stream_id,
            joined_at,
            left_at,
            last_activity,
            status,
            auto_clocked_out,
            user_profiles!officer_live_assignments_officer_id_fkey(username),
            streams(title, host_id)
          `)
          .eq("status", "active")
          .order("joined_at", { ascending: false });

        if (error) {
          console.error("Error loading assignments:", error);
        } else {
          setAssignments((data as any) || []);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("officer_live_assignments_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "officer_live_assignments",
          filter: "status=eq.active"
        },
        () => {
          loadAssignments();
        }
      )
      .subscribe();

    // Refresh every 30 seconds
    const interval = setInterval(loadAssignments, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [isAdmin]);

  const calculateDuration = (joinedAt: string) => {
    const now = Date.now();
    const joined = new Date(joinedAt).getTime();
    const minutes = Math.floor((now - joined) / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-white">
        Admin access only.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto text-white min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-purple-400" />
        <h1 className="text-3xl font-bold">Live Officer Tracker</h1>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading assignments...</div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No officers currently assigned to live streams.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="bg-black/60 border border-purple-600 p-4 rounded-lg flex justify-between items-center hover:bg-black/80 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <User className="w-5 h-5 text-purple-400" />
                  <p className="font-semibold text-lg">
                    {a.user_profiles?.username || a.officer_id.substring(0, 8)}
                  </p>
                  <span className="px-2 py-1 rounded text-xs bg-green-900 text-green-300">
                    Active
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm opacity-80 mb-1">
                  <Video className="w-4 h-4" />
                  <p>
                    <strong>Stream:</strong> {a.streams?.title || a.stream_id}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs opacity-70">
                  <Clock className="w-4 h-4" />
                  <p>
                    <strong>Joined:</strong> {new Date(a.joined_at).toLocaleString()}
                  </p>
                </div>
                {a.last_activity && (
                  <div className="text-xs opacity-60 mt-1">
                    Last activity: {new Date(a.last_activity).toLocaleTimeString()}
                  </div>
                )}
                {a.auto_clocked_out && (
                  <div className="text-xs text-yellow-400 mt-1">
                    ⚠️ Auto-clockout pending
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-purple-300 mb-1">
                  Duration
                </div>
                <div className="text-lg font-bold text-green-400">
                  {calculateDuration(a.joined_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Summary */}
      {assignments.length > 0 && (
        <div className="mt-6 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
          <p className="text-sm opacity-80">
            <strong>{assignments.length}</strong> officer{assignments.length !== 1 ? "s" : ""} currently active
          </p>
        </div>
      )}
    </div>
  );
}


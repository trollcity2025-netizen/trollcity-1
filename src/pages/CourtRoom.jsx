import React, { useEffect, useState } from "react";
import { useAuthStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { LiveKitRoom, GridLayout, ParticipantTile } from "@livekit/components-react";
import "@livekit/components-styles";
import { toast } from "sonner";
import RequireRole from "../components/RequireRole";

export default function CourtRoom() {
  const { user, profile } = useAuthStore();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [participantsAllowed, setParticipantsAllowed] = useState([]);

  useEffect(() => {
    if (!user) return;
    initCourtroom();
  }, [user]);

  const initCourtroom = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke("livekit-token", {
        body: { room: "troll-court", user_id: user.id, role: profile.role }
      });

      if (error) throw error;

      setToken(data?.token);

      // who can broadcast?
      const allowed = ["admin", "lead_troll_officer", "troll_officer", "defendant", "accuser", "witness"];
      setParticipantsAllowed(allowed);

    } catch (err) {
      console.error("Courtroom token error:", err);
      toast.error("Unable to join court session.");
    } finally {
      setLoading(false);
    }
  };

  const canPublish = participantsAllowed.includes(profile?.role);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-10 text-center">
        Joining Troll Court...
      </div>
    );
  }

  return (
    <RequireRole roles={["user", "troll_officer", "lead_troll_officer", "admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-4">

        <h1 className="text-3xl font-bold text-center mb-4">
          ⚖️ Troll Court Session
        </h1>

        <LiveKitRoom
          token={token}
          serverUrl={import.meta.env.VITE_LIVEKIT_URL}
          connect={true}
          audio={canPublish}
          video={canPublish}
          className="w-full h-[70vh] bg-black rounded-xl overflow-hidden"
        >
          <GridLayout
            className="w-full h-full"
            style={{ "--lk-grid-gap": "10px" }}
          >
            <ParticipantTile />
          </GridLayout>

        </LiveKitRoom>

        <div className="mt-6 bg-zinc-900 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Court Roles</h2>
          <p className="text-gray-400">
            Only Admin / Lead / Officers / defendant / accuser / witnesses can broadcast.
            Everyone else joins as an audience member with chat only.
          </p>
        </div>

      </div>
    </RequireRole>
  );
}
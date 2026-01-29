import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Report {
  id: string;
  stream_id: string;
  reason: string;
  status: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  username: string; // Often stored directly or joined
  content: string;
  created_at: string;
}

interface BannedUser {
  id: string;
  username: string;
  email: string;
  is_banned: boolean;
}

const ReportsPanel = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatMessage[]>([]);
  const [bans, setBans] = useState<BannedUser[]>([]);

  const loadReports = async () => {
    const { data: reportsData } = await supabase
      .from("stream_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setReports((reportsData as Report[]) || []);

    const { data: chatData } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setChatLogs((chatData as ChatMessage[]) || []);

    const { data: bansData } = await supabase
      .from("user_profiles")
      .select("id, username, email, is_banned")
      .eq("is_banned", true)
      .order("created_at", { ascending: false });
    setBans((bansData as BannedUser[]) || []);
  };

  useEffect(() => {
    loadReports();

    const reportsChannel = supabase
      .channel("admin-reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_reports" }, loadReports)
      .subscribe();

    const chatChannel = supabase
      .channel("admin-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_messages" }, loadReports)
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(chatChannel);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Abuse Reports</h3>
        <div className="bg-black/40 rounded p-3 max-h-64 overflow-auto">
          {reports.length === 0 ? (
            <p className="text-gray-500">No reports found.</p>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="border-b border-gray-700 py-2">
                <p>Stream: {report.stream_id}</p>
                <p>Reason: {report.reason}</p>
                <p>Status: {report.status}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Chat Logs</h3>
        <div className="bg-black/40 rounded p-3 max-h-64 overflow-auto">
          {chatLogs.length === 0 ? (
            <p className="text-gray-500">No chat logs found.</p>
          ) : (
            chatLogs.map((msg) => (
              <div key={msg.id} className="border-b border-gray-700 py-1">
                <p><strong>{msg.username}:</strong> {msg.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Banned Users</h3>
        <div className="bg-black/40 rounded p-3 max-h-64 overflow-auto">
          {bans.length === 0 ? (
            <p className="text-gray-500">No banned users found.</p>
          ) : (
            bans.map((user) => (
              <div key={user.id} className="border-b border-gray-700 py-2">
                <p>@{user.username} - {user.email}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPanel;
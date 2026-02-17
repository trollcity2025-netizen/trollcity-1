import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { X, Send } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SendAnnouncementModal({ isOpen, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [broadcasterSearch, setBroadcasterSearch] = useState('');
  const [broadcasters, setBroadcasters] = useState<{ id: string; username: string }[]>([]);
  const [selectedBroadcaster, setSelectedBroadcaster] = useState<{ id: string; username: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (broadcasterSearch.length > 2) {
      const searchBroadcasters = async () => {
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('id, username')
            .eq('role', 'broadcaster')
            .ilike('username', `%${broadcasterSearch}%`)
            .limit(10);
          if (error) throw error;
          setBroadcasters(data || []);
        } catch (error) {
          console.error('Error searching broadcasters:', error);
          toast.error('Failed to search for broadcasters');
        }
      };
      searchBroadcasters();
    } else {
      setBroadcasters([]);
    }
  }, [broadcasterSearch]);

  const handleSend = async () => {
    if (!selectedBroadcaster) {
      toast.error('Please select a broadcaster');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not logged in");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-announcement`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: '📢 Officer Announcement',
            body: message,
            user_ids: [selectedBroadcaster.id],
          }),
        }
      );

      const out = await res.json();
      if (!res.ok) {
        console.error("Edge function error:", out);
        throw new Error(out?.message || "Failed to send announcement");
      }

      toast.success(`Announcement sent to ${selectedBroadcaster.username}`);
      setMessage('');
      setSelectedBroadcaster(null);
      setBroadcasterSearch('');
      onClose();
    } catch (error) {
      console.error("Error sending announcement:", error);
      toast.error("Failed to send announcement");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Send Broadcaster Announcement</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search Broadcaster</label>
            <input
              type="text"
              value={broadcasterSearch}
              onChange={(e) => {
                setBroadcasterSearch(e.target.value);
                setSelectedBroadcaster(null);
              }}
              placeholder="Search by username (min 3 chars)..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2"
            />
            {broadcasters.length > 0 && !selectedBroadcaster && (
              <ul className="bg-slate-800 border border-slate-700 rounded-lg mt-2 max-h-48 overflow-y-auto">
                {broadcasters.map((broadcaster) => (
                  <li
                    key={broadcaster.id}
                    onClick={() => {
                      setSelectedBroadcaster(broadcaster);
                      setBroadcasterSearch(broadcaster.username);
                      setBroadcasters([]);
                    }}
                    className="px-4 py-2 cursor-pointer hover:bg-slate-700"
                  >
                    {broadcaster.username}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your announcement message..."
              rows={4}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 resize-none"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !selectedBroadcaster || !message.trim()}
            className="flex items-center justify-center w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            <Send className="w-4 h-4 mr-2" />
            {sending ? 'Sending...' : 'Send Announcement'}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function TrollFamilyHub() {
  const { data: me } = useQuery({ queryKey: ['currentUser'], queryFn: () => supabase.auth.me(), staleTime: 5000 });
  const [families, setFamilies] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const fetchFamilies = async () => {
      try { const { data } = await supabase.from('troll_families').select('*').order('created_date', { ascending: false }); setFamilies(data || []); } catch (_) {}
    };
    fetchFamilies();
  }, []);

  useEffect(() => {
    if (!selectedFamily) return;
    const fid = selectedFamily.id;
    const loadMessages = async () => {
      try { const { data } = await supabase.from('messages').select('*').eq('room', `family_${fid}`).order('created_date', { ascending: false }).limit(200); setMessages(data || []); } catch (_) {}
    };
    loadMessages();
    try {
      const ch = supabase.channel(`family_room_${fid}`);
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.family_${fid}` }, (payload) => {
        const row = payload?.new || null; if (row) setMessages((prev) => [row, ...prev].slice(0, 200));
      }).subscribe();
      return () => { try { ch.unsubscribe(); } catch (_) {} };
    } catch (_) {}
  }, [selectedFamily]);

  const send = async () => {
    if (!selectedFamily || !text.trim()) return;
    const row = { room: `family_${selectedFamily.id}`, text, user_id: me?.id || null, created_date: new Date().toISOString() };
    const { error } = await supabase.from('messages').insert(row);
    if (!error) setText("");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#06060a] to-[#0b0b12] p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 bg-[#11121a] border-[#2a2a3a]">
          <h3 className="text-white font-semibold mb-3">Troll Families</h3>
          <div className="space-y-2">
            {families.map((f) => (
              <button key={f.id} type="button" className={`w-full text-left px-3 py-2 rounded ${selectedFamily?.id === f.id ? 'bg-purple-600/20 border border-purple-600/40' : 'bg-[#0a0a0f]'}`} onClick={() => setSelectedFamily(f)}>
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">{f.name}</span>
                  <Badge className="bg-yellow-500">{f.color || 'purple'}</Badge>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2 p-6 bg-[#11121a] border-[#2a2a3a]">
          {selectedFamily ? (
            <>
              <h3 className="text-white font-semibold mb-3">Family Chat — {selectedFamily.name}</h3>
              <div className="h-[60vh] overflow-y-auto space-y-3 pr-2">
                {messages.map((m) => (
                  <div key={m.id || m.created_date} className="bg-[#0a0a0f] rounded p-3">
                    <div className="text-white text-sm">{m.text}</div>
                    <div className="text-xs text-gray-500 mt-1">{m.created_date ? new Date(m.created_date).toLocaleString() : ''}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something to your family" className="bg-[#0a0a0f] border-[#2a2a3a] text-white" />
                <Button onClick={send} className="bg-purple-600 hover:bg-purple-700">Send</Button>
              </div>
            </>
          ) : (
            <p className="text-gray-400">Select a family to chat and send gifts.</p>
          )}
        </Card>
      </div>
    </main>
  );
}

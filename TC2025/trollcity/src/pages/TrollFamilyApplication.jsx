import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Users, Coins } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { toast } from "sonner";

function saveLS(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }
function loadLS(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } }

export default function TrollFamilyApplication() {
  const [familyName, setFamilyName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("purple");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [minLevel, setMinLevel] = useState(1);
  const [privacy, setPrivacy] = useState("private");
  const [status, setStatus] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setStatus("");
    
    if (supabase.__isConfigured) {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const applicantId = auth?.user?.id || null;
        
        if (!applicantId) {
          toast.error("You must be logged in to submit an application");
          return;
        }

        // Check user's paid coins balance
        const { data: profile } = await supabase
          .from('profiles')
          .select('paid_coins')
          .eq('id', applicantId)
          .single();

        if (!profile || (profile.paid_coins || 0) < 1000) {
          toast.error("You need at least 1000 paid coins to submit a Troll Family application");
          return;
        }

        // Deduct 1000 paid coins from user balance
        const { error: coinError } = await supabase
          .from('profiles')
          .update({ 
            paid_coins: (profile.paid_coins || 0) - 1000 
          })
          .eq('id', applicantId);

        if (coinError) {
          toast.error("Failed to deduct coins. Please try again.");
          return;
        }

        // Proceed with application submission
        const valuesBase = { user_id: applicantId, family_name: familyName, family_description: description, status: 'pending' };
        await supabase.from("troll_family_applications").insert(valuesBase);
        const extra = { family_emoji: emoji || null, family_color: color || null, family_rules: rules || null, min_level: minLevel || 1, privacy: privacy || 'private' };
        await supabase.from("troll_family_applications").update(extra).eq("family_name", familyName).eq("status", 'pending').limit(1);
        
        // Notify admins
        const { data: admins } = await supabase.from('profiles').select('*').eq('role','admin').limit(10);
        if (Array.isArray(admins)) {
          const rows = admins.map(a => ({
            user_id: a.id,
            type: 'family_application',
            title: 'New Troll Family Application',
            message: `${familyName} submitted a troll family application`,
            is_read: false,
            created_date: new Date().toISOString(),
          }));
          await supabase.from('notifications').insert(rows).catch(()=>{});
        }

        toast.success("Application submitted successfully! 1000 paid coins have been deducted from your account.");
      } catch (error) {
        console.error("Application submission error:", error);
        toast.error("Failed to submit application. Please try again.");
        return;
      }
    }
    
    // Local storage fallback
    const payload = { family_name: familyName, emoji, color, description, rules, min_level: minLevel, privacy, created_at: new Date().toISOString(), type: "family" };
    const list = loadLS("tc_apps_family", []);
    saveLS("tc_apps_family", [payload, ...list]);
    
    setStatus("Submitted");
    setFamilyName(""); setEmoji(""); setColor("purple"); setDescription(""); setRules(""); setMinLevel(1); setPrivacy("private");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#120a1f] to-[#0a0a0f] py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Create a Troll Family</h1>
          <p className="text-gray-400">Build your own community within TrollCity</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-[#11121a] border-[#2a2a3a] p-6 lg:col-span-2 rounded-xl">
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-white font-semibold mb-2 block">Family Name *</label>
                <Input value={familyName} onChange={(e)=>setFamilyName(e.target.value)} placeholder="Enter your family name..." className="bg-[#0f0f16] border-[#2a2a3a] text-white" />
              </div>
              <div>
                <label className="text-white font-semibold mb-2 block">Family Emoji</label>
                <Input value={emoji} onChange={(e)=>setEmoji(e.target.value)} placeholder="e.g. 👑" className="bg-[#0f0f16] border-[#2a2a3a] text-white" />
              </div>
              <div>
                <label className="text-white font-semibold mb-2 block">Family Color</label>
                <Select value={color} onValueChange={(v)=>setColor(v)}>
                  <SelectTrigger className="bg-[#0f0f16] border-[#2a2a3a] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purple">Purple</SelectItem>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="red">Red</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="text-white font-semibold mb-2 block">Family Description *</label>
                <Textarea value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Describe your Troll Family and what makes it special..." className="bg-[#0f0f16] border-[#2a2a3a] text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="text-white font-semibold mb-2 block">Family Rules (Optional)</label>
                <Textarea value={rules} onChange={(e)=>setRules(e.target.value)} placeholder="Enter your family rules and guidelines..." className="bg-[#0f0f16] border-[#2a2a3a] text-white" />
              </div>
              <div>
                <label className="text-white font-semibold mb-2 block">Minimum Level</label>
                <Input type="number" min={1} value={minLevel} onChange={(e)=>setMinLevel(parseInt(e.target.value || "1"))} className="bg-[#0f0f16] border-[#2a2a3a] text-white" />
              </div>
              <div>
                <label className="text-white font-semibold mb-2 block">Privacy</label>
                <Select value={privacy} onValueChange={(v)=>setPrivacy(v)}>
                  <SelectTrigger className="bg-[#0f0f16] border-[#2a2a3a] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private (requires approval)</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-3 text-sm text-gray-300">
                Applications are reviewed by admin. If approved, you'll be able to recruit members and build your Troll Family.
              </div>
              <div className="md:col-span-2 flex items-center justify-between">
                {status && <p className="text-emerald-400 text-sm">{status}</p>}
                <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-black">Submit Application</Button>
              </div>
            </form>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/30 p-6 rounded-xl">
            <div className="space-y-3">
              <p className="text-white font-semibold">Application Fee</p>
              <div className="flex items-center space-x-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 font-bold">1000 Paid Coins</span>
              </div>
              <p className="text-sm text-yellow-300">This fee will be deducted from your paid coins balance upon submission.</p>
              <p className="text-sm text-yellow-200">Pick a name, emoji, and color that represents your family.</p>
              <p className="text-sm text-yellow-200">Clear rules help members understand expectations.</p>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

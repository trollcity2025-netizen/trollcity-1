import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function ApplicationsPanel() {
  const qc = useQueryClient();

  const { data: officerApps = [] } = useQuery({
    queryKey: ["apps_officers"],
    queryFn: async () => {
      const { data } = await supabase.from("troll_officer_applications").select("*").order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const { data: familyApps = [] } = useQuery({
    queryKey: ["apps_families"],
    queryFn: async () => {
      const { data } = await supabase.from("troll_family_applications").select("*").order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const approveOfficer = useMutation({
    mutationFn: async (app) => {
      if (!supabase.__isConfigured) throw new Error("Supabase not configured");
      const userId = app.user_id || null;
      if (!userId && !(app.user_email || app.user_username)) throw new Error("Missing applicant id");
      await supabase.from("troll_officer_applications").update({ status: "approved" }).eq("id", app.id);
      if (userId) {
        await supabase.from("profiles").update({ role: "troll_officer", is_troll_officer: true }).eq("id", userId);
      } else if (app.user_email || app.user_username) {
        let q = supabase.from("profiles").select("id").limit(1);
        if (app.user_email) q = q.eq("email", app.user_email);
        if (app.user_username) q = q.eq("username", app.user_username);
        const { data } = await q.single().catch(() => ({ data: null }));
        const uid = data?.id || null;
        if (uid) await supabase.from("profiles").update({ role: "troll_officer", is_troll_officer: true }).eq("id", uid);
      }
      try { await supabase.from("notifications").insert({ user_id: app.user_id, type: "officer_application_status", title: "Officer Application", message: "Approved", is_read: false, created_date: new Date().toISOString() }); } catch (_) {}
      return true;
    },
    onSuccess: () => { qc.invalidateQueries(["apps_officers"]); toast.success("Officer approved"); },
    onError: (e) => toast.error(e?.message || "Approve failed")
  });

  const rejectOfficer = useMutation({
    mutationFn: async (app) => {
      if (!supabase.__isConfigured) throw new Error("Supabase not configured");
      await supabase.from("troll_officer_applications").update({ status: "rejected" }).eq("id", app.id);
      try { await supabase.from("notifications").insert({ user_id: app.user_id, type: "officer_application_status", title: "Officer Application", message: "Rejected", is_read: false, created_date: new Date().toISOString() }); } catch (_) {}
      return true;
    },
    onSuccess: () => { qc.invalidateQueries(["apps_officers"]); toast.success("Officer rejected"); },
    onError: (e) => toast.error(e?.message || "Reject failed")
  });

  const approveFamily = useMutation({
    mutationFn: async (app) => {
      if (!supabase.__isConfigured) throw new Error("Supabase not configured");
      const userId = app.user_id || null;
      await supabase.from("troll_family_applications").update({ status: "approved" }).eq("id", app.id);
      const famRow = {
        name: app.family_name,
        owner_id: userId,
        emoji: app.family_emoji || null,
        color: app.family_color || null,
        created_date: new Date().toISOString(),
      };
      let familyId = null;
      try {
        const { data: created } = await supabase.from("troll_families").insert(famRow).select().single();
        familyId = created?.id || null;
      } catch (_) {}
      if (userId) {
        try { await supabase.from("troll_family_members").insert({ family_id: familyId, user_id: userId, role: "owner", joined_date: new Date().toISOString() }); } catch (_) {}
        try { await supabase.from("profiles").update({ owns_troll_family: true, troll_family_name: app.family_name }).eq("id", userId); } catch (_) {}
      }
      try { await supabase.from("notifications").insert({ user_id: userId, type: "family_application_status", title: "Troll Family Application", message: "Approved", is_read: false, created_date: new Date().toISOString() }); } catch (_) {}
      return true;
    },
    onSuccess: () => { qc.invalidateQueries(["apps_families"]); toast.success("Family approved"); },
    onError: (e) => toast.error(e?.message || "Approve failed")
  });

  const rejectFamily = useMutation({
    mutationFn: async (app) => {
      if (!supabase.__isConfigured) throw new Error("Supabase not configured");
      await supabase.from("troll_family_applications").update({ status: "rejected" }).eq("id", app.id);
      try { await supabase.from("notifications").insert({ user_id: app.user_id, type: "family_application_status", title: "Troll Family Application", message: "Rejected", is_read: false, created_date: new Date().toISOString() }); } catch (_) {}
      return true;
    },
    onSuccess: () => { qc.invalidateQueries(["apps_families"]); toast.success("Family rejected"); },
    onError: (e) => toast.error(e?.message || "Reject failed")
  });

  const deleteFamily = useMutation({
    mutationFn: async (app) => {
      if (!supabase.__isConfigured) throw new Error("Supabase not configured");
      
      // Find the family by name to get its ID
      const { data: family } = await supabase
        .from("troll_families")
        .select("id")
        .eq("name", app.family_name)
        .single();
      
      if (family?.id) {
        // Delete family members first
        await supabase.from("troll_family_members").delete().eq("family_id", family.id);
        
        // Update profiles to remove family references
        await supabase
          .from("profiles")
          .update({ troll_family_name: null, owns_troll_family: false })
          .eq("troll_family_name", app.family_name);
        
        // Delete the family
        await supabase.from("troll_families").delete().eq("id", family.id);
      }
      
      // Update application status
      await supabase.from("troll_family_applications").update({ status: "deleted" }).eq("id", app.id);
      
      try { 
        await supabase.from("notifications").insert({ 
          user_id: app.user_id, 
          type: "family_application_status", 
          title: "Troll Family Deleted", 
          message: "Your troll family has been deleted by an admin", 
          is_read: false, 
          created_date: new Date().toISOString() 
        }); 
      } catch (_) {}
      
      return true;
    },
    onSuccess: () => { qc.invalidateQueries(["apps_families"]); toast.success("Family deleted successfully"); },
    onError: (e) => toast.error(e?.message || "Delete failed")
  });

  const deleteApplication = useMutation({
    mutationFn: async (app) => {
      if (!supabase.__isConfigured) throw new Error("Supabase not configured");
      
      // Simply delete the application (for pending/rejected apps)
      await supabase.from("troll_family_applications").delete().eq("id", app.id);
      
      try { 
        await supabase.from("notifications").insert({ 
          user_id: app.user_id, 
          type: "family_application_status", 
          title: "Application Deleted", 
          message: "Your troll family application has been deleted by an admin", 
          is_read: false, 
          created_date: new Date().toISOString() 
        }); 
      } catch (_) {}
      
      return true;
    },
    onSuccess: () => { qc.invalidateQueries(["apps_families"]); toast.success("Application deleted successfully"); },
    onError: (e) => toast.error(e?.message || "Delete failed")
  });

  const Section = ({ title, items, renderRow }) => (
    <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4">
      <h4 className="text-white font-semibold mb-3">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">No applications</p>
      ) : (
        <div className="space-y-3">
          {items.map(renderRow)}
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <Section
        title="Troll Officer Applications"
        items={officerApps}
        renderRow={(app) => (
          <Card key={app.id} className="p-3 bg-[#11121a] border-[#2a2a3a]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">@{app.user_username || app.user_email || app.user_id || "unknown"}</div>
                <div className="text-xs text-gray-500">Status: <Badge className={app.status === 'approved' ? 'bg-green-600' : app.status === 'rejected' ? 'bg-red-600' : 'bg-yellow-600'}>{app.status || 'pending'}</Badge></div>
              </div>
              {(!app.status || app.status === 'pending') ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" className="bg-emerald-600" onClick={() => approveOfficer.mutate(app)} disabled={approveOfficer.isPending || rejectOfficer.isPending}>Approve</Button>
                  <Button size="sm" variant="outline" className="border-red-500 text-red-400" onClick={() => rejectOfficer.mutate(app)} disabled={approveOfficer.isPending || rejectOfficer.isPending}>Deny</Button>
                </div>
              ) : null}
            </div>
          </Card>
        )}
      />

      <Section
        title="Troll Family Applications"
        items={familyApps}
        renderRow={(app) => (
          <Card key={app.id} className="p-3 bg-[#11121a] border-[#2a2a3a]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">{app.family_name}</div>
                <div className="text-xs text-gray-500">Status: <Badge className={app.status === 'approved' ? 'bg-green-600' : app.status === 'rejected' ? 'bg-red-600' : 'bg-yellow-600'}>{app.status || 'pending'}</Badge></div>
              </div>
              {(!app.status || app.status === 'pending') ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" className="bg-emerald-600" onClick={() => approveFamily.mutate(app)} disabled={approveFamily.isPending || rejectFamily.isPending}>Approve</Button>
                  <Button size="sm" variant="outline" className="border-red-500 text-red-400" onClick={() => rejectFamily.mutate(app)} disabled={approveFamily.isPending || rejectFamily.isPending}>Deny</Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-orange-600 text-orange-500 hover:bg-orange-600 hover:text-white" 
                    onClick={() => deleteApplication.mutate(app)} 
                    disabled={deleteApplication.isPending}
                  >
                    Delete App
                  </Button>
                </div>
              ) : app.status === 'approved' ? (
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-red-600 text-red-500 hover:bg-red-600 hover:text-white" 
                    onClick={() => deleteFamily.mutate(app)} 
                    disabled={deleteFamily.isPending}
                  >
                    Delete Family
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-orange-600 text-orange-500 hover:bg-orange-600 hover:text-white" 
                    onClick={() => deleteApplication.mutate(app)} 
                    disabled={deleteApplication.isPending}
                  >
                    Delete App
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-orange-600 text-orange-500 hover:bg-orange-600 hover:text-white" 
                    onClick={() => deleteApplication.mutate(app)} 
                    disabled={deleteApplication.isPending}
                  >
                    Delete App
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}
      />
    </div>
  );
}

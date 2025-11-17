import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Edit3, Save, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const AdminEditPanel = ({ pageName, currentContent, onSave, fieldName = "content" }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(currentContent);
  const [isSaving, setIsSaving] = useState(false);

  // Check if user is admin
  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", "admin-check"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, is_admin, role")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentContent,
  });

  const isAdmin = userProfile?.is_admin || userProfile?.role === "admin";

  if (!isAdmin) {
    return null; // Don't show edit panel to non-admins
  }

  const handleSave = async () => {
    if (!editedContent.trim()) {
      toast.error("Content cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editedContent);
      toast.success(`✅ ${pageName} updated successfully!`);
      setIsEditing(false);
    } catch (error) {
      console.error(`Error updating ${pageName}:`, error);
      toast.error(`Failed to update ${pageName}: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(currentContent);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <Card className="mb-4 bg-yellow-500/10 border-yellow-500/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 text-sm font-medium">
              Admin Mode: Edit {pageName}
            </span>
          </div>
          <Button
            onClick={() => setIsEditing(true)}
            size="sm"
            variant="outline"
            className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
          >
            <Edit3 className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-4 bg-blue-500/10 border-blue-500/30 p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-blue-400 font-semibold">Edit {pageName}</h3>
          <div className="flex gap-2">
            <Button
              onClick={handleCancel}
              size="sm"
              variant="outline"
              className="border-gray-500 text-gray-400"
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              size="sm"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3 mr-1" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">Content</label>
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="bg-gray-900 border-gray-700 text-white min-h-[200px]"
            placeholder={`Enter ${pageName} content...`}
          />
        </div>

        <div className="text-xs text-gray-500">
          <p>• Changes will be visible to all users immediately</p>
          <p>• Use Markdown formatting for better styling</p>
          <p>• Preview changes before saving</p>
        </div>
      </div>
    </Card>
  );
};

export default AdminEditPanel;
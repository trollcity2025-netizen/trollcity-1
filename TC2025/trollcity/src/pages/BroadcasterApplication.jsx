
import React, { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Upload, AlertCircle, Loader2, Award, Lock } from "lucide-react";
import { toast } from "sonner";

export default function BroadcasterApplicationPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate(); // Initialize useNavigate
  const [idFile, setIdFile] = useState(null);
  const [idType, setIdType] = useState("drivers_license");
  const [idNumber, setIdNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => supabase.auth.me(),
  });

  const { data: application } = useQuery({
    queryKey: ['broadcasterApplication', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const apps = await supabase.entities.BroadcasterApplication.filter({ user_id: user.id });
      return apps[0] || null;
    },
    enabled: !!user?.id,
  });

  const submitApplicationMutation = useMutation({
    mutationFn: async () => {
      if (!idFile) {
        throw new Error("Please upload your ID document");
      }

      if (!expiryDate) {
        throw new Error("Please enter ID expiry date");
      }

      // Check if ID is expired
      const expiry = new Date(expiryDate);
      const today = new Date();
      const isExpired = expiry < today;

      if (isExpired) {
        throw new Error("Your ID has expired. Please provide a valid ID.");
      }

      setIsUploading(true);

      // Upload ID document
      const { file_url } = await supabase.integrations.Core.UploadFile({ file: idFile, bucket: 'avatars', pathPrefix: 'ids' });

      // Use AI to verify ID document
      const aiVerification = await supabase.integrations.Core.InvokeLLM({
        prompt: `Analyze this ID document image and verify:
1. Is this a valid government-issued ID?
2. Can you read the expiration date?
3. Does it appear to be authentic (not fake or photoshopped)?
4. Is the document clear and readable?

Respond with a JSON object containing:
- is_valid: boolean
- expiry_date_readable: boolean
- appears_authentic: boolean
- is_clear: boolean
- notes: string (any concerns or observations)`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            is_valid: { type: "boolean" },
            expiry_date_readable: { type: "boolean" },
            appears_authentic: { type: "boolean" },
            is_clear: { type: "boolean" },
            notes: { type: "string" }
          }
        }
      });

      setIsUploading(false);

      // Auto-approve if all checks pass
      const shouldApprove = 
        aiVerification.is_valid && 
        aiVerification.appears_authentic && 
        aiVerification.is_clear &&
        !isExpired;

      const app = await supabase.entities.BroadcasterApplication.create({
        user_id: user.id,
        user_name: user.full_name,
        user_email: user.email,
        username: user.username || user.full_name,
        user_level: user.level || 1,
        id_type: idType,
        id_photo_url: file_url,
        full_legal_name: user.full_name,
        date_of_birth: user.date_of_birth || "",
        status: shouldApprove ? "approved" : "pending",
        agreed_to_terms: true
      });

      if (shouldApprove) {
        // Update user to mark as broadcaster approved
        await supabase.auth.updateMe({
          is_broadcaster_approved: true
        });
      }

      return { app, shouldApprove };
    },
    onSuccess: ({ shouldApprove }) => {
      queryClient.invalidateQueries(['currentUser']);
      queryClient.invalidateQueries(['broadcasterApplication']);
      
      if (shouldApprove) {
        toast.success("🎉 Application Approved! You can now cash out your earnings.");
      } else {
        toast.warning("Application submitted for manual review. We'll notify you once approved.");
      }
    },
    onError: (error) => {
      setIsUploading(false);
      toast.error(error.message || "Application failed. Please try again.");
    }
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setIdFile(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitApplicationMutation.mutate();
  };

  // Check if user meets level requirement
  const userLevel = user?.level || 1;
  const meetsLevelRequirement = userLevel >= 1; // Changed from 20 to 1

  // Calculate XP needed
  const getXPForLevel = (level) => {
    return Math.floor(1500 * Math.pow(1.6, level - 1));
  };

  const getTotalXPNeeded = (targetLevel) => {
    let total = 0;
    for (let i = 1; i < targetLevel; i++) {
      total += getXPForLevel(i);
    }
    return total;
  };

  const xpNeededForLevel1 = getTotalXPNeeded(1); // Changed from 20 to 1
  const currentXP = user?.experience || 0;

  if (application?.status === "approved" || user?.is_broadcaster_approved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] p-6 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8 text-center">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">✅ Broadcaster Approved!</h1>
            <p className="text-gray-400 mb-6">You're all set to receive payouts</p>
            
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
              <p className="text-green-300 text-sm">
                Your broadcaster application has been approved. You can now cash out your earnings from the Earnings page.
              </p>
            </div>

            <Button
              onClick={() => navigate('/#/Earnings')} // Updated navigation
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              Go to Earnings Page
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (application?.status === "pending") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] p-6 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8 text-center">
            <Loader2 className="w-20 h-20 text-yellow-500 mx-auto mb-4 animate-spin" />
            <h1 className="text-3xl font-bold text-white mb-2">⏳ Under Review</h1>
            <p className="text-gray-400 mb-6">Your application is being reviewed</p>
            
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-300 text-sm">
                We're reviewing your ID document. This usually takes 24-48 hours. You'll be notified once approved.
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Award className="w-10 h-10 text-purple-400" />
            Broadcaster Application
          </h1>
          <p className="text-gray-400 text-lg">Apply to receive payouts for your streams</p>
        </div>

        {/* Level Requirement Notice */}
        {!meetsLevelRequirement && (
          <Card className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500 p-6 mb-6">
            <div className="flex items-start gap-3">
              <Lock className="w-6 h-6 text-orange-400 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">🔒 Level 1 Required</h3>
                <p className="text-orange-200 mb-3">
                  You must reach <strong>Level 1</strong> before you can apply to receive payouts.
                </p>
                <div className="bg-[#0a0a0f] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">Current Level:</span>
                    <Badge className="bg-purple-500 text-white text-lg px-4 py-1">
                      Level {userLevel}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">Your XP:</span>
                    <span className="text-cyan-400 font-bold">{currentXP.toLocaleString()} XP</span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-300">Level 1 Requires:</span>
                    <span className="text-yellow-400 font-bold">{xpNeededForLevel1.toLocaleString()} XP</span>
                  </div>
                  <div className="bg-[#1a1a24] rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min((currentXP / (xpNeededForLevel1 > 0 ? xpNeededForLevel1 : 1)) * 100, 100)}%` 
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    💡 Earn XP: Receive gifts (+1 XP per coin) • Rapid-tap likes (+1 XP per like)
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Payout Rate Info */}
        <Card className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500 p-6 mb-6">
          <div className="flex items-start gap-3">
            <Award className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-3">💰 Tiered Cashout Rates</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">First 20k coins:</span>
                  <span className="text-green-400 font-bold">$125</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Next 20k coins:</span>
                  <span className="text-green-400 font-bold">$100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Next 20k coins:</span>
                  <span className="text-green-400 font-bold">$80</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Above 60k coins:</span>
                  <span className="text-green-400 font-bold">Better rates!</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                💡 Better rates than other platforms! Plus admin manual approval for your security.
              </p>
            </div>
          </div>
        </Card>

        {/* Application Form */}
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Submit Your Application</h2>
          
          {!meetsLevelRequirement && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-300 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                You cannot submit an application until you reach Level 1
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ID Type */}
            <div>
              <Label htmlFor="id-type" className="text-white mb-2 block">
                ID Document Type
              </Label>
              <Select value={idType} onValueChange={setIdType}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#2a2a3a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                  <SelectItem value="drivers_license">Driver's License</SelectItem>
                  <SelectItem value="state_id">State ID</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="library_card">Library Card</SelectItem>
                  <SelectItem value="homeless_card">Homeless Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ID Number */}
            <div>
              <Label htmlFor="id-number" className="text-white mb-2 block">
                ID Number (Optional)
              </Label>
              <Input
                id="id-number"
                placeholder="Enter your ID number"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <Label htmlFor="expiry-date" className="text-white mb-2 block">
                Expiration Date *
              </Label>
              <Input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                required
              />
            </div>

            {/* File Upload */}
            <div>
              <Label htmlFor="id-file" className="text-white mb-2 block">
                Upload ID Document *
              </Label>
              <div className="bg-[#0a0a0f] border-2 border-dashed border-[#2a2a3a] rounded-lg p-6 text-center hover:border-purple-500 transition-colors">
                <input
                  id="id-file"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  required
                />
                <label htmlFor="id-file" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  {idFile ? (
                    <p className="text-green-400 font-semibold">{idFile.name}</p>
                  ) : (
                    <>
                      <p className="text-white mb-1">Click to upload ID document</p>
                      <p className="text-gray-400 text-sm">PNG, JPG, or PDF (Max 10MB)</p>
                    </>
                  )}
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ℹ️ Your ID will be verified by AI to ensure it's valid and not expired
              </p>
            </div>

            {/* Requirements Checklist */}
            <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-4">
              <h4 className="text-white font-semibold mb-3">✅ Requirements:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${meetsLevelRequirement ? 'text-green-500' : 'text-gray-500'}`} />
                  <span className={meetsLevelRequirement ? 'text-green-400' : 'text-gray-400'}>
                    Level 1 or higher
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${idFile ? 'text-green-500' : 'text-gray-500'}`} />
                  <span className={idFile ? 'text-green-400' : 'text-gray-400'}>
                    Valid government-issued ID
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${expiryDate ? 'text-green-500' : 'text-gray-500'}`} />
                  <span className={expiryDate ? 'text-green-400' : 'text-gray-400'}>
                    ID must not be expired
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!meetsLevelRequirement || submitApplicationMutation.isPending || isUploading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 font-bold py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed" // Added disabled styles
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Verifying ID...
                </>
              ) : submitApplicationMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Award className="w-5 h-5 mr-2" />
                  Submit Application
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-gray-500 mt-6 text-center">
            🔒 Your information is secure and encrypted. We use AI to instantly verify your ID.
          </p>
        </Card>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";

const AgeVerificationModal = ({ userId, onVerified }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const queryClient = useQueryClient();

  // Check if user is age verified
  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, is_age_verified, date_of_birth")
        .eq("id", userId)
        .single();
      if (error) console.warn("Error fetching profile:", error);
      return data;
    },
    enabled: !!userId,
  });

  // Show modal if not verified
  useEffect(() => {
    if (!isLoading && profile && !profile.is_age_verified) {
      setIsOpen(true);
    }
  }, [profile, isLoading]);

  // Verify age mutation
  const verifyAgeMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not found");
      if (!birthDate) throw new Error("Please enter your date of birth");
      if (!agreeTerms) throw new Error("Please agree to terms");

      // Calculate age
      const birthDateObj = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birthDateObj.getFullYear();
      const monthDiff = today.getMonth() - birthDateObj.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
      }

      if (age < 18) {
        throw new Error("You must be at least 18 years old to use this platform");
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({
          is_age_verified: true,
          date_of_birth: birthDate,
          age_verified_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("✅ Age verified! You can now access all features.");
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
      if (onVerified) onVerified();
    },
    onError: (error) => {
      toast.error(error.message || "Verification failed");
    },
  });

  if (!isOpen || isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[999] p-4">
      <Card className="bg-[#1a1a2e] border-orange-500/50 max-w-md w-full">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <AlertCircle className="w-6 h-6 text-orange-500" />
            <h2 className="text-2xl font-bold text-white">Age Verification</h2>
          </div>

          {/* Description */}
          <p className="text-gray-300 mb-6">
            You must be at least 18 years old to use TrollCity. Please verify your age to continue.
          </p>

          {/* Form */}
          <div className="space-y-6">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Date of Birth</label>
              <Input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="bg-[#0f0f1a] border-orange-500/30 text-white w-full"
                disabled={verifyAgeMutation.isPending}
              />
              <p className="text-xs text-gray-500 mt-2">MM/DD/YYYY format</p>
            </div>

            {/* Terms Agreement */}
            <div className="bg-blue-500/10 rounded-lg p-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded cursor-pointer"
                  disabled={verifyAgeMutation.isPending}
                />
                <span className="text-xs text-gray-300">
                  I confirm that I am at least 18 years old and agree to TrollCity's Terms of Service.
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => verifyAgeMutation.mutate()}
                disabled={!birthDate || !agreeTerms || verifyAgeMutation.isPending}
                className="flex-grow bg-green-600 hover:bg-green-700 text-white font-bold py-3"
              >
                {verifyAgeMutation.isPending ? (
                  "Verifying..."
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Verify Age
                  </>
                )}
              </Button>
            </div>

            {/* Info */}
            <div className="bg-red-500/10 rounded-lg p-3 text-xs text-red-300">
              ⚠️ Your date of birth is private and only used for age verification.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AgeVerificationModal;

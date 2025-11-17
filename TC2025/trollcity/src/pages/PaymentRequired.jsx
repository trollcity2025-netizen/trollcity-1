import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, AlertCircle, UserX } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PaymentRequired() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get reason from URL params
  const urlParams = new URLSearchParams(location.search);
  const reason = urlParams.get('reason');
  
  // Determine message based on reason
  const getMessage = () => {
    switch (reason) {
      case 'kicked':
        return {
          title: 'You Have Been Kicked',
          message: 'You have been kicked by an admin. You need to pay the kick fee to regain access.',
          icon: <UserX className="w-8 h-8 text-orange-400" />,
          buttonText: 'Pay Kick Fee'
        };
      case 'banned':
        return {
          title: 'You Have Been Banned',
          message: 'You have been banned by an admin. You need to pay the ban fee to regain access.',
          icon: <Shield className="w-8 h-8 text-red-400" />,
          buttonText: 'Pay Ban Fee'
        };
      default:
        return {
          title: 'Access Restricted',
          message: 'Your account is currently restricted. If you were banned or kicked, your access is limited.',
          icon: <Shield className="w-8 h-8 text-red-400" />,
          buttonText: 'Pay Kick/Ban Fee'
        };
    }
  };
  
  const message = getMessage();
  
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        <Card className="bg-[#1a1a24] border-[#2a2a3a] p-6 rounded-2xl text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            {message.icon}
            <h1 className="text-2xl font-bold text-white">{message.title}</h1>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            {message.message}
          </p>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-left mb-4">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-300 text-sm">Please contact support or an admin if you believe this is a mistake.</span>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button onClick={() => navigate(createPageUrl('KickBanFee'))} className="bg-emerald-600 hover:bg-emerald-700">{message.buttonText}</Button>
            <Button onClick={() => supabase.auth.signOut()} className="bg-red-600 hover:bg-red-700">Logout</Button>
            <Button onClick={() => supabase.auth.redirectToLogin()} variant="outline" className="border-[#2a2a3a] text-gray-300">Sign In</Button>
          </div>
        </Card>
      </div>
    </main>
  );
}

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, RefreshCw, Settings, Palette, Users, Coins, Gift, Star } from "lucide-react";

export default function AppEditorInterface() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("general");
  const [appSettings, setAppSettings] = useState({
    app_name: "TrollCity",
    app_description: "The ultimate streaming platform",
    max_stream_duration: 240,
    max_participants: 9,
    entrance_effect_price: 100,
    gift_animation_duration: 5,
    level_up_coins: 1000,
    daily_reward_coins: 50,
    referral_bonus_coins: 500,
    min_withdrawal_amount: 100,
    max_withdrawal_amount: 10000,
    stream_quality: "720p",
    chat_message_limit: 100,
    max_gifts_per_minute: 10,
    verification_required: false,
    age_restriction: 18,
    content_moderation: "strict",
    theme_primary: "#00ff88",
    theme_secondary: "#ff0844",
    theme_background: "#0a0a0f"
  });

  // Fetch current app settings
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      if (!supabase.__isConfigured) return appSettings;
      
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .single();
      
      if (error) {
        console.log("No app settings found, using defaults");
        return appSettings;
      }
      
      return data?.settings || appSettings;
    },
    staleTime: 30000,
  });

  // Update settings when data loads
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      setAppSettings(settings);
    }
  }, [settings]);

  // Save settings mutation
  const saveSettings = useMutation({
    mutationFn: async (newSettings) => {
      if (!supabase.__isConfigured) throw new Error("Supabase not configured");
      
      const { error } = await supabase
        .from("app_settings")
        .upsert({ 
          id: 1, 
          settings: newSettings,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["appSettings"]);
      toast.success("App settings saved successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save settings");
    }
  });

  const handleInputChange = (field, value) => {
    setAppSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    saveSettings.mutate(appSettings);
  };

  const handleReset = () => {
    setAppSettings(settings);
    toast.info("Settings reset to saved values");
  };

  const sections = [
    { id: "general", label: "General", icon: Settings },
    { id: "streaming", label: "Streaming", icon: Users },
    { id: "economy", label: "Economy", icon: Coins },
    { id: "gifts", label: "Gifts & Effects", icon: Gift },
    { id: "theme", label: "Theme", icon: Palette },
    { id: "moderation", label: "Moderation", icon: Star }
  ];

  const renderSection = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="app_name">App Name</Label>
                <Input
                  id="app_name"
                  value={appSettings.app_name}
                  onChange={(e) => handleInputChange("app_name", e.target.value)}
                  className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                />
              </div>
              <div>
                <Label htmlFor="app_description">App Description</Label>
                <Input
                  id="app_description"
                  value={appSettings.app_description}
                  onChange={(e) => handleInputChange("app_description", e.target.value)}
                  className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="age_restriction">Age Restriction</Label>
                <Select
                  value={String(appSettings.age_restriction)}
                  onValueChange={(value) => handleInputChange("age_restriction", parseInt(value))}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="13">13+</SelectItem>
                    <SelectItem value="16">16+</SelectItem>
                    <SelectItem value="18">18+</SelectItem>
                    <SelectItem value="21">21+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="verification_required">Verification Required</Label>
                <Select
                  value={String(appSettings.verification_required)}
                  onValueChange={(value) => handleInputChange("verification_required", value === "true")}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="content_moderation">Content Moderation</Label>
                <Select
                  value={appSettings.content_moderation}
                  onValueChange={(value) => handleInputChange("content_moderation", value)}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="relaxed">Relaxed</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="strict">Strict</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case "streaming":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="max_stream_duration">Max Stream Duration (minutes)</Label>
                <Select
                  value={String(appSettings.max_stream_duration)}
                  onValueChange={(value) => handleInputChange("max_stream_duration", parseInt(value))}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="180">3 hours</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                    <SelectItem value="720">12 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="max_participants">Max Participants</Label>
                <Select
                  value={String(appSettings.max_participants)}
                  onValueChange={(value) => handleInputChange("max_participants", parseInt(value))}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="1">1 (Solo)</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="9">9</SelectItem>
                    <SelectItem value="16">16</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="stream_quality">Default Stream Quality</Label>
                <Select
                  value={appSettings.stream_quality}
                  onValueChange={(value) => handleInputChange("stream_quality", value)}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="1080p">1080p</SelectItem>
                    <SelectItem value="1440p">1440p</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="chat_message_limit">Chat Message Limit</Label>
                <Select
                  value={String(appSettings.chat_message_limit)}
                  onValueChange={(value) => handleInputChange("chat_message_limit", parseInt(value))}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="50">50 messages</SelectItem>
                    <SelectItem value="100">100 messages</SelectItem>
                    <SelectItem value="200">200 messages</SelectItem>
                    <SelectItem value="500">500 messages</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case "economy":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="level_up_coins">Level Up Coins</Label>
                <Select
                  value={String(appSettings.level_up_coins)}
                  onValueChange={(value) => handleInputChange("level_up_coins", parseInt(value))}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="500">500 coins</SelectItem>
                    <SelectItem value="1000">1,000 coins</SelectItem>
                    <SelectItem value="2000">2,000 coins</SelectItem>
                    <SelectItem value="5000">5,000 coins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="daily_reward_coins">Daily Reward Coins</Label>
                <Select
                  value={String(appSettings.daily_reward_coins)}
                  onValueChange={(value) => handleInputChange("daily_reward_coins", parseInt(value))}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="10">10 coins</SelectItem>
                    <SelectItem value="25">25 coins</SelectItem>
                    <SelectItem value="50">50 coins</SelectItem>
                    <SelectItem value="100">100 coins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="referral_bonus_coins">Referral Bonus Coins</Label>
                <Select
                  value={String(appSettings.referral_bonus_coins)}
                  onValueChange={(value) => handleInputChange("referral_bonus_coins", parseInt(value))}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="100">100 coins</SelectItem>
                    <SelectItem value="250">250 coins</SelectItem>
                    <SelectItem value="500">500 coins</SelectItem>
                    <SelectItem value="1000">1,000 coins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="min_withdrawal_amount">Min Withdrawal Amount</Label>
                <Select
                  value={String(appSettings.min_withdrawal_amount)}
                  onValueChange={(value) => handleInputChange("min_withdrawal_amount", parseInt(value))}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="50">$50</SelectItem>
                    <SelectItem value="100">$100</SelectItem>
                    <SelectItem value="250">$250</SelectItem>
                    <SelectItem value="500">$500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="max_withdrawal_amount">Max Withdrawal Amount</Label>
                <Select
                  value={String(appSettings.max_withdrawal_amount)}
                  onValueChange={(value) => handleInputChange("max_withdrawal_amount", parseInt(value))}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="1000">$1,000</SelectItem>
                    <SelectItem value="5000">$5,000</SelectItem>
                    <SelectItem value="10000">$10,000</SelectItem>
                    <SelectItem value="50000">$50,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case "gifts":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="entrance_effect_price">Entrance Effect Price</Label>
                <Select
                  value={String(appSettings.entrance_effect_price)}
                  onValueChange={(value) => handleInputChange("entrance_effect_price", parseInt(value))}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="50">50 coins</SelectItem>
                    <SelectItem value="100">100 coins</SelectItem>
                    <SelectItem value="250">250 coins</SelectItem>
                    <SelectItem value="500">500 coins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="gift_animation_duration">Gift Animation Duration (seconds)</Label>
                <Select
                  value={String(appSettings.gift_animation_duration)}
                  onValueChange={(value) => handleInputChange("gift_animation_duration", parseInt(value))}
                >
                  <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    <SelectItem value="3">3 seconds</SelectItem>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                    <SelectItem value="15">15 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="max_gifts_per_minute">Max Gifts Per Minute</Label>
              <Select
                value={String(appSettings.max_gifts_per_minute)}
                onValueChange={(value) => handleInputChange("max_gifts_per_minute", parseInt(value))}
              >
                <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                  <SelectItem value="5">5 gifts</SelectItem>
                  <SelectItem value="10">10 gifts</SelectItem>
                  <SelectItem value="20">20 gifts</SelectItem>
                  <SelectItem value="50">50 gifts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "theme":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="theme_primary">Primary Theme Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="theme_primary"
                    type="color"
                    value={appSettings.theme_primary}
                    onChange={(e) => handleInputChange("theme_primary", e.target.value)}
                    className="w-16 h-10 p-1 bg-[#1a1a24] border-[#2a2a3a]"
                  />
                  <Input
                    value={appSettings.theme_primary}
                    onChange={(e) => handleInputChange("theme_primary", e.target.value)}
                    className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="theme_secondary">Secondary Theme Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="theme_secondary"
                    type="color"
                    value={appSettings.theme_secondary}
                    onChange={(e) => handleInputChange("theme_secondary", e.target.value)}
                    className="w-16 h-10 p-1 bg-[#1a1a24] border-[#2a2a3a]"
                  />
                  <Input
                    value={appSettings.theme_secondary}
                    onChange={(e) => handleInputChange("theme_secondary", e.target.value)}
                    className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="theme_background">Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="theme_background"
                    type="color"
                    value={appSettings.theme_background}
                    onChange={(e) => handleInputChange("theme_background", e.target.value)}
                    className="w-16 h-10 p-1 bg-[#1a1a24] border-[#2a2a3a]"
                  />
                  <Input
                    value={appSettings.theme_background}
                    onChange={(e) => handleInputChange("theme_background", e.target.value)}
                    className="bg-[#1a1a24] border-[#2a2a3a] text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "moderation":
        return (
          <div className="space-y-6">
            <p className="text-gray-400">Moderation settings are configured in the General section above.</p>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading app settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Navigation */}
      <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4">
        <div className="flex flex-wrap gap-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Button
                key={section.id}
                variant={activeSection === section.id ? "default" : "outline"}
                size="sm"
                className={`${
                  activeSection === section.id
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "border-[#2a2a3a] text-gray-300 hover:border-blue-500"
                }`}
                onClick={() => setActiveSection(section.id)}
              >
                <Icon className="w-4 h-4 mr-1" />
                {section.label}
              </Button>
            );
          })}
        </div>
      </Card>

      {/* Content */}
      <Card className="bg-[#0f0f14] border-[#2a2a3a] p-6">
        {renderSection()}
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={saveSettings.isPending}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Save className="w-4 h-4 mr-1" />
          {saveSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          className="border-[#2a2a3a] text-gray-300 hover:border-blue-500"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Reset Changes
        </Button>
      </div>

      {/* Preview */}
      <Card className="bg-[#0f0f14] border-[#2a2a3a] p-4">
        <h4 className="text-white font-semibold mb-3">Settings Preview</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="text-gray-400">
            <p><span className="text-white">App Name:</span> {appSettings.app_name}</p>
            <p><span className="text-white">Max Stream Duration:</span> {appSettings.max_stream_duration} minutes</p>
            <p><span className="text-white">Max Participants:</span> {appSettings.max_participants}</p>
            <p><span className="text-white">Entrance Effect Price:</span> {appSettings.entrance_effect_price} coins</p>
          </div>
          <div className="text-gray-400">
            <p><span className="text-white">Level Up Coins:</span> {appSettings.level_up_coins}</p>
            <p><span className="text-white">Daily Reward:</span> {appSettings.daily_reward_coins} coins</p>
            <p><span className="text-white">Min Withdrawal:</span> ${appSettings.min_withdrawal_amount}</p>
            <p><span className="text-white">Max Withdrawal:</span> ${appSettings.max_withdrawal_amount}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
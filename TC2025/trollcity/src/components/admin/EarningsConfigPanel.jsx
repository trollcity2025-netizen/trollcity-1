import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Settings, Save, RefreshCw, AlertCircle, TrendingUp, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_TIERS = [
  { id: 'bronze', name: 'Bronze', requirement: 7000, coins: '7,000', payout: 25, fixedFee: 4.0, color: 'from-amber-600 to-amber-700' },
  { id: 'silver', name: 'Silver', requirement: 14000, coins: '14,000', payout: 55, fixedFee: 5.5, color: 'from-gray-400 to-gray-500' },
  { id: 'gold', name: 'Gold', requirement: 27000, coins: '27,000', payout: 100, fixedFee: 10.0, color: 'from-yellow-400 to-yellow-600' },
  { id: 'platinum', name: 'Platinum', requirement: 48000, coins: '48,000', payout: 175, fixedFee: 20.0, color: 'from-blue-400 to-purple-600' },
];

const LEVEL_BONUSES = [
  { name: 'Tiny Troller', range: '0–9', dailyPaid: 15 },
  { name: 'Gang Troller', range: '10–19', dailyPaid: 35 },
  { name: 'OG Troller', range: '20–40', dailyPaid: 75 },
  { name: 'Old Ass troller', range: '41–60', dailyPaid: 100 },
  { name: 'Dead troller', range: '61–70', dailyPaid: 200 },
  { name: 'Graveyard', range: '71–100', dailyPaid: 500 },
];

export default function EarningsConfigPanel({ currentUser }) {
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [levelBonuses, setLevelBonuses] = useState(LEVEL_BONUSES);
  const [transactionFeePercentage, setTransactionFeePercentage] = useState(2.9);
  const [transactionFeeFixed, setTransactionFeeFixed] = useState(30);
  const [minimumPayout, setMinimumPayout] = useState(25);
  const [payoutProcessingTime, setPayoutProcessingTime] = useState(30);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current earnings config
  const { data: config, isLoading } = useQuery({
    queryKey: ['earningsConfig'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('earnings_config')
        .select('*')
        .eq('id', 1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Update form when config loads
  useEffect(() => {
    if (config) {
      setTransactionFeePercentage(config.transaction_fee_percentage ?? 2.9);
      setTransactionFeeFixed(config.transaction_fee_fixed_cents ?? 30);
      setMinimumPayout(config.minimum_payout ?? 25);
      setPayoutProcessingTime(config.payout_processing_time_minutes ?? 30);
      
      // Load custom tiers if available
      if (config.custom_tiers) {
        try {
          const customTiers = JSON.parse(config.custom_tiers);
          setTiers(customTiers);
        } catch (e) {
          console.warn('Failed to parse custom tiers:', e);
        }
      }
      
      // Load custom level bonuses if available
      if (config.custom_level_bonuses) {
        try {
          const customBonuses = JSON.parse(config.custom_level_bonuses);
          setLevelBonuses(customBonuses);
        } catch (e) {
          console.warn('Failed to parse custom level bonuses:', e);
        }
      }
    }
  }, [config]);

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const configData = {
        transaction_fee_percentage: transactionFeePercentage,
        transaction_fee_fixed_cents: transactionFeeFixed,
        minimum_payout: minimumPayout,
        payout_processing_time_minutes: payoutProcessingTime,
        custom_tiers: JSON.stringify(tiers),
        custom_level_bonuses: JSON.stringify(levelBonuses),
        updated_at: new Date().toISOString(),
        updated_by: currentUser?.id,
      };

      const { data, error } = await supabase
        .from('earnings_config')
        .upsert({ id: 1, ...configData })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('✅ Earnings configuration updated successfully!');
      setHasChanges(false);
      qc.invalidateQueries(['earningsConfig']);
    },
    onError: (error) => {
      toast.error(`❌ Failed to update configuration: ${error.message}`);
    },
  });

  // Handle tier changes
  const updateTier = (index, field, value) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
    setHasChanges(true);
  };

  // Handle level bonus changes
  const updateLevelBonus = (index, field, value) => {
    const newBonuses = [...levelBonuses];
    newBonuses[index] = { ...newBonuses[index], [field]: value };
    setLevelBonuses(newBonuses);
    setHasChanges(true);
  };

  // Add new tier
  const addTier = () => {
    const newTier = {
      id: `custom-${Date.now()}`,
      name: 'New Tier',
      requirement: 100000,
      coins: '100,000',
      payout: 500,
      fixedFee: 50,
      color: 'from-purple-600 to-pink-600',
    };
    setTiers([...tiers, newTier]);
    setHasChanges(true);
  };

  // Remove tier
  const removeTier = (index) => {
    if (tiers.length <= 1) {
      toast.error('❌ You must have at least one tier');
      return;
    }
    const newTiers = tiers.filter((_, i) => i !== index);
    setTiers(newTiers);
    setHasChanges(true);
  };

  // Add new level bonus
  const addLevelBonus = () => {
    const newBonus = {
      name: 'New Level',
      range: '101–120',
      dailyPaid: 750,
    };
    setLevelBonuses([...levelBonuses, newBonus]);
    setHasChanges(true);
  };

  // Remove level bonus
  const removeLevelBonus = (index) => {
    if (levelBonuses.length <= 1) {
      toast.error('❌ You must have at least one level bonus');
      return;
    }
    const newBonuses = levelBonuses.filter((_, i) => i !== index);
    setLevelBonuses(newBonuses);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <Card className="bg-[#1a1a24] border-[#2a2a3a]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Settings className="w-5 h-5" />
          Earnings Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tiers" className="space-y-4">
          <TabsList className="bg-[#0a0a0f]">
            <TabsTrigger value="tiers">Payout Tiers</TabsTrigger>
            <TabsTrigger value="fees">Transaction Fees</TabsTrigger>
            <TabsTrigger value="square">Square Setup</TabsTrigger>
          </TabsList>

          {/* Payout Tiers Tab */}
          <TabsContent value="tiers" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bronze */}
              <div>
                <Label className="text-gray-300">Bronze Tier Requirement (coins)</Label>
                <Input
                  type="number"
                  value={formData.bronze_tier_requirement || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bronze_tier_requirement: parseInt(e.target.value),
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Bronze Payout ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.bronze_tier_payout || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bronze_tier_payout: parseFloat(e.target.value),
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
              </div>

              {/* Silver */}
              <div>
                <Label className="text-gray-300">Silver Tier Requirement (coins)</Label>
                <Input
                  type="number"
                  value={formData.silver_tier_requirement || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      silver_tier_requirement: parseInt(e.target.value),
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Silver Payout ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.silver_tier_payout || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      silver_tier_payout: parseFloat(e.target.value),
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
              </div>

              {/* Gold */}
              <div>
                <Label className="text-gray-300">Gold Tier Requirement (coins)</Label>
                <Input
                  type="number"
                  value={formData.gold_tier_requirement || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      gold_tier_requirement: parseInt(e.target.value),
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Gold Payout ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.gold_tier_payout || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      gold_tier_payout: parseFloat(e.target.value),
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
              </div>

              {/* Platinum */}
              <div>
                <Label className="text-gray-300">Platinum Tier Requirement (coins)</Label>
                <Input
                  type="number"
                  value={formData.platinum_tier_requirement || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      platinum_tier_requirement: parseInt(e.target.value),
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Platinum Payout ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.platinum_tier_payout || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      platinum_tier_payout: parseFloat(e.target.value),
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
              </div>
            </div>
          </TabsContent>

          {/* Transaction Fees Tab */}
          <TabsContent value="fees" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Transaction Fee (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.transaction_fee_percentage || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      transaction_fee_percentage: parseFloat(e.target.value),
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Percentage of transaction</p>
              </div>
              <div>
                <Label className="text-gray-300">Fixed Fee (cents)</Label>
                <Input
                  type="number"
                  value={formData.transaction_fee_fixed_cents || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      transaction_fee_fixed_cents: parseInt(e.target.value),
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Fixed fee per transaction</p>
              </div>
              <div>
                <Label className="text-gray-300">Minimum Payout ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.minimum_payout || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minimum_payout: parseFloat(e.target.value),
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Processing Days</Label>
                <Input
                  type="number"
                  value={formData.payment_processing_days || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payment_processing_days: parseInt(e.target.value),
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                />
              </div>
            </div>
          </TabsContent>

          {/* Square Setup Tab */}
          <TabsContent value="square" className="space-y-4">
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg mb-4">
              <p className="text-sm text-gray-300">
                Configure your Square account to process all transactions with built-in fee handling.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="flex items-center gap-2 text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.square_account_active || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        square_account_active: e.target.checked,
                      })
                    }
                    disabled={!isEditing}
                    className="w-4 h-4"
                  />
                  Square Account Active
                </Label>
              </div>
              <div>
                <Label className="text-gray-300">Square Application ID</Label>
                <Input
                  type="text"
                  value={formData.square_application_id || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      square_application_id: e.target.value,
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                  placeholder="sq0atp-..."
                />
              </div>
              <div>
                <Label className="text-gray-300">Square Location ID</Label>
                <Input
                  type="text"
                  value={formData.square_location_id || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      square_location_id: e.target.value,
                    })
                  }
                  disabled={!isEditing}
                  className="bg-[#0a0a0f] border-[#2a2a3a] text-white"
                  placeholder="LVALUE..."
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-6">
          {!isEditing ? (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Settings className="w-4 h-4 mr-2" />
              Edit Settings
            </Button>
          ) : (
            <>
              <Button
                onClick={() => {
                  setFormData(config);
                  setIsEditing(false);
                }}
                variant="outline"
                className="border-[#2a2a3a] text-gray-300 hover:bg-[#1a1a24]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

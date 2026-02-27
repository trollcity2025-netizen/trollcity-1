import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { SellerTier } from '../../lib/sellerTiers';
import { evaluateSellerTier, recordFraudFlag, recordDispute } from '../../lib/sellerApi';
import { notifySellerTierUpgraded, notifySellerTierDowngraded } from '../../lib/notifications';
import SellerTierBadge from '../../components/SellerTierBadge';

interface SellerProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  seller_tier: SellerTier;
  completed_sales: number;
  fraud_flags: number;
  dispute_count: number;
  positive_reviews: number;
  negative_reviews: number;
  total_positive_reviews: number;
  total_negative_reviews: number;
  rating: number | null;
  total_reviews: number;
  tier_updated_at: string | null;
  created_at: string;
}

export default function SellerManagement() {
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<SellerProfile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadSellers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('user_profiles')
        .select(`
          id,
          username,
          avatar_url,
          seller_tier,
          completed_sales,
          fraud_flags,
          dispute_count,
          positive_reviews,
          negative_reviews,
          total_positive_reviews,
          total_negative_reviews,
          rating,
          total_reviews,
          tier_updated_at,
          created_at
        `)
        .order('completed_sales', { ascending: false })
        .limit(100);

      if (selectedTier !== 'all') {
        query = query.eq('seller_tier', selectedTier);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSellers(data || []);
    } catch (err) {
      console.error('Error loading sellers:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTier]);

  useEffect(() => {
    loadSellers();
  }, [selectedTier, loadSellers]);

  const handleManualTierChange = async (sellerId: string, newTier: SellerTier) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          seller_tier: newTier,
          tier_updated_at: new Date().toISOString()
        })
        .eq('id', sellerId);

      if (error) throw error;
      
      // Refresh the list
      loadSellers();
      
      if (selectedSeller && selectedSeller.id === sellerId) {
        setSelectedSeller({ ...selectedSeller, seller_tier: newTier });
      }
    } catch (err) {
      console.error('Error updating tier:', err);
      alert('Failed to update seller tier');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEvaluateTier = async (sellerId: string) => {
    setActionLoading(true);
    try {
      const result = await evaluateSellerTier(sellerId);
      
      if (result.upgraded) {
        await notifySellerTierUpgraded(sellerId, result.old_tier, result.new_tier);
      } else if (result.downgraded) {
        await notifySellerTierDowngraded(sellerId, result.old_tier, result.new_tier, 'Automatic evaluation');
      }
      
      // Refresh data
      loadSellers();
      
      if (selectedSeller && selectedSeller.id === sellerId) {
        const updated = sellers.find(s => s.id === sellerId);
        if (updated) setSelectedSeller({ ...updated, seller_tier: result.new_tier });
      }
      
      alert(`Tier evaluation complete: ${result.old_tier} → ${result.new_tier}`);
    } catch (err) {
      console.error('Error evaluating tier:', err);
      alert('Failed to evaluate tier');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordFraud = async (sellerId: string) => {
    if (!confirm('Are you sure you want to record a fraud flag for this seller?')) return;
    
    setActionLoading(true);
    try {
      const result = await recordFraudFlag(sellerId, 1);
      
      if (result.downgraded) {
        await notifySellerTierDowngraded(sellerId, result.old_tier, result.new_tier, 'Fraud flag recorded');
      }
      
      loadSellers();
      alert('Fraud flag recorded');
    } catch (err) {
      console.error('Error recording fraud:', err);
      alert('Failed to record fraud flag');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordDispute = async (sellerId: string) => {
    if (!confirm('Are you sure you want to record a dispute for this seller?')) return;
    
    setActionLoading(true);
    try {
      const result = await recordDispute(sellerId);
      
      if (result.downgraded) {
        await notifySellerTierDowngraded(sellerId, result.old_tier, result.new_tier, 'Dispute recorded');
      }
      
      loadSellers();
      alert('Dispute recorded');
    } catch (err) {
      console.error('Error recording dispute:', err);
      alert('Failed to record dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredSellers = sellers.filter(seller => 
    seller.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tierCounts = {
    all: sellers.length,
    enterprise: sellers.filter(s => s.seller_tier === 'enterprise').length,
    merchant: sellers.filter(s => s.seller_tier === 'merchant').length,
    verified_pro: sellers.filter(s => s.seller_tier === 'verified_pro').length,
    verified: sellers.filter(s => s.seller_tier === 'verified').length,
    standard: sellers.filter(s => s.seller_tier === 'standard').length,
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Seller Management</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search sellers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          />
        </div>
        
        <select
          value={selectedTier}
          onChange={(e) => setSelectedTier(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
        >
          <option value="all">All Tiers ({tierCounts.all})</option>
          <option value="enterprise">Enterprise ({tierCounts.enterprise})</option>
          <option value="merchant">Merchant ({tierCounts.merchant})</option>
          <option value="verified_pro">Verified Pro ({tierCounts.verified_pro})</option>
          <option value="verified">Verified ({tierCounts.verified})</option>
          <option value="standard">Standard ({tierCounts.standard})</option>
        </select>
        
        <button
          onClick={loadSellers}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Seller List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredSellers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No sellers found</div>
          ) : (
            <div className="space-y-2">
              {filteredSellers.map((seller) => (
                <div
                  key={seller.id}
                  onClick={() => setSelectedSeller(seller)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSeller?.id === seller.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 overflow-hidden">
                      {seller.avatar_url ? (
                        <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold">
                          {seller.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{seller.username}</span>
                        <SellerTierBadge tier={seller.seller_tier} size="sm" />
                      </div>
                      <div className="text-sm text-gray-500">
                        {seller.completed_sales} sales • {seller.total_reviews || 0} reviews
                      </div>
                    </div>
                    
                    <div className="text-right text-sm">
                      {seller.rating && (
                        <div className="text-yellow-500">★ {seller.rating.toFixed(1)}</div>
                      )}
                      {(seller.fraud_flags > 0 || seller.dispute_count > 0) && (
                        <div className="text-red-500">
                          {seller.fraud_flags > 0 && `${seller.fraud_flags} fraud `}
                          {seller.dispute_count > 0 && `${seller.dispute_count} disputes`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seller Details Panel */}
        <div className="lg:col-span-1">
          {selectedSeller ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 sticky top-4">
              <h2 className="text-lg font-semibold mb-4">{selectedSeller.username}</h2>
              
              <div className="space-y-4">
                {/* Current Tier */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Current Tier</label>
                  <div className="flex items-center gap-2">
                    <SellerTierBadge tier={selectedSeller.seller_tier} size="lg" showLabel />
                  </div>
                </div>

                {/* Manual Tier Override */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Manual Override</label>
                  <select
                    value={selectedSeller.seller_tier}
                    onChange={(e) => handleManualTierChange(selectedSeller.id, e.target.value as SellerTier)}
                    disabled={actionLoading}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  >
                    <option value="standard">Standard</option>
                    <option value="verified">Verified</option>
                    <option value="verified_pro">Verified Pro</option>
                    <option value="merchant">Merchant</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                {/* Evaluate Button */}
                <button
                  onClick={() => handleEvaluateTier(selectedSeller.id)}
                  disabled={actionLoading}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Auto-Evaluate Tier'}
                </button>

                {/* Stats */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="font-medium mb-2">Statistics</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Completed Sales:</div>
                    <div className="font-semibold">{selectedSeller.completed_sales}</div>
                    
                    <div>Fraud Flags:</div>
                    <div className={`font-semibold ${selectedSeller.fraud_flags > 0 ? 'text-red-500' : ''}`}>
                      {selectedSeller.fraud_flags}
                    </div>
                    
                    <div>Disputes:</div>
                    <div className={`font-semibold ${selectedSeller.dispute_count > 0 ? 'text-yellow-500' : ''}`}>
                      {selectedSeller.dispute_count}
                    </div>
                    
                    <div>Rating:</div>
                    <div className="font-semibold">
                      {selectedSeller.rating ? `★ ${selectedSeller.rating.toFixed(1)}` : 'N/A'}
                    </div>
                    
                    <div>Total Reviews:</div>
                    <div className="font-semibold">{selectedSeller.total_reviews || 0}</div>
                    
                    <div>Positive Reviews:</div>
                    <div className="font-semibold text-green-500">
                      {selectedSeller.total_positive_reviews || 0}
                    </div>
                    
                    <div>Negative Reviews:</div>
                    <div className="font-semibold text-red-500">
                      {selectedSeller.total_negative_reviews || 0}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                  <h3 className="font-medium mb-2">Actions</h3>
                  
                  <button
                    onClick={() => handleRecordFraud(selectedSeller.id)}
                    disabled={actionLoading}
                    className="w-full px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 disabled:opacity-50"
                  >
                    Record Fraud Flag
                  </button>
                  
                  <button
                    onClick={() => handleRecordDispute(selectedSeller.id)}
                    disabled={actionLoading}
                    className="w-full px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-lg hover:bg-yellow-200 disabled:opacity-50"
                  >
                    Record Dispute
                  </button>
                </div>

                {/* Tier Updated */}
                {selectedSeller.tier_updated_at && (
                  <div className="text-xs text-gray-500">
                    Last tier update: {new Date(selectedSeller.tier_updated_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center text-gray-500">
              Select a seller to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

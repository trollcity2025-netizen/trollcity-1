import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { Home, Hammer, RefreshCw, Search, User } from 'lucide-react';
import { formatCompactNumber } from '../../../lib/utils';

interface PropertyWithOwner {
  id: string;
  owner_user_id: string;
  base_value: number | null;
  created_at: string;
  condition_factor: number | null;
  upgrade_spend_total: number | null;
  is_listed: boolean | null;
  ask_price: number | null;
  is_starter: boolean | null;
  is_active_home?: boolean;
  name?: string | null;
  owner_username?: string;
  deed_name?: string;
}

interface PropertyUpgrade {
  id: string;
  property_id: string;
  upgrade_type: string;
  cost: number;
  status: 'pending' | 'installed';
  tasks_required_total: number;
  tasks_completed: number;
}

const STARTER_HOME_BASE_VALUE = 1500;

function computeSystemValue(property: PropertyWithOwner) {
  const baseValue = property.base_value ?? STARTER_HOME_BASE_VALUE;
  const condition = Math.max(0.85, Math.min(1.1, property.condition_factor ?? 1));
  const upgradeSpend = property.upgrade_spend_total ?? 0;
  
  const now = new Date();
  const created = new Date(property.created_at);
  const months = Math.max(0, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  
  const baseInflationFactor = Math.pow(1 - 0.005, months);
  const upgradeInflationFactor = Math.pow(1 + 0.002, months);
  
  const total = (baseValue * baseInflationFactor * condition) + (upgradeSpend * 0.75 * upgradeInflationFactor);
  return Math.round(Math.max(0, total));
}

export default function TrollsTownAdminPanel() {
  const [properties, setProperties] = useState<PropertyWithOwner[]>([]);
  const [upgrades, setUpgrades] = useState<PropertyUpgrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUpgrades, setShowUpgrades] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: propsData, error: propsError } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (propsError) throw propsError;

      const { data: deedsData } = await supabase
        .from('deeds')
        .select('id, property_id, current_owner_user_id, property_name');

      const { data: upgradesData, error: upgradesError } = await supabase
        .from('property_upgrades')
        .select('*');

      if (upgradesError) throw upgradesError;

      const userIds = [...new Set((propsData || []).map(p => p.owner_user_id).filter(Boolean))];
      let ownersMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', userIds);
        
        if (profilesData) {
          profilesData.forEach(p => {
            ownersMap[p.id] = p.username;
          });
        }
      }

      const deedMap: Record<string, string> = {};
      (deedsData || []).forEach(d => {
        deedMap[d.property_id] = d.property_name || null;
      });

      const enriched = (propsData || []).map(p => ({
        ...p,
        owner_username: ownersMap[p.owner_user_id] || 'Unknown',
        deed_name: deedMap[p.id] || null
      })) as PropertyWithOwner[];

      setProperties(enriched);
      setUpgrades((upgradesData || []) as PropertyUpgrade[]);
    } catch (err) {
      console.error('Failed to load Trolls Town data:', err);
      toast.error('Failed to load Trolls Town data');
    } finally {
      setLoading(false);
    }
  };

  const filteredProperties = properties.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.owner_username?.toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term) ||
      p.deed_name?.toLowerCase().includes(term)
    );
  });

  const groupedByUser = filteredProperties.reduce((acc, prop) => {
    const owner = prop.owner_username || prop.owner_user_id || 'Unknown';
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(prop);
    return acc;
  }, {} as Record<string, PropertyWithOwner[]>);

  const getPropertyUpgrades = (propertyId: string) => {
    return upgrades.filter(u => u.property_id === propertyId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Home className="w-6 h-6 text-emerald-400" />
            Trolls Town Properties
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            All properties in Trolls Town, grouped by owner
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by username, property ID, or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
        />
      </div>

      <div className="space-y-6">
        {Object.entries(groupedByUser).map(([owner, props]) => (
          <div key={owner} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">{owner}</h3>
              <span className="text-xs text-slate-400">({props.length} properties)</span>
            </div>
            
            <div className="space-y-3">
              {props.map(prop => {
                const systemValue = computeSystemValue(prop);
                const propUpgrades = getPropertyUpgrades(prop.id);
                const hasUpgrades = propUpgrades.length > 0;
                
                return (
                  <div key={prop.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {prop.deed_name || `Property ${prop.id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-slate-400">
                          ID: {prop.id.slice(0, 8)} • Starter: {prop.is_starter ? 'Yes' : 'No'}
                        </p>
                        {prop.is_listed && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-yellow-900/50 text-yellow-400 border border-yellow-700">
                            Listed: {(prop.ask_price || 0).toLocaleString()} TC
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">System Value</p>
                        <p className="text-sm font-semibold text-emerald-400">
                          {systemValue.toLocaleString()} TC
                        </p>
                        <p className="text-xs text-slate-500">
                          Base: {(prop.base_value || STARTER_HOME_BASE_VALUE).toLocaleString()} • 
                          Upgrades: {(prop.upgrade_spend_total || 0).toLocaleString()} TC
                        </p>
                      </div>
                    </div>
                    
                    {hasUpgrades && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <button
                          onClick={() => setShowUpgrades(showUpgrades === prop.id ? null : prop.id)}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                        >
                          <Hammer className="w-3 h-3" />
                          {propUpgrades.length} upgrade(s) • Click to view
                        </button>
                        
                        {showUpgrades === prop.id && (
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {propUpgrades.map(upg => (
                              <div key={upg.id} className="bg-slate-900/50 rounded p-2 text-xs">
                                <p className="text-white font-medium">{upg.upgrade_type}</p>
                                <p className="text-slate-400">
                                  {upg.cost.toLocaleString()} TC • 
                                  Status: {upg.status} • 
                                  Tasks: {upg.tasks_completed}/{upg.tasks_required_total}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filteredProperties.length === 0 && (
        <div className="text-center p-8 text-slate-400">
          No properties found
        </div>
      )}
    </div>
  );
}
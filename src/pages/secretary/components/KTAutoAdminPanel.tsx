import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { Car, RefreshCw, Search, User } from 'lucide-react';
import { formatCompactNumber } from '../../../lib/utils';

interface VehicleWithOwner {
  id: string;
  user_id: string;
  catalog_id: number;
  plate: string | null;
  status: string | null;
  created_at: string;
  owner_username?: string;
  car_name?: string;
  car_tier?: number;
  car_price?: number;
}

interface CarCatalogItem {
  id: number;
  name: string;
  tier: number;
  base_price: number;
}

const TIER_MAP: Record<number, string> = {
  1: 'Starter',
  2: 'Mid',
  3: 'Luxury',
  4: 'Super',
  5: 'Elite'
};

export default function KTAutoAdminPanel() {
  const [vehicles, setVehicles] = useState<VehicleWithOwner[]>([]);
  const [catalog, setCatalog] = useState<CarCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('user_vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (vehiclesError) throw vehiclesError;

      const { data: catalogData } = await supabase
        .from('v_dealership_catalog')
        .select('id, name, tier, base_price');

      if (catalogData) {
        setCatalog(catalogData);
      }

      const userIds = [...new Set((vehiclesData || []).map(v => v.user_id).filter(Boolean))];
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

      const catalogMap: Record<number, CarCatalogItem> = {};
      (catalogData || []).forEach(c => {
        catalogMap[c.id] = c;
      });

      const enriched = (vehiclesData || []).map(v => {
        const carInfo = catalogMap[v.catalog_id];
        return {
          ...v,
          owner_username: ownersMap[v.user_id] || 'Unknown',
          car_name: carInfo?.name || `Car #${v.catalog_id}`,
          car_tier: carInfo?.tier,
          car_price: carInfo?.base_price
        };
      }) as VehicleWithOwner[];

      setVehicles(enriched);
    } catch (err) {
      console.error('Failed to load KTAuto data:', err);
      toast.error('Failed to load KTAuto data');
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.owner_username?.toLowerCase().includes(term) ||
      v.id.toLowerCase().includes(term) ||
      v.car_name?.toLowerCase().includes(term) ||
      v.plate?.toLowerCase().includes(term)
    );
  });

  const groupedByUser = filteredVehicles.reduce((acc, v) => {
    const owner = v.owner_username || v.user_id || 'Unknown';
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(v);
    return acc;
  }, {} as Record<string, VehicleWithOwner[]>);

  const getTotalValue = (vehicleList: VehicleWithOwner[]) => {
    return vehicleList.reduce((sum, v) => sum + (v.car_price || 0), 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Car className="w-6 h-6 text-blue-400" />
            KTAuto Vehicles
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            All vehicles in KTAuto, grouped by owner
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by username, plate, or car name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="space-y-6">
        {Object.entries(groupedByUser).map(([owner, vehiclesList]) => {
          const totalValue = getTotalValue(vehiclesList);
          
          return (
            <div key={owner} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">{owner}</h3>
                  <span className="text-xs text-slate-400">({vehiclesList.length} vehicles)</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total Value</p>
                  <p className="text-sm font-semibold text-yellow-400">
                    {totalValue.toLocaleString()} TC
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                {vehiclesList.map(vehicle => (
                  <div key={vehicle.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {vehicle.car_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          ID: {vehicle.id.slice(0, 8)} • 
                          Tier: {TIER_MAP[vehicle.car_tier || 0] || 'Unknown'}
                        </p>
                        {vehicle.plate && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300">
                            Plate: {vehicle.plate}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Base Price</p>
                        <p className="text-sm font-semibold text-blue-400">
                          {(vehicle.car_price || 0).toLocaleString()} TC
                        </p>
                        <p className="text-xs text-slate-500 capitalize">
                          Status: {vehicle.status || 'active'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="text-center p-8 text-slate-400">
          No vehicles found
        </div>
      )}
    </div>
  );
}
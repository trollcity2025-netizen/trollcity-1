import React, { useEffect, useState } from 'react';
import { Car, Shield, FileText, DollarSign, Wrench, AlertTriangle, Edit2, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { useAuthStore } from '../../lib/store';
import { formatCompactNumber } from '../../lib/utils';

const calculateSellPrice = (vehicle: Vehicle) => {
  const basePrice = vehicle.catalog.price;
  const baseModCost = Math.max(Math.floor(basePrice * 0.1), 1000);
  let modTotalCost = 0;
  
  if (vehicle.mods) {
    Object.values(vehicle.mods).forEach((level: any) => {
      const lvl = Number(level);
      modTotalCost += (lvl * (lvl + 1) / 2) * baseModCost;
    });
  }
  
  return Math.floor(basePrice * 0.5) + Math.floor(modTotalCost * 0.5);
};

type Vehicle = {
  id: string;
  condition: number;
  mods: Record<string, number>;
  purchased_at: string;
  catalog: {
    id: number;
    name: string;
    tier: string;
    image: string;
    price: number;
    speed: number;
    armor: number;
  };
  registration: {
    plate_number: string;
    expires_at: string;
    status: string;
  } | null;
  title: {
    status: string;
    issued_at: string;
  } | null;
  insurance: {
    status: string;
    expires_at: string | null;
  } | null;
};

export default function MyGarage() {
  const { user } = useAuthStore();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [upgradingType, setUpgradingType] = useState<string | null>(null);
  const [editingPlateId, setEditingPlateId] = useState<string | null>(null);
  const [newPlate, setNewPlate] = useState('');

  useEffect(() => {
    if (user) {
      fetchVehicles();
    }
  }, [user]);

  const handleUpdatePlate = async (vehicleId: string) => {
    if (!newPlate || newPlate.length < 3 || newPlate.length > 8) {
      toast.error('Plate must be 3-8 characters');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('update_vehicle_plate', {
        p_user_vehicle_id: vehicleId,
        p_new_plate: newPlate
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      toast.success(data.message);
      setEditingPlateId(null);
      setNewPlate('');
      fetchVehicles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update plate');
    }
  };

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_vehicles')
        .select(`
          id,
          condition,
          mods,
          purchased_at,
          catalog:vehicles_catalog (
            id, name, tier, image, price, speed, armor
          ),
          registration:vehicle_registrations (
            plate_number, expires_at, status
          ),
          title:vehicle_titles (
            status, issued_at
          ),
          insurance:vehicle_insurance_policies (
            status, expires_at
          )
        `)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Transform data to match type (arrays to single objects if needed)
      const transformedData = data?.map((v: any) => ({
        ...v,
        // Supabase returns arrays for one-to-many/one-to-one if not explicit, 
        // but here we expect single objects based on schema relations.
        // If they come as arrays, take the first one.
        registration: Array.isArray(v.registration) ? v.registration[0] : v.registration,
        title: Array.isArray(v.title) ? v.title[0] : v.title,
        insurance: Array.isArray(v.insurance) ? v.insurance[0] : v.insurance,
      }));

      setVehicles(transformedData || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load garage');
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async (vehicle: Vehicle) => {
    const sellPrice = calculateSellPrice(vehicle);
    if (!confirm(`Are you sure you want to sell your ${vehicle.catalog.name}? You will receive ${formatCompactNumber(sellPrice)} coins (incl. upgrades).`)) return;

    setSellingId(vehicle.id);
    try {
      const { data, error } = await supabase.rpc('sell_vehicle', {
        p_user_vehicle_id: vehicle.id
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      toast.success(data.message);
      fetchVehicles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to sell vehicle');
    } finally {
      setSellingId(null);
    }
  };

  const handleUpgrade = async (vehicleId: string, type: string) => {
    setUpgradingType(type);
    try {
      const { data, error } = await supabase.rpc('upgrade_vehicle', {
        p_user_vehicle_id: vehicleId,
        p_upgrade_type: type
      });

      if (error) throw error;

      if (data && data.success) {
        toast.success(data.message);
        fetchVehicles(); // Refresh list
        setShowUpgradeModal(false);
      } else {
        toast.error(data?.message || 'Failed to upgrade vehicle');
      }
    } catch (error) {
      console.error('Error upgrading vehicle:', error);
      toast.error('Failed to upgrade vehicle');
    } finally {
      setUpgradingType(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading garage...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Car className="w-6 h-6 text-purple-400" />
          My Garage <span className="text-sm font-normal text-gray-400">({vehicles.length} Vehicles)</span>
        </h2>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-black/40 border border-white/10 rounded-xl p-12 text-center">
          <Car className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Empty Garage</h3>
          <p className="text-gray-400">You don&apos;t own any vehicles yet. Visit the Dealership to buy one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-[#12121A] border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/30 transition-all group">
              {/* Image Header */}
              <div className="relative h-48 bg-gradient-to-b from-gray-900 to-black p-4 flex items-center justify-center">
                <img 
                  src={vehicle.catalog.image} 
                  alt={vehicle.catalog.name}
                  className="max-h-full max-w-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-bold uppercase tracking-wider border border-white/10">
                  {vehicle.catalog.tier}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="font-bold text-lg leading-tight mb-1">{vehicle.catalog.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" /> {vehicle.catalog.armor} Armor
                    </span>
                    <span className="w-1 h-1 bg-gray-600 rounded-full" />
                    <span className="flex items-center gap-1">
                      <Car className="w-3 h-3" /> {vehicle.catalog.speed} Speed
                    </span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/5 rounded p-2 border border-white/5 relative group">
                    <span className="block text-gray-500 mb-1">Plate</span>
                    {editingPlateId === vehicle.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newPlate}
                          onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                          className="w-full bg-black/50 border border-white/20 rounded px-1 py-0.5 text-xs text-yellow-400 font-mono"
                          maxLength={8}
                          autoFocus
                        />
                        <button 
                          onClick={() => handleUpdatePlate(vehicle.id)}
                          className="text-green-400 hover:text-green-300"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => {
                            setEditingPlateId(null);
                            setNewPlate('');
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-yellow-400 font-bold">{vehicle.registration?.plate_number || 'NONE'}</span>
                        <button 
                          onClick={() => {
                            setEditingPlateId(vehicle.id);
                            setNewPlate(vehicle.registration?.plate_number || '');
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="bg-white/5 rounded p-2 border border-white/5">
                    <span className="block text-gray-500 mb-1">Condition</span>
                    <span className={`${vehicle.condition > 80 ? 'text-emerald-400' : 'text-orange-400'} font-bold`}>
                      {vehicle.condition}%
                    </span>
                  </div>
                </div>

                {/* Mini Upgrades Bar */}
                <div className="flex items-center gap-1 justify-between text-[10px] text-gray-500 bg-white/5 p-2 rounded border border-white/5">
                   {['engine', 'armor', 'rims', 'brakes', 'suspension'].map(type => {
                     const level = vehicle.mods?.[type] || 0;
                     return (
                       <div key={type} className="flex flex-col items-center gap-1">
                         <span className="uppercase">{type.slice(0, 3)}</span>
                         <div className="flex gap-0.5">
                           {[1, 2, 3].map(i => (
                             <div 
                               key={i} 
                               className={`w-1.5 h-1.5 rounded-full ${i <= level ? 'bg-emerald-400' : 'bg-gray-700'}`} 
                             />
                           ))}
                         </div>
                       </div>
                     );
                   })}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setSelectedVehicle(vehicle);
                        setShowTitleModal(true);
                      }}
                      className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors"
                    >
                      <FileText className="w-3 h-3" /> View Title
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedVehicle(vehicle);
                        setShowUpgradeModal(true);
                      }}
                      className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors"
                    >
                      <Wrench className="w-3 h-3" /> Upgrade
                    </button>
                  </div>
                  <button 
                    onClick={() => handleSell(vehicle)}
                    disabled={sellingId === vehicle.id}
                    className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <DollarSign className="w-3 h-3" /> 
                    {sellingId === vehicle.id ? 'Selling...' : `Sell for ${formatCompactNumber(calculateSellPrice(vehicle))} Coins`}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Title Modal */}
      {showTitleModal && selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowTitleModal(false)}>
          <div className="bg-[#fff9e6] text-black w-full max-w-md rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative" onClick={e => e.stopPropagation()}>
            {/* Border Pattern */}
            <div className="absolute inset-2 border-4 border-double border-gray-800 pointer-events-none" />
            
            <div className="p-8 text-center space-y-4">
              <div className="border-b-2 border-black pb-4 mb-4">
                <h3 className="text-3xl font-serif font-bold tracking-wider">CERTIFICATE OF TITLE</h3>
                <p className="text-xs uppercase tracking-[0.2em] mt-1">State of Troll City • Department of Motor Vehicles</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-left font-mono text-sm">
                <div>
                  <span className="block text-[10px] uppercase text-gray-500">Vehicle Identification Number</span>
                  <span className="font-bold">{selectedVehicle.id.split('-')[0].toUpperCase()}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-gray-500">Plate Number</span>
                  <span className="font-bold">{selectedVehicle.registration?.plate_number}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[10px] uppercase text-gray-500">Make / Model</span>
                  <span className="font-bold text-lg">{selectedVehicle.catalog.name}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-gray-500">Date Issued</span>
                  <span className="font-bold">{new Date(selectedVehicle.title?.issued_at || Date.now()).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-gray-500">Status</span>
                  <span className="font-bold uppercase">{selectedVehicle.title?.status || 'CLEAN'}</span>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-black flex justify-between items-end">
                <div className="text-left">
                  <div className="w-32 h-10 border-b border-black mb-1"></div>
                  <span className="text-[10px] uppercase">Registrar Signature</span>
                </div>
                <div className="w-16 h-16 border-2 border-black rounded-full flex items-center justify-center rotate-[-15deg] opacity-80">
                  <span className="text-[10px] font-bold uppercase text-center leading-none">Official<br/>Seal</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowTitleModal(false)}
              className="absolute top-2 right-2 p-2 hover:bg-black/10 rounded-full transition-colors"
            >
              <span className="sr-only">Close</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
      {/* Upgrade Modal */}
      {showUpgradeModal && selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowUpgradeModal(false)}>
          <div className="bg-[#12121A] border border-emerald-500/30 w-full max-w-md rounded-xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.2)]" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-gradient-to-br from-emerald-900/20 to-black">
              <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Wrench className="w-5 h-5 text-emerald-400" />
                Upgrade {selectedVehicle.catalog.name}
              </h3>
              
              <div className="space-y-3">
                {[
                  { id: 'engine', label: 'Engine Tune', icon: '⚡', desc: 'Increases speed performance' },
                  { id: 'armor', label: 'Armor Plating', icon: '🛡️', desc: 'Increases durability' },
                  { id: 'rims', label: 'Custom Rims', icon: '🔘', desc: 'Visual flair & street cred' },
                  { id: 'brakes', label: 'Perf. Brakes', icon: '🛑', desc: 'Better stopping power' },
                  { id: 'suspension', label: 'Suspension', icon: '⚙️', desc: 'Improved handling' }
                ].map(upgrade => {
                  const currentLevel = selectedVehicle.mods?.[upgrade.id] || 0;
                  const cost = Math.max(Math.floor(selectedVehicle.catalog.price * 0.1), 1000) * (currentLevel + 1);
                  const isUpgrading = upgradingType === upgrade.id;
                  const isMaxed = currentLevel >= 3;
                  
                  return (
                    <div key={upgrade.id} className="p-4 bg-white/5 border border-white/10 rounded-lg group">
                       <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{upgrade.icon}</span>
                            <div>
                              <span className="block font-bold group-hover:text-emerald-400 transition-colors">{upgrade.label}</span>
                              <span className="text-xs text-gray-500">{upgrade.desc}</span>
                            </div>
                          </div>
                          <div className="text-right">
                             <div className="flex gap-1 mb-1">
                                {[1, 2, 3].map(i => (
                                   <div 
                                     key={i} 
                                     className={`w-8 h-2 rounded-sm ${i <= currentLevel ? 'bg-emerald-400' : 'bg-gray-700'}`} 
                                   />
                                ))}
                             </div>
                             <span className="text-xs text-emerald-400 font-mono">Level {currentLevel}/3</span>
                          </div>
                       </div>

                       <button
                          onClick={() => handleUpgrade(selectedVehicle.id, upgrade.id)}
                          disabled={upgradingType !== null || isMaxed}
                          className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:bg-gray-800 disabled:text-gray-600 text-emerald-400 border border-emerald-500/30 rounded text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"
                        >
                          {isMaxed ? (
                            'Max Level Reached'
                          ) : (
                            <>
                              <span>Upgrade to Lvl {currentLevel + 1}</span>
                              <span className="w-1 h-1 bg-gray-500 rounded-full" />
                              <span className="text-yellow-400">{formatCompactNumber(cost)} Coins</span>
                            </>
                          )}
                        </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

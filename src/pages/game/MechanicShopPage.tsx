import React, { useEffect, useState } from 'react';
import { Wrench, Zap, AlertTriangle, Palette } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { deductCoins } from '../../lib/coinTransactions';
import { toast } from 'sonner';
import VehicleRenderer from '../../components/game/VehicleRenderer';
import { supabase } from '../../lib/supabase';

export default function MechanicShopPage() {
  const { user, profile } = useAuthStore();
  const [repairing, setRepairing] = useState<'quick' | 'full' | null>(null);
  const [tintPercent, setTintPercent] = useState(20);
  const [savingTint, setSavingTint] = useState(false);
  const [activeVehicleId, setActiveVehicleId] = useState<number | null>(null);
  const [vehicleUpgrades, setVehicleUpgrades] = useState<
    { id: string; vehicle_id: number; upgrade_type: string; status: string; cost: number }[]
  >([]);

  const VEHICLE_UPGRADE_CATALOG = [
    {
      id: 'engine_tune',
      name: 'Engine Tune',
      description: 'Improves acceleration and top speed.',
      cost: 750
    },
    {
      id: 'engine_v8',
      name: 'V8 Engine Swap',
      description: 'Deeper exhaust note and more aggressive engine sound.',
      cost: 1200
    },
    {
      id: 'armor_plating',
      name: 'Armor Plating',
      description: 'Extra armor to protect your ride.',
      cost: 900
    },
    {
      id: 'neon_underglow',
      name: 'Neon Underglow',
      description: 'Cosmetic upgrade that makes your car stand out.',
      cost: 400
    },
    {
      id: 'paint_matte_black',
      name: 'Matte Black Paint',
      description: 'Full-body stealth matte black respray.',
      cost: 300
    },
    {
      id: 'paint_candy_red',
      name: 'Candy Red Paint',
      description: 'High-gloss candy red finish for maximum flex.',
      cost: 300
    },
    {
      id: 'tint_5',
      name: 'Window Tint 5%',
      description: 'Limo tint – darkest windows allowed.',
      cost: 200
    },
    {
      id: 'tint_20',
      name: 'Window Tint 20%',
      description: 'Dark tint with good visibility at night.',
      cost: 180
    },
    {
      id: 'tint_40',
      name: 'Window Tint 40%',
      description: 'Light privacy tint, subtle but clean.',
      cost: 150
    },
    {
      id: 'wheels_sport',
      name: 'Sport Wheels',
      description: 'Lightweight performance rims with aggressive styling.',
      cost: 400
    },
    {
      id: 'wheels_luxury',
      name: 'Luxury Wheels',
      description: 'High-end chrome wheels for VIP status.',
      cost: 450
    },
    {
      id: 'muffler_race',
      name: 'Race Muffler',
      description: 'Loud, aggressive exhaust note heard by everyone nearby.',
      cost: 500
    }
  ];

  useEffect(() => {
    if (!user?.id) return;

    const key = `trollcity_car_${user.id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;

    try {
      const stored = JSON.parse(raw);
      if (stored && typeof stored.windowTintPercent === 'number') {
        const clamped = Math.min(40, Math.max(5, stored.windowTintPercent));
        setTintPercent(clamped);
      }
    } catch {
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setActiveVehicleId(null);
      return;
    }

    const activeFromProfile =
      typeof (profile as any)?.active_vehicle === 'number'
        ? ((profile as any).active_vehicle as number)
        : null;

    if (activeFromProfile) {
      setActiveVehicleId(activeFromProfile);
      return;
    }

    const key = `trollcity_car_${user.id}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored && typeof stored.carId === 'number') {
          setActiveVehicleId(stored.carId);
          return;
        }
      }
    } catch {
    }

    const ownedIds =
      Array.isArray((profile as any)?.owned_vehicle_ids) && (profile as any).owned_vehicle_ids.length > 0
        ? ((profile as any).owned_vehicle_ids as any[])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id))
        : [];

    if (ownedIds.length > 0) {
      setActiveVehicleId(ownedIds[0]);
      return;
    }

    setActiveVehicleId(null);
  }, [user?.id, profile]);

  useEffect(() => {
    if (!user?.id || !activeVehicleId) {
      setVehicleUpgrades([]);
      return;
    }

    const loadUpgrades = async () => {
      const { data, error } = await supabase
        .from('vehicle_upgrades')
        .select('id, vehicle_id, upgrade_type, status, cost')
        .eq('user_id', user.id as string)
        .eq('vehicle_id', activeVehicleId as number);

      if (error) {
        console.error('Failed to load vehicle upgrades', error);
        setVehicleUpgrades([]);
        return;
      }

      setVehicleUpgrades((data || []) as any);
    };

    loadUpgrades();
  }, [user?.id, activeVehicleId]);

  const handleRepair = async (mode: 'quick' | 'full') => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }

    const price = mode === 'quick' ? 500 : 2500;
    if ((profile.troll_coins || 0) < price) {
      toast.error('Not enough troll coins');
      return;
    }

    setRepairing(mode);
    try {
      const result = await deductCoins({
        userId: user.id,
        amount: price,
        type: 'purchase',
        description: mode === 'quick' ? 'Quick vehicle repair' : 'Total vehicle overhaul',
        metadata: { source: 'mechanic_shop', mode }
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to repair vehicle');
        return;
      }

      toast.success(mode === 'quick' ? 'Vehicle repaired' : 'Vehicle fully restored');
      localStorage.setItem(`trollcity_vehicle_condition_${user.id}`, JSON.stringify({ status: 'good' }));
    } finally {
      setRepairing(null);
    }
  };

  const handleSaveTint = () => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    const clamped = Math.min(40, Math.max(5, tintPercent));
    const key = `trollcity_car_${user.id}`;
    const raw = localStorage.getItem(key);
    let stored: any = {};

    if (raw) {
      try {
        stored = JSON.parse(raw) || {};
      } catch {
        stored = {};
      }
    }

    const updated = {
      ...stored,
      windowTintPercent: clamped
    };

    setSavingTint(true);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
      setTintPercent(clamped);
      toast.success(`Window tint set to ${clamped}%`);
    } finally {
      setSavingTint(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pt-24 pb-20">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex items-center gap-4">
          <div className="p-4 bg-yellow-600/20 rounded-2xl border border-yellow-500/30">
            <Wrench size={32} className="text-yellow-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              Grease Monkey Garage
            </h1>
            <p className="text-gray-400">If it's broke, we might fix it.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Vehicle Display */}
          <div className="md:col-span-2 bg-zinc-900 rounded-xl p-6 border border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Vehicle in Shop</h2>
              <p className="text-gray-400 text-sm">
                {activeVehicleId ? 'Ready for service' : 'No vehicle selected'}
              </p>
            </div>
            {activeVehicleId ? (
               <div className="h-32 w-48 relative">
                 <VehicleRenderer 
                   vehicleId={activeVehicleId} 
                   className="w-full h-full object-contain"
                   showShadow={true}
                 />
               </div>
            ) : (
              <div className="h-24 w-40 bg-zinc-800/50 rounded-lg flex items-center justify-center text-zinc-600 text-sm">
                No Vehicle
              </div>
            )}
          </div>

          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-4">
              <Zap size={24} className="text-yellow-400" />
              <h2 className="text-xl font-bold">Quick Fix</h2>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Instant repair for minor damages. Gets you back on the road in no time.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-yellow-400">500 Coins</span>
              <button
                onClick={() => handleRepair('quick')}
                disabled={repairing === 'quick'}
                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {repairing === 'quick' ? 'Processing...' : 'Repair Now'}
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
             <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} className="text-red-400" />
              <h2 className="text-xl font-bold">Total Overhaul</h2>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Complete restoration for wrecked vehicles. Required after heavy raid damage.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-red-400">2,500 Coins</span>
              <button
                onClick={() => handleRepair('full')}
                disabled={repairing === 'full'}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {repairing === 'full' ? 'Processing...' : 'Full Restore'}
              </button>
            </div>
          </div>
          <div className="md:col-span-2 bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <Palette size={24} className="text-purple-400" />
                <h2 className="text-xl font-bold">Window Tint</h2>
              </div>
              <p className="text-xs text-gray-400">Adjust between 5% and 40% for your current car.</p>
            </div>
            {activeVehicleId ? (
              <>
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>Current tint</span>
                  <span className="font-semibold">{tintPercent}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={40}
                  step={1}
                  value={tintPercent}
                  onChange={(e) => setTintPercent(Number(e.target.value))}
                  className="w-full accent-purple-400"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveTint}
                    disabled={savingTint}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingTint ? 'Saving...' : 'Save Tint'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400">
                Select a vehicle at the dealership to adjust tint here.
              </p>
            )}
          </div>
          <div className="md:col-span-2 bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <Wrench size={22} className="text-amber-400" />
                <h2 className="text-xl font-bold">Installed Upgrades</h2>
              </div>
              <p className="text-xs text-gray-400">Overview of mods currently available for this vehicle.</p>
            </div>
            {activeVehicleId ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {VEHICLE_UPGRADE_CATALOG.map((upgrade) => {
                  const installed = vehicleUpgrades.some(
                    (u) =>
                      u.vehicle_id === activeVehicleId &&
                      u.upgrade_type === upgrade.id &&
                      u.status === 'installed'
                  );

                  return (
                    <div
                      key={upgrade.id}
                      className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/60 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{upgrade.name}</p>
                        <span
                          className={
                            installed
                              ? 'text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }
                        >
                          {installed ? 'Installed' : 'Not installed'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">{upgrade.description}</p>
                      <p className="text-xs text-yellow-400 font-medium">
                        {upgrade.cost.toLocaleString()} Coins
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Purchase and select a vehicle at the dealership to see its upgrades.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

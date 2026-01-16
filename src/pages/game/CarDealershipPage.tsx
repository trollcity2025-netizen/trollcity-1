import React, { useState, useEffect } from 'react';
import { Car, ShoppingCart, ShieldCheck, Palette, DollarSign, Wrench } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { deductCoins, addCoins } from '../../lib/coinTransactions';
import { notifySystemAnnouncement } from '../../lib/notifications';
import { toast } from 'sonner';
import { cars } from '../../data/vehicles';

export default function CarDealershipPage() {
  const { user, profile, refreshProfile } = useAuthStore();
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [insuring, setInsuring] = useState(false);
  const [selling, setSelling] = useState(false);
  const [ownedCarId, setOwnedCarId] = useState<number | null>(null);
  const [ownedVehicleIds, setOwnedVehicleIds] = useState<number[]>([]);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [listingPrice, setListingPrice] = useState('');
  const [listingType, setListingType] = useState<'sale' | 'auction'>('sale');
  const [creatingListing, setCreatingListing] = useState(false);
  const [customModelUrl, setCustomModelUrl] = useState('');
  const [vehicleUpgrades, setVehicleUpgrades] = useState<
    { id: string; vehicle_id: number; upgrade_type: string; status: string; cost: number }[]
  >([]);
  const [startingUpgradeId, setStartingUpgradeId] = useState<string | null>(null);

  const VEHICLE_UPGRADE_CATALOG = [
    {
      id: 'engine_tune',
      name: 'Engine Tune',
      description: 'Improves acceleration and top speed.',
      cost: 750
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
    }
  ];

  useEffect(() => {
    if (!user?.id || !ownedCarId) {
      setVehicleUpgrades([]);
      return;
    }

    const loadUpgrades = async () => {
      const { data, error } = await supabase
        .from('vehicle_upgrades')
        .select('id, vehicle_id, upgrade_type, status, cost')
        .eq('user_id', user.id)
        .eq('vehicle_id', ownedCarId);

      if (error) {
        console.error('Failed to load vehicle upgrades', error);
        setVehicleUpgrades([]);
        return;
      }

      setVehicleUpgrades((data || []) as any);
    };

    loadUpgrades();
  }, [user?.id, ownedCarId]);

  useEffect(() => {
    if (user?.id && ownedCarId) {
      const key = `trollcity_car_${user.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const stored = JSON.parse(raw);
          if (stored.modelUrl) {
            setCustomModelUrl(stored.modelUrl);
          } else {
            setCustomModelUrl('');
          }
        } catch {}
      }
    }
  }, [user?.id, ownedCarId]);

  const handleSaveCustomModel = () => {
    if (!user?.id || !ownedCarId) return;
    
    const key = `trollcity_car_${user.id}`;
    const raw = localStorage.getItem(key);
    let stored = {};
    if (raw) {
      try {
        stored = JSON.parse(raw);
      } catch {}
    }
    
    const updated = {
      ...stored,
      modelUrl: customModelUrl
    };
    
    localStorage.setItem(key, JSON.stringify(updated));
    toast.success('Custom model URL saved!');
  };

  const handleStartUpgrade = async (upgradeId: string) => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }
    if (!ownedCarId) {
      toast.error('You must own a vehicle');
      return;
    }

    const upgrade = VEHICLE_UPGRADE_CATALOG.find((u) => u.id === upgradeId);
    if (!upgrade) return;

    const currentBalance = profile.troll_coins || 0;
    if (currentBalance < upgrade.cost) {
      toast.error('Not enough TrollCoins for this upgrade');
      return;
    }

    const alreadyInstalled = vehicleUpgrades.some(
      (u) => u.vehicle_id === ownedCarId && u.upgrade_type === upgrade.id && u.status === 'installed'
    );
    if (alreadyInstalled) {
      toast.error('You already installed this upgrade');
      return;
    }

    setStartingUpgradeId(upgrade.id);
    try {
      const result = await deductCoins({
        userId: user.id,
        amount: upgrade.cost,
        type: 'troll_town_upgrade',
        description: `Vehicle upgrade: ${upgrade.name}`,
        metadata: {
          source: 'vehicle_upgrade',
          vehicle_id: ownedCarId,
          upgrade_id: upgrade.id,
          upgrade_name: upgrade.name
        }
      });

      if (!result.success) {
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.error('Failed to start upgrade');
        }
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('vehicle_upgrades')
        .insert({
          user_id: user.id,
          vehicle_id: ownedCarId,
          upgrade_type: upgrade.id,
          cost: upgrade.cost,
          status: 'installed',
          tasks_required_total: 0,
          tasks_completed: 0
        })
        .select('id, vehicle_id, upgrade_type, status, cost')
        .single();

      if (insertError) {
        throw insertError;
      }

      setVehicleUpgrades((prev) => [...prev, inserted as any]);
      toast.success('Vehicle upgrade installed');
    } catch (error: any) {
      console.error('Failed to start vehicle upgrade', error);
      toast.error(error?.message || 'Failed to start upgrade');
    } finally {
      setStartingUpgradeId(null);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setOwnedCarId(null);
      setOwnedVehicleIds([]);
      return;
    }

    let owned: number[] = [];
    try {
      const rawList = localStorage.getItem(`trollcity_owned_vehicles_${user.id}`);
      if (rawList) {
        owned = JSON.parse(rawList).filter((id: any) => typeof id === 'number');
      }
    } catch {
      owned = [];
    }

    let activeId = profile?.active_vehicle ?? null;

    if (!activeId) {
      const key = `trollcity_car_${user.id}`;
      try {
        const raw = localStorage.getItem(key);
        const stored = raw ? JSON.parse(raw) : null;
        if (stored && typeof stored.carId === 'number') {
          activeId = stored.carId;
        }
      } catch {
        activeId = null;
      }
    }

    if (activeId && !owned.includes(activeId)) {
      owned = [activeId, ...owned];
    }

    setOwnedVehicleIds(owned);
    setOwnedCarId(activeId);
  }, [user?.id, profile?.active_vehicle]);

  const handlePurchase = async (carId: number) => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }

    const car = cars.find(c => c.id === carId);
    if (!car) return;

    if ((profile.troll_coins || 0) < car.price) {
      toast.error('Not enough troll coins');
      return;
    }

    setBuyingId(carId);
    try {
      const result = await deductCoins({
        userId: user.id,
        amount: car.price,
        type: 'purchase',
        description: `Purchase vehicle: ${car.name}`,
        metadata: { source: 'car_dealership', car_id: car.id }
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to purchase vehicle');
        return;
      }

      toast.success(`You purchased ${car.name}`);
      
      // Update local storage (active vehicle)
      localStorage.setItem(
        `trollcity_car_${user.id}`,
        JSON.stringify({
          carId: car.id,
          colorFrom: car.colorFrom,
          colorTo: car.colorTo,
          name: car.name,
          tier: car.tier,
          price: car.price,
          style: car.style
        })
      );

      // Track owned vehicles list
      const ownedKey = `trollcity_owned_vehicles_${user.id}`;
      let ownedList: number[] = [];
      try {
        const raw = localStorage.getItem(ownedKey);
        ownedList = raw ? JSON.parse(raw) : [];
      } catch {
        ownedList = [];
      }
      if (!ownedList.includes(car.id)) {
        ownedList.push(car.id);
        localStorage.setItem(ownedKey, JSON.stringify(ownedList));
      }

      // Update user profile with active vehicle
      await supabase
        .from('user_profiles')
        .update({
          active_vehicle: car.id,
          vehicle_image: car.image
        })
        .eq('id', user.id);
      
      refreshProfile();
      setOwnedCarId(car.id);
      setOwnedVehicleIds(ownedList);
    } finally {
      setBuyingId(null);
    }
  };

  const handleSelectActiveVehicle = async (vehicleId: number) => {
    if (!user) return;
    const car = cars.find(c => c.id === vehicleId);
    if (!car) return;

    localStorage.setItem(
      `trollcity_car_${user.id}`,
      JSON.stringify({
        carId: car.id,
        colorFrom: car.colorFrom,
        colorTo: car.colorTo,
        name: car.name,
        tier: car.tier,
        price: car.price,
        style: car.style
      })
    );

    await supabase
      .from('user_profiles')
      .update({
        active_vehicle: car.id,
        vehicle_image: car.image
      })
      .eq('id', user.id);

    setOwnedCarId(car.id);
    refreshProfile();
    toast.success(`${car.name} is now active.`);
  };

  const handleInsurance = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }

    const price = 3000;
    if ((profile.troll_coins || 0) < price) {
      toast.error('Not enough troll coins');
      return;
    }

    setInsuring(true);
    try {
      const result = await deductCoins({
        userId: user.id,
        amount: price,
        type: 'insurance_purchase',
        description: 'Vehicle insurance purchase',
        metadata: { source: 'car_dealership', kind: 'vehicle_insurance' }
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to purchase insurance');
        return;
      }

      toast.success('Vehicle insurance activated');
      localStorage.setItem(`trollcity_car_insurance_${user.id}`, JSON.stringify({ active: true }));
    } finally {
      setInsuring(false);
    }
  };

  const handleSellVehicle = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }

    const key = `trollcity_car_${user.id}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      toast.error('You do not own a vehicle to sell');
      return;
    }

    let storedCar: any = null;
    try {
      storedCar = JSON.parse(raw);
    } catch {
      storedCar = null;
    }

    if (!storedCar || typeof storedCar.carId !== 'number') {
      toast.error('Unable to read vehicle data');
      return;
    }

    const car = cars.find((c) => c.id === storedCar.carId);
    if (!car) {
      toast.error('Vehicle configuration not found');
      return;
    }

    const refundAmount = Math.round(car.price * 0.6);
    if (refundAmount <= 0) {
      toast.error('Refund amount is invalid');
      return;
    }

    setSelling(true);
    try {
      const result = await addCoins({
        userId: user.id,
        amount: refundAmount,
        type: 'refund',
        description: `Sold vehicle: ${car.name}`,
        metadata: {
          source: 'car_dealership',
          car_id: car.id,
          action: 'vehicle_sell'
        }
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to process sale');
        return;
      }

      localStorage.removeItem(`trollcity_car_${user.id}`);
      localStorage.removeItem(`trollcity_car_insurance_${user.id}`);
      localStorage.removeItem(`trollcity_vehicle_condition_${user.id}`);

      // Update owned vehicles list
      const ownedKey = `trollcity_owned_vehicles_${user.id}`;
      let ownedList: number[] = [];
      try {
        const raw = localStorage.getItem(ownedKey);
        ownedList = raw ? JSON.parse(raw) : [];
      } catch {
        ownedList = [];
      }
      ownedList = ownedList.filter(id => id !== car.id);
      localStorage.setItem(ownedKey, JSON.stringify(ownedList));

      // Update active vehicle to next owned, or clear
      const nextActive = ownedList[0] ?? null;
      await supabase
        .from('user_profiles')
        .update({
          active_vehicle: nextActive,
          vehicle_image: nextActive
            ? cars.find(c => c.id === nextActive)?.image || null
            : null
        })
        .eq('id', user.id);

      if (nextActive) {
        const nextCar = cars.find(c => c.id === nextActive);
        if (nextCar) {
          localStorage.setItem(
            `trollcity_car_${user.id}`,
            JSON.stringify({
              carId: nextCar.id,
              colorFrom: nextCar.colorFrom,
              colorTo: nextCar.colorTo,
              name: nextCar.name,
              tier: nextCar.tier,
              price: nextCar.price,
              style: nextCar.style
            })
          );
        }
      }
      
      refreshProfile();

      toast.success(`Sold ${car.name} for ${refundAmount.toLocaleString()} coins`);
      setOwnedCarId(nextActive);
      setOwnedVehicleIds(ownedList);
    } catch (error: any) {
      console.error('Failed to sell vehicle', error);
      toast.error(error?.message || 'Failed to sell vehicle');
    } finally {
      setSelling(false);
    }
  };

  const handleCreateListing = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }
    if (!ownedCarId) {
      toast.error('You do not own a vehicle to list');
      return;
    }
    const priceValue = Number(listingPrice.replace(/,/g, ''));
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      toast.error('Enter a valid listing price');
      return;
    }

    const vehicle = cars.find(c => c.id === ownedCarId);
    if (!vehicle) {
      toast.error('Vehicle configuration not found');
      return;
    }

    setCreatingListing(true);
    try {
      const { data: existing, error: existingError } = await supabase
        .from('vehicle_listings')
        .select('id, status')
        .eq('seller_id', user.id)
        .eq('vehicle_id', ownedCarId)
        .neq('status', 'cancelled')
        .limit(1)
        .maybeSingle();

      if (existingError) {
        console.error('Failed to check existing vehicle listings', existingError);
      }

      if (existing && existing.status === 'active') {
        toast.error('You already have an active listing for this vehicle');
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('vehicle_listings')
        .insert({
          seller_id: user.id,
          vehicle_id: ownedCarId,
          listing_type: listingType,
          price: Math.round(priceValue),
          status: 'active',
          metadata: {
            vehicle_name: vehicle.name,
            tier: (vehicle as any).tier ?? null,
            style: (vehicle as any).style ?? null
          }
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('Failed to create vehicle listing', insertError);
        toast.error(insertError.message || 'Failed to create listing');
        return;
      }

      if (listingType === 'auction' && inserted) {
        const carName = (inserted as any).metadata?.vehicle_name || vehicle.name;
        const priceText = Math.round(priceValue).toLocaleString();
        await notifySystemAnnouncement(
          '🚗 New Vehicle Auction',
          `${profile.username || 'A troll'} started an auction for ${carName} at ${priceText} TrollCoins.`,
          {
            link: '/auctions',
            vehicle_id: ownedCarId,
            listing_id: (inserted as any).id
          }
        );
      }

      toast.success(
        listingType === 'sale'
          ? 'Vehicle listed for sale'
          : 'Vehicle auction created'
      );
      setShowTitleModal(false);
    } catch (error: any) {
      console.error('Error creating vehicle listing', error);
      toast.error(error?.message || 'Failed to create listing');
    } finally {
      setCreatingListing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pt-24 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Dealership Banner */}
        <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden mb-8 border border-zinc-800 shadow-2xl shadow-red-900/20">
          <img 
            src="/assets/dealership.png" 
            alt="Troll Motors Dealership" 
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback if image fails
              e.currentTarget.style.display = 'none';
            }} 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute bottom-6 left-6 flex items-center gap-4">
            <div className="p-4 bg-red-600/20 rounded-2xl border border-red-500/30 backdrop-blur-sm">
              <Car size={32} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white drop-shadow-lg">
                Troll Motors
              </h1>
              <p className="text-gray-200 drop-shadow-md text-lg">Premium rides for discerning trolls.</p>
            </div>
          </div>
        </div>

        {ownedVehicleIds.length > 1 && (
          <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Active Vehicle</h3>
              <p className="text-xs text-gray-400">
                Choose which owned vehicle you drive in-game.
              </p>
            </div>
            <select
              value={ownedCarId ?? ''}
              onChange={(e) => handleSelectActiveVehicle(Number(e.target.value))}
              className="bg-black/40 border border-white/10 text-sm rounded-lg px-3 py-2"
            >
              {ownedVehicleIds.map((id) => {
                const vehicle = cars.find(c => c.id === id);
                return (
                  <option key={id} value={id}>
                    {vehicle?.name || `Vehicle ${id}`}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cars.map((car) => (
            <div key={car.id} className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-red-500/50 transition-all group">
              <div className="aspect-square bg-gradient-to-b from-zinc-900 via-zinc-950 to-black flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-x-8 bottom-6 h-10 bg-gradient-to-r from-zinc-800/80 via-zinc-900/90 to-black/90 rounded-full blur-md" />
                <div className="absolute inset-x-12 top-4 h-6 bg-gradient-to-r from-white/5 via-zinc-700/20 to-transparent rounded-full" />
                
                {car.image ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img 
                      src={car.image} 
                      alt={car.name} 
                      className="w-full h-full object-cover rounded-lg drop-shadow-2xl" 
                    />
                  </div>
                ) : (
                  <div className="relative w-32 h-16">
                    <div
                      className="absolute inset-0 rounded-xl shadow-xl transform skew-x-[-10deg]"
                      style={{ background: `linear-gradient(90deg, ${car.colorFrom}, ${car.colorTo})` }}
                    />
                    <div className="absolute inset-x-2 bottom-2 h-3 bg-black/50 rounded-b-xl" />
                    <div className="absolute -bottom-4 left-3 w-8 h-8 bg-black rounded-full border-2 border-zinc-500" />
                    <div className="absolute -bottom-4 right-3 w-8 h-8 bg-black rounded-full border-2 border-zinc-500" />
                    <div className="absolute top-1 right-4 w-12 h-6 bg-sky-300/70 rounded-md border border-sky-100/60" />
                    <div className="absolute inset-y-2 left-4 flex items-center">
                      <Car className="text-white/80" size={20} />
                    </div>
                  </div>
                )}
                
                <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs font-mono text-green-400 border border-emerald-500/40">
                  {car.price.toLocaleString()} coins
                </div>
              </div>
              <div className="p-4 space-y-3">
                <h3 className="font-bold text-lg mb-1">{car.name}</h3>
                {'tier' in car && 'style' in car && (
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 uppercase tracking-wide">
                      {car.tier}
                    </span>
                    <span className="truncate ml-2">{car.style}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <span>Speed: {car.speed}</span>
                  <span>•</span>
                  <span>Armor: {car.armor}</span>
                </div>
                {ownedVehicleIds.includes(car.id) && (
                  <div className="text-xs font-semibold text-emerald-400">
                    {ownedCarId === car.id ? 'Active vehicle' : 'Owned vehicle'}
                  </div>
                )}
                <button
                  onClick={() => handlePurchase(car.id)}
                  disabled={buyingId === car.id || ownedVehicleIds.includes(car.id)}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <ShoppingCart size={16} />
                  {ownedVehicleIds.includes(car.id)
                    ? 'Car Owned'
                    : buyingId === car.id
                    ? 'Processing...'
                    : 'Purchase Vehicle'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-blue-900/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShieldCheck size={32} className="text-blue-400" />
            <div>
              <h3 className="font-bold text-blue-200">Vehicle Insurance</h3>
              <p className="text-sm text-blue-300/70">Protect your ride from raids and damage.</p>
            </div>
          </div>
          <button
            onClick={handleInsurance}
            disabled={insuring}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-900/20 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Palette size={18} />
            {insuring ? 'Processing...' : 'Get Insured'}
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign size={20} className="text-green-400" />
                Vehicle Resale
              </h3>
              <p className="text-sm text-gray-400">
                Sell your current vehicle back to the dealership for coins.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setShowTitleModal(true)}
                disabled={!ownedCarId}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium border border-white/15 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                View Title / Sell
              </button>
              <button
                onClick={handleSellVehicle}
                disabled={selling || !ownedCarId}
                className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium shadow-lg shadow-green-900/20 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {selling ? 'Selling...' : 'Sell to Dealership'}
              </button>
            </div>
          </div>

          {ownedCarId && (
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wrench size={18} className="text-amber-400" />
                  <h3 className="text-lg font-bold text-white">Vehicle Upgrades</h3>
                </div>
                <p className="text-xs text-zinc-400">
                  Spend TrollCoins to improve or customize your ride.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {VEHICLE_UPGRADE_CATALOG.map((upgrade) => {
                  const installed = vehicleUpgrades.some(
                    (u) =>
                      u.vehicle_id === ownedCarId &&
                      u.upgrade_type === upgrade.id &&
                      u.status === 'installed'
                  );
                  const isBusy = startingUpgradeId === upgrade.id;

                  return (
                    <div
                      key={upgrade.id}
                      className="bg-black/40 border border-zinc-800 rounded-xl p-3 flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">{upgrade.name}</p>
                        <p className="text-xs text-zinc-400">{upgrade.description}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-emerald-400">
                          {upgrade.cost.toLocaleString()} TrollCoins
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartUpgrade(upgrade.id)}
                          disabled={installed || isBusy}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {installed ? 'Installed' : isBusy ? 'Installing...' : 'Install'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="border-t border-zinc-800 pt-4 mt-2">
                 <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Palette size={16} className="text-purple-400"/>
                    Custom 3D Model (TurboSquid / External)
                 </h3>
                 <p className="text-xs text-zinc-500 mb-2">
                    Paste a URL to a .glb or .obj file (e.g. from /models/cars/) to replace your car's look.
                 </p>
                 <div className="flex gap-2">
                    <input 
                       type="text" 
                       placeholder="/models/cars/my_custom_car.glb" 
                       className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-zinc-700 text-sm text-white focus:outline-none focus:border-purple-500"
                       value={customModelUrl}
                       onChange={e => setCustomModelUrl(e.target.value)}
                    />
                    <button 
                       onClick={handleSaveCustomModel}
                       className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold"
                    >
                       Save
                    </button>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showTitleModal && ownedCarId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Vehicle Title</h2>
              <button
                type="button"
                onClick={() => setShowTitleModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-zinc-500">Owner</p>
                  <p className="text-sm font-semibold text-white truncate">
                    {profile?.username || 'Unknown'}
                  </p>
                  <p className="text-xs text-zinc-400">
                    User ID: {user?.id}
                  </p>
                </div>
                {(() => {
                  const vehicle = cars.find(c => c.id === ownedCarId);
                  if (!vehicle) return null;
                  return (
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-10 rounded-lg border border-zinc-700 overflow-hidden flex items-center justify-center bg-zinc-900">
                        {vehicle.image ? (
                          <img
                            src={vehicle.image}
                            alt={vehicle.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full"
                            style={{ background: `linear-gradient(90deg, ${vehicle.colorFrom}, ${vehicle.colorTo})` }}
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{vehicle.name}</p>
                        <p className="text-xs text-zinc-400">
                          ID #{vehicle.id}{' '}
                          {'tier' in vehicle && (vehicle as any).tier
                            ? `• ${(vehicle as any).tier}`
                            : ''}
                        </p>
                        <p className="text-xs text-emerald-400">
                          Value: {vehicle.price.toLocaleString()} TrollCoins
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <p className="text-xs uppercase tracking-widest text-zinc-500">Create Listing</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      min={1}
                      value={listingPrice}
                      onChange={(e) => setListingPrice(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Listing price (TrollCoins)"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setListingType('sale')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                        listingType === 'sale'
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-black/40 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      Direct Sale
                    </button>
                    <button
                      type="button"
                      onClick={() => setListingType('auction')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                        listingType === 'auction'
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-black/40 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      Auction
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Listings are visible in the marketplace so other users can buy or bid on your vehicle.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTitleModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateListing}
                  disabled={creatingListing}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {creatingListing
                    ? 'Creating...'
                    : listingType === 'sale'
                    ? 'Post for Sale'
                    : 'Start Auction'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

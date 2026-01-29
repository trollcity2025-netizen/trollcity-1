import React, { useState, useEffect } from 'react';
import { Car, ShoppingCart, ShieldCheck, Palette, DollarSign, Wrench, BadgeCheck, FileText } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { deductCoins, addCoins } from '../../lib/coinTransactions';
import { notifySystemAnnouncement } from '../../lib/notifications';
import { syncCarPurchase, subscribeToUserCars, listenForPurchaseBroadcasts } from '../../lib/purchaseSync';
import { toast } from 'sonner';
import { cars } from '../../data/vehicles';

export default function CarDealershipPage() {
  // --- Driving Test Reward State ---
  const [showDrivingTestPopup, setShowDrivingTestPopup] = useState(false);
  const [collectingFreeCar, setCollectingFreeCar] = useState(false);
    // Simulate driving test pass (replace with real trigger as needed)
    const handlePassDrivingTest = () => {
      setShowDrivingTestPopup(true);
    };

    // Grant free Troll Compact S1 (id: 1) and set as active car
    const handleCollectFreeCar = async () => {
      if (!user) return;
      setCollectingFreeCar(true);
      const car = cars.find((c) => c.id === 1); // Troll Compact S1
      if (!car) {
        toast.error('Troll Compact S1 not found');
        setCollectingFreeCar(false);
        return;
      }
      try {
        // Look up vehicles_catalog row by model_url first, then by name
        let vehicleCatalogId: string | null = null;
        try {
          const byModel = await supabase
            .from('vehicles_catalog')
            .select('id, model_url, name')
            .eq('model_url', car.modelUrl)
            .maybeSingle();
          if (!byModel.error && byModel.data?.id) {
            vehicleCatalogId = byModel.data.id as string;
          } else {
            const byName = await supabase
              .from('vehicles_catalog')
              .select('id, name')
              .eq('name', car.name)
              .maybeSingle();
            if (!byName.error && byName.data?.id) {
              vehicleCatalogId = byName.data.id as string;
            }
          }
        } catch {
          vehicleCatalogId = null;
        }
        if (!vehicleCatalogId) {
          toast.error('Catalog vehicle not found for reward');
          setCollectingFreeCar(false);
          return;
        }
        // Call purchase_car_v2 with p_is_free=true to bypass vehicle limit check
        const { data: purchaseResult, error } = await supabase.rpc('purchase_car_v2', {
          p_car_id: vehicleCatalogId,
          p_model_url: car.modelUrl,
          p_customization: { color: car.colorFrom, car_model_id: car.id },
          p_is_free: true
        });
        if (error) {
          toast.error('Failed to grant free car: ' + error.message);
          setCollectingFreeCar(false);
          return;
        }
        // Sync and set as active
        await syncCarPurchase(user.id);
        toast.success('Troll Compact S1 added and set as your active car!');
        setShowDrivingTestPopup(false);
      } catch (err: any) {
        toast.error('Failed to grant car: ' + (err.message || 'Unknown error'));
      } finally {
        setCollectingFreeCar(false);
      }
    };
  const { user, profile, refreshProfile } = useAuthStore();
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [insuring, setInsuring] = useState(false);
  const [selling, setSelling] = useState(false);
  const [hasCarInsurance, setHasCarInsurance] = useState(false);
  const [ownedCarId, setOwnedCarId] = useState<number | null>(null);
  const [ownedVehicleIds, setOwnedVehicleIds] = useState<number[]>([]);
  const [garageCars, setGarageCars] = useState<
    { id: string; car_id: string; is_active: boolean; purchased_at: string; model_url: string; customization_json: any; title_status?: string; notarized_at?: string }[]
  >([]);

  const [requestingNotary, setRequestingNotary] = useState(false);

  const [showTitleModal, setShowTitleModal] = useState(false);
  const [listingPrice, setListingPrice] = useState('');
  const [listingType, setListingType] = useState<'sale' | 'auction'>('sale');
  const [auctionDurationHours, setAuctionDurationHours] = useState('24');
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

  // Helper to resolve the numeric car model ID from a user_cars row
  const getCarModelId = (row: any): number | null => {
    // 1. Try direct parsing if car_id is numeric
    const directId = Number(row.car_id);
    if (Number.isFinite(directId)) return directId;

    // 2. Try customization_json.car_model_id (fallback for UUID car_ids)
    if (row.customization_json && typeof row.customization_json.car_model_id === 'number') {
      return row.customization_json.car_model_id;
    }

    // 3. Last resort: Try to match by name if we have to (unreliable, skipped for now)
    return null;
  };

  useEffect(() => {
    let isMounted = true;

    const loadCarInsurance = async () => {
      if (!user?.id) {
        if (isMounted) setHasCarInsurance(false);
        return;
      }

      try {
        // Relaxed query: Check for any policy that hasn't expired yet
        const { data, error } = await supabase
          .from('car_insurance_policies')
          .select('id, expires_at, is_active')
          .eq('user_id', user.id)
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Failed to load car insurance status:', error);
        }

        const active = Array.isArray(data) && data.length > 0;

        if (isMounted) {
          setHasCarInsurance(active);
          if (active) {
            localStorage.setItem(`trollcity_car_insurance_${user.id}`, JSON.stringify({ active: true }));
          } else {
            localStorage.removeItem(`trollcity_car_insurance_${user?.id}`);
          }
        }
      } catch (err) {
        console.error('Car insurance status lookup failed:', err);
        // Fall back to cached flag if the DB call fails
        if (isMounted) {
          try {
            const raw = user?.id ? localStorage.getItem(`trollcity_car_insurance_${user.id}`) : null;
            const parsed = raw ? JSON.parse(raw) : null;
            setHasCarInsurance(Boolean(parsed && parsed.active));
          } catch {
            setHasCarInsurance(false);
          }
        }
      }
    };

    loadCarInsurance();

    if (!user?.id) return () => { isMounted = false; };

    const channel = supabase
      .channel(`car_insurance_policies:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'car_insurance_policies',
          filter: `user_id=eq.${user.id}`
        },
        () => loadCarInsurance()
      )
      .subscribe();

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !ownedCarId) {
      setVehicleUpgrades([]);
      return;
    }
    // Load upgrades (legacy table for now)
    const loadUpgrades = async () => {
      const { data, error } = await supabase
        .from('vehicle_upgrades')
        .select('id, vehicle_id, upgrade_type, status, cost')
        .eq('user_id', user.id)
        .eq('vehicle_id', ownedCarId);

      if (!error && data) {
        setVehicleUpgrades(data as any);
      }
    };
    loadUpgrades();
  }, [user?.id, ownedCarId]);

  const handleSaveCustomModel = async () => {
    if (!user?.id || !ownedCarId) return;
    
    // Find the active user_cars row
    const userCarRow = garageCars.find((g) => getCarModelId(g) === ownedCarId);
    if (!userCarRow) {
        toast.error("Active car not found in garage data");
        return;
    }

    try {
        const { error } = await supabase
            .from('user_cars')
            .update({ model_url: customModelUrl })
            .eq('id', userCarRow.id);

        if (error) throw error;
        
        toast.success('Custom model URL saved to cloud!');
        
        // Update local state
        setGarageCars(prev => prev.map(c => 
            c.id === userCarRow.id ? { ...c, model_url: customModelUrl } : c
        ));
        
    } catch (e: any) {
        console.error('Failed to save model url:', e);
        toast.error('Failed to save: ' + e.message);
    }
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
        toast.error(result.error || 'Failed to start upgrade');
        return;
      }

      // Record in vehicle_upgrades (legacy/audit)
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

      if (!insertError && inserted) {
          setVehicleUpgrades((prev) => [...prev, inserted as any]);
      }
      
      // Update user_cars customization
      const userCarRow = garageCars.find((g) => getCarModelId(g) === ownedCarId);
      if (userCarRow) {
          const currentCustom = userCarRow.customization_json || {};
          const updates: any = {};
          
          if (upgrade.id === 'paint_matte_black') updates.color = '#111111';
          if (upgrade.id === 'paint_candy_red') updates.color = '#ff0000';
          
          // Mapping other upgrades to customization JSON
          if (upgrade.id === 'engine_tune') updates.engine = 'tune';
          if (upgrade.id === 'engine_v8') updates.engine = 'v8';
          if (upgrade.id === 'armor_plating') updates.armor = true;
          if (upgrade.id === 'neon_underglow') updates.neon = true;
          if (upgrade.id === 'wheels_sport') updates.wheels = 'sport';
          if (upgrade.id === 'wheels_luxury') updates.wheels = 'luxury';
          if (upgrade.id === 'muffler_race') updates.exhaust = 'race';
          if (upgrade.id === 'tint_5') updates.tint = 5;
          if (upgrade.id === 'tint_20') updates.tint = 20;
          if (upgrade.id === 'tint_40') updates.tint = 40;
          
          const newCustom = { ...currentCustom, ...updates, upgrades: [...(currentCustom.upgrades || []), upgrade.id] };
          
          await supabase.from('user_cars').update({ customization_json: newCustom }).eq('id', userCarRow.id);
          
          // Update local state
          setGarageCars(prev => prev.map(c => c.id === userCarRow.id ? { ...c, customization_json: newCustom } : c));
      }

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
      setGarageCars([]);
      return;
    }

    const refreshGarage = async () => {
      try {
        const { data, error } = await supabase
          .from('user_cars')
          .select('*')
          .eq('user_id', user.id)
          .order('purchased_at', { ascending: false });

        if (error) throw error;

        const rows = (data || []) as any[];
        setGarageCars(rows);

        if (rows.length > 0) {
          const ownedIds = rows
            .map((row) => getCarModelId(row))
            .filter((id): id is number => id !== null);

          const activeRow =
            rows.find((row) => row.is_active) || rows[0];

          const activeCarId = activeRow ? getCarModelId(activeRow) : null;

          setOwnedVehicleIds(ownedIds);
          setOwnedCarId(activeCarId);

          localStorage.setItem(
            `trollcity_owned_vehicles_${user.id}`,
            JSON.stringify(ownedIds)
          );

          if (activeCarId) {
             const activeCarConfig = cars.find((c) => c.id === activeCarId);
             if (activeCarConfig) {
               // Update local storage for other components that might still use it
               localStorage.setItem(
                 `trollcity_car_${user.id}`,
                 JSON.stringify({
                   carId: activeCarConfig.id,
                   colorFrom: activeCarConfig.colorFrom,
                   colorTo: activeCarConfig.colorTo,
                   name: activeCarConfig.name,
                   tier: activeCarConfig.tier,
                   price: activeCarConfig.price,
                   style: activeCarConfig.style
                 })
               );
             }
          }
        } else {
            // Fallback to profile if user_cars is empty (migration phase)
            // But we want to encourage using user_cars.
            setOwnedVehicleIds([]);
            setOwnedCarId(null);
        }
      } catch (err) {
        console.error('Failed to load vehicle data from DB:', err);
      }
    };

    // Initial load
    refreshGarage();

    // Set up real-time subscription to user_cars table
    const subscription = subscribeToUserCars(user.id, (rows) => {
      setGarageCars(rows);
      if (rows.length > 0) {
        const ownedIds = rows
          .map((row: any) => getCarModelId(row))
          .filter((id: number | null): id is number => id !== null);
        const activeRow = rows.find((row: any) => row.is_active) || rows[0];
        const activeCarId = activeRow ? getCarModelId(activeRow) : null;
        setOwnedVehicleIds(ownedIds);
        setOwnedCarId(activeCarId);
        localStorage.setItem(`trollcity_owned_vehicles_${user.id}`, JSON.stringify(ownedIds));
      }
    });

    // Listen for purchase broadcasts from other tabs/windows
    const unsubscribeBroadcast = listenForPurchaseBroadcasts((data) => {
      if (data.type === 'car_purchased' && data.userId === user.id) {
        console.log('Car purchase detected from another tab:', data);
        refreshGarage();
      }
    });

    return () => {
      // Cleanup subscriptions
      subscription.unsubscribe();
      unsubscribeBroadcast();
    };
  }, [user, profile]);

  const handlePurchase = async (carId: number) => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    // Check if user already has a vehicle (client-side check before server)
    if (ownedCarId) {
      toast.error('You already own a vehicle. Please sell your current vehicle before purchasing a new one.');
      return;
    }

    const car = cars.find((c) => c.id === carId);
    if (!car) return;

    setBuyingId(carId);
    try {
      // 1. Deduct Coins
      const coinResult = await deductCoins({
        userId: user.id,
        amount: car.price,
        type: 'troll_town_purchase',
        description: `Purchased ${car.name}`,
        metadata: { car_id: car.id, car_name: car.name }
      });

      if (!coinResult.success) {
        toast.error(coinResult.error || 'Not enough coins');
        return;
      }

      // 2. Resolve vehicles_catalog.id and call purchase_car_v2 using p_vehicle_id
      const modelUrl = car.modelUrl || `/models/cars/car_${car.id}.glb`;

      // Look up vehicles_catalog row by model_url first, then by name
      let vehicleCatalogId: string | null = null;
      try {
        const byModel = await supabase
          .from('vehicles_catalog')
          .select('id, model_url, name')
          .eq('model_url', modelUrl)
          .maybeSingle();
        if (!byModel.error && byModel.data?.id) {
          vehicleCatalogId = byModel.data.id as string;
        } else {
          const byName = await supabase
            .from('vehicles_catalog')
            .select('id, name')
            .eq('name', car.name)
            .maybeSingle();
          if (!byName.error && byName.data?.id) {
            vehicleCatalogId = byName.data.id as string;
          }
        }
      } catch {
        vehicleCatalogId = null;
      }

      if (!vehicleCatalogId) {
        toast.error('Catalog vehicle not found for purchase');
        // Refund coins since we cannot proceed
        try {
          await addCoins({
            userId: user.id,
            amount: car.price,
            type: 'refund',
            description: `Refund for failed ${car.name} purchase (catalog lookup failed)`,
            metadata: { car_id: car.id, reason: 'catalog_not_found' }
          });
        } catch {}
        return;
      }

      let usedLegacyVehicles = false;
      // Preferred call: use p_car_id (vehicles_catalog.id) - p_is_free is false for purchases
      let { data: purchaseResult, error } = await supabase.rpc('purchase_car_v2', {
        p_car_id: vehicleCatalogId,
        p_model_url: modelUrl,
        p_customization: { color: car.colorFrom, car_model_id: car.id },
        p_is_free: false
      });

      // Fallbacks
      const msgLower = (error?.message || '').toLowerCase();
      // If RPC rejects p_vehicle_id argument name (or function not found due to param mismatch), fall back to p_car_id
      if (error && (msgLower.includes('invalid named argument') || msgLower.includes('missing required argument') || msgLower.includes('could not find the function'))) {
        console.warn('purchase_car_v2 named argument mismatch; retrying with p_car_id using catalog UUID');
        const retry = await supabase.rpc('purchase_car_v2', {
          p_car_id: vehicleCatalogId,
          p_model_url: modelUrl,
          p_customization: { color: car.colorFrom, car_model_id: car.id }
        });
        purchaseResult = retry.data as any;
        error = retry.error as any;
      }

      // If DB expects UUID for car_id and rejects numeric (legacy flow), we already pass catalog UUID above.
      // Keep an extra guard for explicit uuid syntax errors.
      if (error && (error.code === '22P02' || msgLower.includes('invalid input syntax for type uuid'))) {
        console.warn('purchase_car_v2 UUID type mismatch detected; retrying with a generated UUID and embedding model id in customization');
        const uuidId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : `${Date.now()}-fallback-uuid`;
        const retry = await supabase.rpc('purchase_car_v2', {
          p_car_id: uuidId,
          p_model_url: modelUrl,
          p_customization: { color: car.colorFrom, car_model_id: car.id }
        });
        purchaseResult = retry.data as any;
        error = retry.error as any;
      }

      if (error) {
        console.error('purchase_car_v2 failed:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });

        // If the error references user_vehicles missing car_id, fallback to inserting into user_vehicles
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('user_vehicles') && msg.includes('car_id')) {
          console.warn('Falling back to user_vehicles insert (using vehicle_id)');
          try {
            const { data: vehRow, error: vehErr } = await supabase
              .from('user_vehicles')
              .insert({
                user_id: user.id,
                vehicle_id: String(car.id),
                is_equipped: false
              })
              .select('id')
              .single();

            if (!vehErr && vehRow?.id) {
              purchaseResult = vehRow.id as any;
              usedLegacyVehicles = true;
            } else {
              throw vehErr || new Error('Fallback insert to user_vehicles failed');
            }
          } catch (fallbackErr: any) {
            console.error('user_vehicles fallback failed:', fallbackErr);
            // Refund coins since purchase failed
            try {
              await addCoins({
                userId: user.id,
                amount: car.price,
                type: 'refund',
                description: `Refund for failed ${car.name} purchase`,
                metadata: { car_id: car.id, original_transaction: 'purchase_car_failed' }
              });
              toast.error(`Purchase failed: ${error.message || 'Database error'}. Coins refunded.`);
            } catch (refundErr) {
              console.error('Refund failed:', refundErr);
              toast.error(`Purchase failed and refund error. Please contact support with car: ${car.name}`);
            }
            return;
          }
        } else {
          // Refund coins since purchase failed
          try {
            await addCoins({
              userId: user.id,
              amount: car.price,
              type: 'refund',
              description: `Refund for failed ${car.name} purchase`,
              metadata: { car_id: car.id, original_transaction: 'purchase_car_failed' }
            });
            toast.error(`Purchase failed: ${error.message || 'Database error'}. Coins refunded.`);
          } catch (refundErr) {
            console.error('Refund failed:', refundErr);
            toast.error(`Purchase failed and refund error. Please contact support with car: ${car.name}`);
          }
          return;
        }
      }

      console.log('Purchase successful, car added with ID:', purchaseResult);

      toast.success(`You purchased ${car.name}. Added to your garage.`);
      
      // Cross-platform sync: clear caches, update profile, broadcast to other tabs
      try {
        const syncResult = await syncCarPurchase(user.id);
        // Optionally, you can use syncResult.activeVehicleId here if needed
        // Example: console.log('Synced activeVehicleId:', syncResult.activeVehicleId);
        // If legacy user_vehicles was used, ensure one equipped and sync profile.active_vehicle
        if (usedLegacyVehicles && purchaseResult) {
          try {
            const { data: eq, error: eqErr } = await supabase
              .from('user_vehicles')
              .select('id')
              .eq('user_id', user.id)
              .eq('is_equipped', true)
              .limit(1);
            if (eqErr) {
              console.warn('Failed to check equipped vehicle state:', eqErr);
            }
            const hasEquipped = Array.isArray(eq) && eq.length > 0;
            if (!hasEquipped) {
              await supabase
                .from('user_vehicles')
                .update({ is_equipped: true })
                .eq('id', purchaseResult as any);
            }
            await supabase
              .from('user_profiles')
              .update({ active_vehicle: purchaseResult as any })
              .eq('id', user.id);
          } catch (legacySyncErr) {
            console.warn('Legacy user_vehicles sync failed:', legacySyncErr);
          }
        }

        // Immediately refresh garage to ensure UI buttons are enabled
        try {
          const { data: refreshedCars } = await supabase
            .from('user_cars')
            .select('*')
            .eq('user_id', user.id)
            .order('purchased_at', { ascending: false });
          
          if (Array.isArray(refreshedCars) && refreshedCars.length > 0) {
            setGarageCars(refreshedCars);
            const ownedIds = refreshedCars
              .map((row: any) => getCarModelId(row))
              .filter((id: number | null): id is number => id !== null);
            const activeRow = refreshedCars.find((row: any) => row.is_active) || refreshedCars[0];
            const activeCarId = activeRow ? getCarModelId(activeRow) : null;
            setOwnedVehicleIds(ownedIds);
            setOwnedCarId(activeCarId);
          }
        } catch (refreshErr) {
          console.warn('Failed to refresh garage after purchase:', refreshErr);
        }
      } catch (syncErr) {
        console.error('Sync after purchase failed:', syncErr);
        // Still proceed - sync errors shouldn't block user
      }

    } catch (err: any) {
      console.error('Purchase flow failed:', err);
      toast.error('Transaction failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBuyingId(null);
    }
  };

  const handleSelectActiveVehicle = async (vehicleId: number) => {
    if (!user) return;
    const car = cars.find(c => c.id === vehicleId);
    if (!car) return;

    // Find the row in garageCars using the helper
    const userCarRow = garageCars.find((g) => getCarModelId(g) === vehicleId);
    
    if (!userCarRow) {
      toast.error('Vehicle not found in your garage');
      return;
    }

    try {
      const { error } = await supabase.rpc('set_active_car', {
        p_car_row_id: userCarRow.id
      });

      if (error) {
        console.error('set_active_car RPC failed:', error);
        toast.error(error.message || 'Failed to set active vehicle');
        return;
      }
      
      // Update local state
      const updatedGarage = garageCars.map(g => ({
          ...g,
          is_active: g.id === userCarRow.id
      }));
      setGarageCars(updatedGarage);
      setOwnedCarId(vehicleId);

      // Keep profile in sync with active vehicle using the user_cars UUID
      try {
        await supabase
          .from('user_profiles')
          .update({ active_vehicle: userCarRow.id })
          .eq('id', user.id);
      } catch (syncErr) {
        console.warn('Failed to sync profile.active_vehicle:', syncErr);
      }

    } catch (err: any) {
      console.error('Failed to set active vehicle:', err);
      toast.error(err?.message || 'Failed to set active vehicle');
      return;
    }

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
    toast.success(`${car.name} is now active.`);
  };

  const handleInsurance = async () => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    let activeGarageCar = garageCars.find((g) => g.is_active) || (garageCars.length > 0 ? garageCars[0] : null);

    // Fallback: if no cars in user_cars, check user_vehicles
    if (!activeGarageCar) {
      try {
        const { data: userVehicles } = await supabase
          .from('user_vehicles')
          .select('id, is_equipped')
          .eq('user_id', user.id)
          .limit(1);

        if (Array.isArray(userVehicles) && userVehicles.length > 0) {
          const vehRow = userVehicles.find((v: any) => v.is_equipped) || userVehicles[0];
          activeGarageCar = {
            id: vehRow.id,
            car_id: vehRow.id,
            is_active: true,
            purchased_at: new Date().toISOString(),
            model_url: '',
            customization_json: null
          };
        }
      } catch (err) {
        console.warn('Fallback user_vehicles check failed:', err);
      }
    }

    if (!activeGarageCar) {
      toast.error('You must own a vehicle before buying insurance');
      return;
    }

    setInsuring(true);
    try {
      const { error: rpcError } = await supabase.rpc('buy_car_insurance', {
        car_garage_id: activeGarageCar.id,
        plan_id: null
      });

      if (rpcError) {
        console.error('buy_car_insurance RPC failed:', rpcError);
        toast.error(rpcError.message || 'Failed to purchase insurance');
        return;
      }

      // Immediately update UI to show insurance is active
      setHasCarInsurance(true);
      toast.success('Vehicle insurance activated for all your cars');
      localStorage.setItem(`trollcity_car_insurance_${user.id}`, JSON.stringify({ active: true }));

      // Reload insurance status from DB to ensure accuracy
      try {
        const { data } = await supabase
          .from('car_insurance_policies')
          .select('id, expires_at, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .limit(1);
        if (Array.isArray(data) && data.length > 0) {
          setHasCarInsurance(true);
        }
      } catch (verifyErr) {
        console.warn('Failed to verify insurance purchase:', verifyErr);
      }
    } finally {
      setInsuring(false);
    }
  };

  const handleRequestNotarization = async () => {
    if (!user || !ownedCarId) {
      toast.error('You must own a vehicle to request notarization');
      return;
    }

    const userCarRow = garageCars.find((g) => Number(g.car_id) === ownedCarId);
    if (!userCarRow) {
      toast.error('Vehicle data not found');
      return;
    }

    setRequestingNotary(true);
    try {
      const { error } = await supabase
        .from('user_cars')
        .update({ title_status: 'pending_notarization' })
        .eq('id', userCarRow.id);

      if (error) {
        toast.error('Failed to request notarization: ' + error.message);
        return;
      }

      toast.success('Notarization request submitted. Waiting for Secretary approval.');
      
      // Refresh garage cars to update UI
      const { data: refreshedCars } = await supabase
        .from('user_cars')
        .select('*')
        .eq('user_id', user.id);
      
      if (refreshedCars) {
        setGarageCars(refreshedCars as any);
      }
    } catch (err: any) {
      toast.error('Failed to request notarization: ' + (err.message || 'Unknown error'));
    } finally {
      setRequestingNotary(false);
    }
  };

  const handleSellVehicle = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }

    if (!ownedCarId) {
      toast.error('You do not own a vehicle to sell');
      return;
    }

    const userCarRow = garageCars.find((g) => getCarModelId(g) === ownedCarId);
    if (!userCarRow) {
        toast.error('Active car not found in garage');
        return;
    }

    const car = cars.find((c) => c.id === ownedCarId);
    if (!car) {
      toast.error('Vehicle configuration not found');
      return;
    }

    // New Logic: 33.3% split handled by RPC
    setSelling(true);
    try {
      const { data, error } = await supabase.rpc('sell_vehicle_to_dealership', {
        p_user_car_id: userCarRow.id
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
         throw new Error(result.message || 'Sale failed');
      }

      const userShare = result.user_share || 0;

      localStorage.removeItem(`trollcity_car_${user.id}`);
      localStorage.removeItem(`trollcity_car_insurance_${user.id}`);
      localStorage.removeItem(`trollcity_vehicle_condition_${user.id}`);

      // Update owned vehicles list local state
      const nextCars = garageCars.filter(c => c.id !== userCarRow.id);
      setGarageCars(nextCars);
      
      const nextOwnedIds = nextCars.map(c => getCarModelId(c)).filter((id): id is number => id !== null);
      setOwnedVehicleIds(nextOwnedIds);
      
      const nextActiveRow = nextCars[0] || null;
      const nextActiveId = nextActiveRow ? getCarModelId(nextActiveRow) : null;
      setOwnedCarId(nextActiveId);
      
      refreshProfile();
      toast.success(`Sold ${car.name} for ${userShare.toLocaleString()} coins (User Share)`);

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

    const userCarRow = garageCars.find((g) => getCarModelId(g) === ownedCarId);
    if (!userCarRow) {
      toast.error('Vehicle data not found');
      return;
    }

    if (userCarRow.title_status !== 'notarized') {
      toast.error('You must get your title notarized by a Secretary before selling.');
      return;
    }

    const durationNumber =
      listingType === 'auction' ? Number(auctionDurationHours || '0') : 0;
    if (listingType === 'auction' && (!Number.isFinite(durationNumber) || durationNumber <= 0)) {
      toast.error('Select a valid auction duration');
      return;
    }

    const endAt =
      listingType === 'auction'
        ? new Date(Date.now() + durationNumber * 60 * 60 * 1000).toISOString()
        : null;

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
          user_car_id: userCarRow.id,
          listing_type: listingType,
          price: Math.round(priceValue),
          status: 'active',
          metadata: {
            vehicle_name: vehicle.name,
            tier: (vehicle as any).tier ?? null,
            style: (vehicle as any).style ?? null,
            end_at: endAt,
            auction_duration_hours: listingType === 'auction' ? durationNumber : null
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
      {/* TEMP: Button to simulate passing the driving test (replace with real trigger) */}
      <div className="mb-4">
        <button
          className="px-4 py-2 bg-green-700 text-white rounded-lg font-bold"
          onClick={handlePassDrivingTest}
        >
          Simulate Passing Driving Test
        </button>
      </div>
            {/* Driving Test Reward Popup */}
            {showDrivingTestPopup && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col items-center">
                  <h2 className="text-2xl font-bold text-emerald-400 mb-2">Congratulations!</h2>
                  <p className="text-lg text-white mb-4 text-center">You passed your driving test!<br/>Collect your free <span className="font-bold text-sky-400">Troll Compact S1</span> as your first car.</p>
                  <img src="/assets/cars/troll_compact_s1.png" alt="Troll Compact S1" className="w-40 h-20 object-contain mb-4" />
                  <button
                    className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold text-lg disabled:opacity-60"
                    onClick={handleCollectFreeCar}
                    disabled={collectingFreeCar}
                  >
                    {collectingFreeCar ? 'Adding Car...' : 'Collect & Set as Active'}
                  </button>
                  <button
                    className="mt-3 text-zinc-400 hover:text-white text-sm"
                    onClick={() => setShowDrivingTestPopup(false)}
                    disabled={collectingFreeCar}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
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

        {ownedCarId && (
          <div className="mb-6 p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-amber-400">Your Current Vehicle</h3>
                <p className="text-xs text-gray-400">
                  You already own a vehicle. Sell it before purchasing a new one.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const activeCar = cars.find(c => c.id === ownedCarId);
                  return activeCar ? (
                    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-lg">
                      <span className="text-sm font-medium text-white">{activeCar.name}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
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
                  <div className="relative flex flex-col items-center justify-center gap-4">
                    {/* Blueprint/Concept Visual for missing photos */}
                    <div className="relative w-40 h-20 group-hover:scale-110 transition-transform duration-500">
                      <div
                        className="absolute inset-0 rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.1)] transform skew-x-[-12deg] border-t border-white/20"
                        style={{ background: `linear-gradient(135deg, ${car.colorFrom}, ${car.colorTo})` }}
                      >
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay" />
                      </div>
                      <div className="absolute inset-x-2 bottom-2 h-4 bg-black/40 rounded-b-xl backdrop-blur-[2px]" />
                      <div className="absolute -bottom-4 left-4 w-10 h-10 bg-zinc-950 rounded-full border-2 border-zinc-700 shadow-lg group-hover:rotate-180 transition-transform duration-1000" />
                      <div className="absolute -bottom-4 right-4 w-10 h-10 bg-zinc-950 rounded-full border-2 border-zinc-700 shadow-lg group-hover:rotate-180 transition-transform duration-1000" />
                      <div className="absolute top-2 right-6 w-14 h-7 bg-blue-400/30 rounded-md border border-white/20 blur-[1px]" />
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono tracking-tighter uppercase px-2 py-1 border border-zinc-800 rounded bg-black/60">
                      Concept Render / Photo Pending
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
                  <div className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block border ${ownedCarId === car.id ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-blue-400 border-blue-500/30 bg-blue-500/10'}`}>
                    {ownedCarId === car.id ? 'Active vehicle' : 'Owned'}
                  </div>
                )}
                
                {ownedVehicleIds.includes(car.id) ? (
                  <button
                    onClick={() => handleSelectActiveVehicle(car.id)}
                    disabled={ownedCarId === car.id}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-black/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale disabled:bg-zinc-800 disabled:border-zinc-700"
                  >
                    <ShieldCheck size={16} />
                    {ownedCarId === car.id ? 'Your Active Vehicle' : 'Equip This Car'}
                  </button>
                ) : ownedCarId ? (
                  <div className="w-full py-2 bg-zinc-800 text-gray-400 rounded-lg text-sm font-bold text-center flex items-center justify-center gap-2 cursor-not-allowed">
                    <ShoppingCart size={16} />
                    Sell Current Vehicle First
                  </div>
                ) : (
                  <button
                    onClick={() => handlePurchase(car.id)}
                    disabled={buyingId === car.id}
                    className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-black/40 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart size={16} />
                    {buyingId === car.id ? 'Securing Ride...' : 'Purchase Vehicle'}
                  </button>
                )}
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
            disabled={insuring || hasCarInsurance}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-900/20 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Palette size={18} />
            {insuring ? 'Processing...' : hasCarInsurance ? 'Insured' : 'Get Insured'}
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
                  {(() => {
                    const userCarRow = garageCars.find((g) => Number(g.car_id) === ownedCarId);
                    const status = userCarRow?.title_status || 'draft';
                    
                    return (
                        <div className="mt-2">
                            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Title Status</p>
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider border ${
                                status === 'notarized' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/50' :
                                status === 'pending_notarization' ? 'bg-amber-900/30 text-amber-400 border-amber-500/50' :
                                'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}>
                                {status === 'notarized' ? <BadgeCheck size={14} /> : <FileText size={14} />}
                                {status.replace('_', ' ')}
                            </div>
                            {status === 'notarized' && userCarRow?.notarized_at && (
                                <p className="text-[10px] text-zinc-500 mt-1">
                                    Signed: {new Date(userCarRow.notarized_at).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                    );
                  })()}
                </div>
                {(() => {
                  const vehicle = cars.find(c => c.id === ownedCarId);
                  if (!vehicle) return null;
                  
                  const upgradeTotal = vehicleUpgrades.reduce((sum, u) => sum + (u.status === 'installed' ? u.cost : 0), 0);
                  const totalValue = vehicle.price + upgradeTotal;
                  
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
                        <div className="text-xs text-emerald-400 font-mono mt-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-zinc-500">Base:</span>
                            <span>{vehicle.price.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-zinc-500">Upgrades:</span>
                            <span>+{upgradeTotal.toLocaleString()}</span>
                          </div>
                          <div className="border-t border-zinc-800 mt-1 pt-1 flex justify-between gap-4 font-bold">
                            <span className="text-zinc-300">Total:</span>
                            <span>{totalValue.toLocaleString()} TC</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* Notarization Action */}
              {(() => {
                  const userCarRow = garageCars.find((g) => Number(g.car_id) === ownedCarId);
                  const status = userCarRow?.title_status || 'draft';
                  
                  if (status === 'draft') {
                      return (
                          <div className="bg-blue-900/10 border border-blue-500/20 p-3 rounded-lg flex items-center justify-between">
                              <div>
                                  <p className="text-sm text-blue-200 font-semibold">Official Notarization Required</p>
                                  <p className="text-xs text-blue-300/60">Title must be notarized by a Secretary before selling.</p>
                              </div>
                              <button
                                onClick={handleRequestNotarization}
                                disabled={requestingNotary}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-md disabled:opacity-50"
                              >
                                {requestingNotary ? 'Requesting...' : 'Request Notary'}
                              </button>
                          </div>
                      );
                  }
                  if (status === 'pending_notarization') {
                      return (
                          <div className="bg-amber-900/10 border border-amber-500/20 p-3 rounded-lg text-center">
                              <p className="text-sm text-amber-200 font-semibold">Waiting for Secretary Approval</p>
                              <p className="text-xs text-amber-300/60">Your title is currently under review.</p>
                          </div>
                      );
                  }
                  return null;
              })()}

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
                {listingType === 'auction' && (
                  <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                    <p className="text-[11px] text-zinc-400">
                      Set how long the auction will run.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAuctionDurationHours('4')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border ${
                          auctionDurationHours === '4'
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-black/40 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        4 hours
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuctionDurationHours('24')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border ${
                          auctionDurationHours === '24'
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-black/40 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        24 hours
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuctionDurationHours('72')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border ${
                          auctionDurationHours === '72'
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-black/40 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        3 days
                      </button>
                    </div>
                  </div>
                )}
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

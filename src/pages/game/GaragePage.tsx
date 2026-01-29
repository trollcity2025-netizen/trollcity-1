import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Gavel, Coins, Wrench } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { subscribeToUserCars, listenForPurchaseBroadcasts } from '../../lib/purchaseSync';
import { cars } from '../../data/vehicles';
import { toast } from 'sonner';
import CarUpgradesModal from '../../components/CarUpgradesModal';

interface VehicleListing {
  id: string;
  seller_id: string;
  vehicle_id: number;
  listing_type: 'sale' | 'auction';
  price: number;
  status: 'active' | 'sold' | 'cancelled' | 'expired';
  metadata: any;
  created_at: string;
}

interface HighestBidInfo {
  amount: number;
  bidderId: string;
}

export default function GaragePage() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [ownedVehicleIds, setOwnedVehicleIds] = useState<number[]>([]);
  const [activeVehicleId, setActiveVehicleId] = useState<number | null>(null);
   const [garageCars, setGarageCars] = useState<
    { id: string; car_model_id: number; is_active: boolean }[]
  >([]);
  const [listings, setListings] = useState<VehicleListing[]>([]);
  const [highestBids, setHighestBids] = useState<Record<string, HighestBidInfo>>({});
  const [loading, setLoading] = useState(true);
  const [showUpgradesModal, setShowUpgradesModal] = useState<string | null>(null);

  const loadGarageData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Switched to user_cars table for persistence
      const { data: garageData, error: garageError } = await supabase
        .from('user_cars')
        .select('id, car_id, is_active, purchased_at')
        .eq('user_id', user.id)
        .order('purchased_at', { ascending: false });

      if (garageError) {
        console.error('Failed to load garage vehicles', garageError);
        // Fallback: try legacy user_vehicles
        try {
          const { data: userVehicles } = await supabase
            .from('user_vehicles')
            .select('id, vehicle_id, is_equipped, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          const rows = (userVehicles || []).map((row: any) => ({
            id: row.id,
            car_model_id: Number(row.vehicle_id),
            is_active: !!row.is_equipped,
            acquired_at: row.created_at
          }));
          setGarageCars(rows);

          const ownedIds = rows
            .map((row) => Number(row.car_model_id))
            .filter((id) => Number.isFinite(id));
          const activeRow = rows.find((r) => r.is_active) || rows[0] || null;
          const activeId = activeRow?.car_model_id ?? (ownedIds[0] ?? null);
          setOwnedVehicleIds(ownedIds);
          setActiveVehicleId(activeId);
        } catch (fallbackErr) {
          console.warn('Fallback to user_vehicles failed:', fallbackErr);
          setGarageCars([]);

          const ownedFromProfile =
            Array.isArray(profile?.owned_vehicle_ids) && profile.owned_vehicle_ids.length > 0
              ? (profile.owned_vehicle_ids as any[])
                  .map((id) => Number(id))
                  .filter((id) => Number.isFinite(id))
              : [];

          const activeFromProfile =
            typeof (profile as any)?.active_vehicle === 'number'
              ? (profile as any).active_vehicle
              : ownedFromProfile[0] ?? null;

          setOwnedVehicleIds(ownedFromProfile);
          setActiveVehicleId(activeFromProfile);
        }
      } else {
        // Map user_cars format to local state
        const rows = (garageData || []).map((row: any) => ({
            id: row.id,
            car_model_id: ((): number | null => {
              const direct = Number(row.car_id);
              if (Number.isFinite(direct)) return direct;
              const fromCustomize = row?.customization_json?.car_model_id;
              const asNum = Number(fromCustomize);
              return Number.isFinite(asNum) ? asNum : null;
            })(),
            is_active: row.is_active,
            acquired_at: row.purchased_at,
            current_value: row.current_value
        }));
        setGarageCars(rows);

        let ownedIds = rows
          .map((row) => Number(row.car_model_id))
          .filter((id) => Number.isFinite(id));

        const activeRow =
          rows.find((row) => row.is_active) || (rows.length > 0 ? rows[0] : null);

        let activeId =
          activeRow && typeof activeRow.car_model_id === 'number'
            ? activeRow.car_model_id
            : null;

        if (!ownedIds.length) {
          ownedIds =
            Array.isArray(profile?.owned_vehicle_ids) && profile.owned_vehicle_ids.length > 0
              ? (profile.owned_vehicle_ids as any[])
                  .map((id) => Number(id))
                  .filter((id) => Number.isFinite(id))
              : [];
        }

        if (!activeId) {
          if (typeof (profile as any)?.active_vehicle === 'number') {
            activeId = (profile as any).active_vehicle;
          } else if (typeof (profile as any)?.active_vehicle === 'string') {
            // Resolve UUID to model id if present
            const activeUuid = (profile as any).active_vehicle as string;
            const candidate = rows.find(r => r.id === activeUuid);
            if (candidate && typeof candidate.car_model_id === 'number') {
              activeId = candidate.car_model_id;
            }
          } else if (ownedIds.length > 0) {
            activeId = ownedIds[0];
          }
        }

        setOwnedVehicleIds(ownedIds);
        setActiveVehicleId(activeId);
      }

      const { data: listingsData, error: listingsError } = await supabase
        .from('vehicle_listings')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (listingsError) {
        console.error('Failed to load garage listings', listingsError);
        setListings([]);
        setHighestBids({});
        return;
      }

      const loadedListings = (listingsData || []) as VehicleListing[];
      setListings(loadedListings);

      const auctionIds = loadedListings
        .filter((l) => l.listing_type === 'auction')
        .map((l) => l.id);

      if (auctionIds.length > 0) {
        const { data: bidsData, error: bidsError } = await supabase
          .from('vehicle_auction_bids')
          .select('listing_id, bid_amount, bidder_id')
          .in('listing_id', auctionIds);

        if (!bidsError && bidsData) {
          const map: Record<string, HighestBidInfo> = {};
          for (const bid of bidsData as any[]) {
            const existing = map[bid.listing_id];
            if (!existing || bid.bid_amount > existing.amount) {
              map[bid.listing_id] = {
                amount: bid.bid_amount,
                bidderId: bid.bidder_id
              };
            }
          }
          setHighestBids(map);
        } else {
          setHighestBids({});
        }
      } else {
        setHighestBids({});
      }
    } catch (err) {
      console.error('Error loading garage data', err);
      setListings([]);
      setHighestBids({});
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    loadGarageData();

    // Subscribe to real-time user_cars updates
    const carsSubscription = subscribeToUserCars(user.id, () => {
      loadGarageData();
    });

    // Listen for purchase broadcasts from other tabs/windows
    const unsubscribeBroadcast = listenForPurchaseBroadcasts((data) => {
      if (data.type === 'car_purchased' && data.userId === user.id) {
        console.log('Car purchase detected from another tab, refreshing garage');
        loadGarageData();
      }
    });

    const listingsChannel = supabase
      .channel(`garage-listings-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vehicle_listings',
          filter: `seller_id=eq.${user.id}`
        },
        () => {
          loadGarageData();
        }
      )
      .subscribe();

    const bidsChannel = supabase
      .channel(`garage-bids-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vehicle_auction_bids'
        },
        () => {
          loadGarageData();
        }
      )
      .subscribe();

    return () => {
      carsSubscription.unsubscribe();
      unsubscribeBroadcast();
      supabase.removeChannel(listingsChannel);
      supabase.removeChannel(bidsChannel);
    };
  }, [user, navigate, loadGarageData]);

  const handleSetActiveVehicle = async (vehicleId: number) => {
    if (!user) return;
    const garageCar = garageCars.find((g) => g.car_model_id === vehicleId);
    if (!garageCar) {
      toast.error('Vehicle not found in your garage');
      return;
    }

    try {
      const { error } = await supabase.rpc('set_active_car', {
        p_car_row_id: garageCar.id
      });

      if (error) {
        console.error('set_active_car RPC failed:', error);
        toast.error(error.message || 'Failed to set active vehicle');
        return;
      }

      setActiveVehicleId(vehicleId);
      setGarageCars((prev) =>
        prev.map((row) => ({
          ...row,
          is_active: row.id === garageCar.id
        }))
      );

      toast.success('Active vehicle updated');
    } catch (err: any) {
      console.error('Failed to set active vehicle:', err);
      toast.error(err?.message || 'Failed to set active vehicle');
    }
  };

  if (!user) return null;

  const formatCountdown = (endIso: string | undefined) => {
    if (!endIso) return null;
    const endAt = new Date(endIso);
    if (isNaN(endAt.getTime())) return null;
    const now = new Date();
    const diff = endAt.getTime() - now.getTime();
    if (diff <= 0) return 'Ended';
    const totalMinutes = Math.floor(diff / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) {
      return `${minutes}m remaining`;
    }
    return `${hours}h ${minutes}m remaining`;
  };

  const activeGarageListings = listings.filter((l) => l.status === 'active');

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 text-white p-6 pt-24 pb-20">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-700/20 border border-emerald-500/40">
              <Car className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                Garage
              </h1>
              <p className="text-sm text-zinc-400">
                Your owned vehicles, titles, and live auctions in one place.
              </p>
            </div>
          </div>
          <div className="text-xs text-zinc-400">
            First garage is free. Additional storage is handled automatically.
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-black/40 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Owned Vehicles</h2>
                  <p className="text-xs text-zinc-400">
                    Vehicles saved to your account and restored even after clearing cache.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dealership')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/15"
                >
                  Open Dealership
                </button>
              </div>
              {ownedVehicleIds.length === 0 ? (
                <div className="border border-dashed border-zinc-700 rounded-xl p-6 text-center text-sm text-zinc-400">
                  You do not own any vehicles yet. Visit the dealership to purchase your first ride.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ownedVehicleIds.map((id) => {
                    const vehicle = cars.find((c) => c.id === id);
                    if (!vehicle) return null;
                    
                    // Find the dynamic car data to get current value
                    const garageCar = garageCars.find(g => g.car_model_id === id);
                    const currentValue = garageCar?.current_value || vehicle.price;
                    const titleValue = currentValue.toLocaleString();
                    
                    const isActive = activeVehicleId === id;
                    return (
                      <div
                        key={id}
                        className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 flex gap-3 items-center"
                      >
                        <div className="w-20 h-14 rounded-lg border border-zinc-700 overflow-hidden flex items-center justify-center bg-zinc-950">
                          {vehicle.image ? (
                            <img
                              src={vehicle.image}
                              alt={vehicle.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{
                                background: `linear-gradient(90deg, ${vehicle.colorFrom}, ${vehicle.colorTo})`
                              }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold truncate">{vehicle.name}</p>
                              <p className="text-[11px] text-zinc-400">
                                ID #{vehicle.id}
                                {'tier' in vehicle && (vehicle as any).tier
                                  ? ` • ${(vehicle as any).tier}`
                                  : ''}
                              </p>
                            </div>
                            {isActive && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/40">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-emerald-400">
                            Title value: {titleValue} TrollCoins
                          </p>
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleSetActiveVehicle(id)}
                              className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              Set Active
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowUpgradesModal(garageCar?.id || null)}
                            className="mt-2 ml-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-purple-600 hover:bg-purple-500 text-white"
                          >
                            <Wrench className="w-3 h-3 inline-block mr-1" />
                            Upgrade
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-black/40 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-purple-300" />
                  <div>
                    <h2 className="text-xl font-semibold">Your Vehicle Auctions</h2>
                    <p className="text-xs text-zinc-400">
                      Live listings created from your titles, updating in real time.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/auctions')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/15"
                >
                  View Global Auctions
                </button>
              </div>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-24 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : activeGarageListings.length === 0 ? (
                <div className="border border-dashed border-zinc-700 rounded-xl p-6 text-center text-sm text-zinc-400 bg-black/40">
                  You have no active vehicle listings. Start an auction from your vehicle title in
                  the dealership.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeGarageListings.map((listing) => {
                    const vehicle = cars.find((c) => c.id === listing.vehicle_id);
                    const vehicleName =
                      listing.metadata?.vehicle_name || vehicle?.name || `Vehicle #${listing.vehicle_id}`;
                    const tier = listing.metadata?.tier || (vehicle as any)?.tier;
                    const highestInfo = highestBids[listing.id];
                    const highest = highestInfo?.amount;
                    const currentPrice =
                      highest && highest > listing.price ? highest : listing.price;
                    const endAtIso =
                      listing.listing_type === 'auction'
                        ? (listing.metadata?.end_at as string | undefined)
                        : undefined;
                    const countdown = listing.listing_type === 'auction' ? formatCountdown(endAtIso) : null;
                    const isAuction = listing.listing_type === 'auction';
                    return (
                      <div
                        key={listing.id}
                        className="bg-zinc-900 border border-purple-500/30 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Car className="w-4 h-4 text-purple-300" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{vehicleName}</p>
                              <p className="text-[11px] text-zinc-400">
                                ID #{listing.vehicle_id}
                                {tier ? ` • ${tier}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] uppercase tracking-wide text-purple-400">
                              {isAuction ? 'Auction' : 'Direct Sale'}
                            </p>
                            <p className="text-[11px] text-zinc-500">
                              Status: {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] text-zinc-400">
                              {isAuction && highest ? 'Current highest bid' : 'Listing price'}
                            </p>
                            <p className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                              <Coins className="w-4 h-4" />
                              {currentPrice.toLocaleString()} TrollCoins
                            </p>
                          </div>
                          {isAuction && countdown && (
                            <div className="text-right">
                              <p className="text-[11px] text-zinc-400">Time remaining</p>
                              <p className="text-[12px] text-purple-300 font-semibold">
                                {countdown}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-black/40 border border-emerald-600/40 rounded-2xl p-5">
              <h2 className="text-lg font-semibold mb-2">Garage Status</h2>
              <p className="text-xs text-zinc-400 mb-3">
                Every user starts with a free starter garage. Your vehicles are stored securely on
                the server and will not be lost if you clear browser cache or reload.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Garage Slots Used</span>
                  <span className="font-semibold">
                    {ownedVehicleIds.length} vehicle{ownedVehicleIds.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Active Vehicle</span>
                  <span className="font-semibold">
                    {activeVehicleId
                      ? cars.find((c) => c.id === activeVehicleId)?.name || `Vehicle #${activeVehicleId}`
                      : 'None selected'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      {showUpgradesModal && (
        <CarUpgradesModal
          userCarId={showUpgradesModal}
          onClose={() => setShowUpgradesModal(null)}
          onUpdate={loadGarageData}
        />
      )}
    </div>
  );
}


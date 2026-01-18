import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { deductCoins, addCoins, recordCoinTransaction } from '../lib/coinTransactions';
import { toast } from 'sonner';
import { Gavel, Car, Coins, Clock } from 'lucide-react';
import { cars } from '../data/vehicles';

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

export default function AuctionsPage() {
  const { user, refreshProfile } = useAuthStore();
  const navigate = useNavigate();
  const [listings, setListings] = useState<VehicleListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [highestBids, setHighestBids] = useState<Record<string, HighestBidInfo>>({});
  const [placingBidFor, setPlacingBidFor] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    loadAuctions();
  }, [user, navigate]);

  const loadAuctions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicle_listings')
        .select('*')
        .eq('listing_type', 'auction')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load auctions', error);
        toast.error('Failed to load auctions');
        setListings([]);
        return;
      }

      const loaded = (data || []) as VehicleListing[];
      setListings(loaded);

      const ids = loaded.map((l) => l.id);
      if (ids.length > 0) {
        const { data: bidsData, error: bidsError } = await supabase
          .from('vehicle_auction_bids')
          .select('listing_id, bid_amount, bidder_id')
          .in('listing_id', ids);

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
      console.error('Error loading auctions', err);
      toast.error('Failed to load auctions');
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBidInputChange = (listingId: string, value: string) => {
    const cleaned = value.replace(/[^\d]/g, '');
    setBidInputs((prev) => ({ ...prev, [listingId]: cleaned }));
  };

  const handlePlaceBid = async (listing: VehicleListing) => {
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    const raw = (bidInputs[listing.id] || '').trim();
    if (!raw) {
      toast.error('Enter a bid amount');
      return;
    }
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid bid amount');
      return;
    }

    const now = new Date();
    const endAtIso = listing.metadata?.end_at as string | undefined;
    if (endAtIso) {
      const endAt = new Date(endAtIso);
      if (!isNaN(endAt.getTime()) && now >= endAt) {
        toast.error('This auction has already ended');
        return;
      }
    }

    const highestInfo = highestBids[listing.id];
    const currentHighest = highestInfo ? highestInfo.amount : listing.price;
    if (amount <= currentHighest) {
      toast.error(`Bid must be higher than ${currentHighest.toLocaleString()} TrollCoins`);
      return;
    }

    setPlacingBidFor(listing.id);
    try {
      const { data, error } = await supabase.rpc('place_vehicle_bid', {
        p_listing_id: listing.id,
        p_bid_amount: amount
      });

      if (error) {
        console.error('Failed to place bid', error);
        toast.error(error.message || 'Failed to place bid');
        return;
      }

      if (!data || data.success !== true) {
        const message = data?.message || 'Failed to place bid';
        toast.error(message);
        return;
      }

      toast.success('Bid placed successfully');
      await loadAuctions();
    } catch (err: any) {
      console.error('Error placing bid', err);
      toast.error(err?.message || 'Failed to place bid');
    } finally {
      setPlacingBidFor((current) => (current === listing.id ? null : current));
    }
  };

  if (!user) return null;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

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

  const handleClaimAuction = async (listing: VehicleListing, finalPrice: number) => {
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    const highestInfo = highestBids[listing.id];
    if (!highestInfo || highestInfo.bidderId !== user.id) {
      toast.error('You are not the highest bidder for this auction');
      return;
    }
    const endAtIso = listing.metadata?.end_at as string | undefined;
    if (endAtIso) {
      const endAt = new Date(endAtIso);
      if (!isNaN(endAt.getTime()) && new Date() < endAt) {
        toast.error('This auction has not ended yet');
        return;
      }
    }

    setClaimingId(listing.id);
    try {
      const deductResult = await deductCoins({
        userId: user.id,
        amount: finalPrice,
        type: 'troll_town_purchase',
        coinType: 'troll_coins',
        description: 'Vehicle auction purchase',
        metadata: {
          source: 'vehicle_auction',
          listing_id: listing.id,
          vehicle_id: listing.vehicle_id,
          seller_id: listing.seller_id
        }
      });

      if (!deductResult.success) {
        const message = deductResult.error || 'Failed to process payment';
        toast.error(message);
        return;
      }

      const addResult = await addCoins({
        userId: listing.seller_id,
        amount: finalPrice,
        type: 'troll_town_sale',
        coinType: 'troll_coins',
        description: 'Vehicle auction sale',
        metadata: {
          source: 'vehicle_auction',
          listing_id: listing.id,
          vehicle_id: listing.vehicle_id,
          buyer_id: user.id
        }
      });

      if (!addResult.success) {
        console.error('Failed to credit seller for auction sale', addResult.error);
      } else {
        await recordCoinTransaction({
          userId: listing.seller_id,
          amount: finalPrice,
          type: 'troll_town_sale',
          coinType: 'troll_coins',
          description: 'Vehicle auction sale',
          metadata: {
            listing_id: listing.id,
            vehicle_id: listing.vehicle_id,
            buyer_id: user.id
          }
        });
      }

      const mergedMetadata = {
        ...(listing.metadata || {}),
        winner_id: user.id,
        final_price: finalPrice,
        finalized_at: new Date().toISOString()
      };

      await supabase
        .from('vehicle_listings')
        .update({
          status: 'sold',
          metadata: mergedMetadata
        })
        .eq('id', listing.id);

      try {
        const ownedKey = `trollcity_owned_vehicles_${user.id}`;
        let ownedList: number[] = [];
        try {
          const raw = localStorage.getItem(ownedKey);
          ownedList = raw ? JSON.parse(raw) : [];
        } catch {
          ownedList = [];
        }
        if (!ownedList.includes(listing.vehicle_id)) {
          ownedList.push(listing.vehicle_id);
        }
        localStorage.setItem(ownedKey, JSON.stringify(ownedList));

        const { data, error: ownershipError } = await supabase.rpc(
          'add_owned_vehicle_to_profile',
          { p_vehicle_id: listing.vehicle_id }
        );

        if (ownershipError) {
          console.error('Failed to update buyer vehicle ownership via RPC', ownershipError);
          toast.error(ownershipError.message || 'Failed to update vehicle ownership');
        } else if (data && (data as any).owned_vehicle_ids) {
          console.log('Updated owned_vehicle_ids after auction:', (data as any).owned_vehicle_ids);
        }
      } catch (e: any) {
        console.error('Failed to update buyer vehicle ownership', e);
        toast.error(e?.message || 'Failed to update vehicle ownership');
      }

      if (refreshProfile) {
        await refreshProfile();
      }

      toast.success('Auction won. Vehicle added to your garage.');
      await loadAuctions();
    } catch (err: any) {
      console.error('Failed to claim auction', err);
      toast.error(err?.message || 'Failed to claim auction');
    } finally {
      setClaimingId((current) => (current === listing.id ? null : current));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 text-white p-6 pt-24 pb-20">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-700/20 border border-purple-500/40">
              <Gavel className="w-7 h-7 text-purple-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-400 bg-clip-text text-transparent">
                Vehicle Auctions
              </h1>
              <p className="text-sm text-zinc-400">
                Live auctions created by trolls across the city.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadAuctions}
            className="self-start md:self-auto px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/15"
          >
            Refresh
          </button>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="border border-dashed border-zinc-700 rounded-xl p-8 text-center space-y-3 bg-black/40">
            <Gavel className="w-10 h-10 mx-auto text-zinc-500" />
            <h2 className="text-xl font-semibold">No active auctions</h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              When trolls start auctions from their vehicle titles, they will appear here for everyone to view and bid.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {listings.map((listing) => {
              const vehicle = cars.find((c) => c.id === listing.vehicle_id);
              const vehicleName =
                listing.metadata?.vehicle_name || vehicle?.name || `Vehicle #${listing.vehicle_id}`;
              const tier = listing.metadata?.tier || (vehicle as any)?.tier;
              const highestInfo = highestBids[listing.id];
              const highest = highestInfo?.amount;
              const currentPrice = highest && highest > listing.price ? highest : listing.price;
              const endAtIso = listing.metadata?.end_at as string | undefined;
              const countdown = formatCountdown(endAtIso);
              const hasEnded = countdown === 'Ended';
              const isWinner =
                !!highestInfo && !!user && highestInfo.bidderId === user.id && hasEnded;

              return (
                <div
                  key={listing.id}
                  className="bg-zinc-900 border border-purple-500/30 rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Car className="w-5 h-5 text-purple-300" />
                      <div>
                        <p className="font-semibold text-white text-sm">{vehicleName}</p>
                        <p className="text-[11px] text-zinc-400">
                          ID #{listing.vehicle_id}
                          {tier ? ` • ${tier}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-purple-400">
                        {hasEnded ? 'Auction Ended' : 'Active Auction'}
                      </p>
                      <p className="text-[11px] text-zinc-500 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {endAtIso && countdown
                          ? countdown
                          : formatDate(listing.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-zinc-400">
                          {highest ? 'Current highest bid' : 'Starting price'}
                        </p>
                        <p className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                          <Coins className="w-4 h-4" />
                          {currentPrice.toLocaleString()} TrollCoins
                        </p>
                      </div>
                      {highest && (
                        <div className="text-right">
                          <p className="text-[11px] text-zinc-400">Min next bid</p>
                          <p className="text-[12px] text-purple-300 font-semibold">
                            {(currentPrice + 100).toLocaleString()}+
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {hasEnded ? (
                        <button
                          type="button"
                          onClick={() => handleClaimAuction(listing, currentPrice)}
                          disabled={!isWinner || claimingId === listing.id}
                          className="w-full mt-1 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isWinner
                            ? claimingId === listing.id
                              ? 'Claiming...'
                              : 'Claim Vehicle'
                            : 'Auction Ended'}
                        </button>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="Your bid (TrollCoins)"
                              value={bidInputs[listing.id] || ''}
                              onChange={(e) => handleBidInputChange(listing.id, e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePlaceBid(listing)}
                            disabled={placingBidFor === listing.id}
                            className="w-full mt-1 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {placingBidFor === listing.id ? 'Placing bid...' : 'Place Bid'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

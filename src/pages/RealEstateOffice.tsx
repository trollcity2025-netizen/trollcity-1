import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { DollarSign, Check } from 'lucide-react';
import { toast } from 'sonner';
import { trollCityTheme } from '../styles/trollCityTheme';

interface HouseCatalogItem {
  id: string;
  name: string;
  tier: number;
  base_price: number;
  rent_slots: number;
  power_band: string;
  daily_tax_rate_bps: number;
  maintenance_rate_bps: number;
  influence_points: number;
  feature_flags: Record<string, any>;
}

export default function RealEstateOffice() {
  const { user, profile, refreshProfile } = useAuthStore();
  const [houses, setHouses] = useState<HouseCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      const { data, error } = await supabase
        .from('houses_catalog')
        .select('*')
        .order('base_price', { ascending: true });
      
      if (error) throw error;
      setHouses(data || []);
    } catch (error) {
      console.error('Error fetching houses:', error);
      toast.error('Failed to load real estate listings');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (house: HouseCatalogItem) => {
    if (!user || !profile) return;
    
    if (profile.troll_coins < house.base_price) {
      toast.error('Insufficient funds');
      return;
    }

    setPurchasing(house.id);
    try {
      const { data, error } = await supabase.rpc('purchase_house', {
        p_house_catalog_id: house.id
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Purchased ${house.name}!`);
        refreshProfile(); // Update balance
      } else {
        toast.error(data.error || 'Purchase failed');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Transaction failed');
    } finally {
      setPurchasing(null);
    }
  };

  const getTierColor = (tier: number) => {
    switch (tier) {
      case 1: return `${trollCityTheme.text.muted} ${trollCityTheme.borders.glass} ${trollCityTheme.backgrounds.card}`;
      case 2: return 'text-emerald-400 border-emerald-500/30 bg-emerald-900/20';
      case 3: return 'text-cyan-400 border-cyan-500/30 bg-cyan-900/20';
      case 4: return 'text-purple-400 border-purple-500/30 bg-purple-900/20';
      case 5: return 'text-yellow-400 border-yellow-500/30 bg-yellow-900/20';
      default: return `${trollCityTheme.text.muted} ${trollCityTheme.borders.glass}`;
    }
  };

  if (loading) return <div className={`p-8 text-center ${trollCityTheme.text.muted}`}>Loading listings...</div>;

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} pt-20 pb-12 px-4 md:px-8`}>
      <div className={`container mx-auto max-w-7xl space-y-8 ${trollCityTheme.text.primary}`}>
        <div className="flex flex-col gap-2">
        <h1 className={`text-3xl font-bold ${trollCityTheme.gradients.text}`}>
          Real Estate Office
        </h1>
        <p className={trollCityTheme.text.muted}>
          Invest in property to unlock power bands, influence, and rental income.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {houses.map(house => (
          <Card key={house.id} className={`${trollCityTheme.components.card} flex flex-col !p-0`}>
            <div className={`h-2 w-full ${house.tier >= 5 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' : 
              house.tier >= 4 ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 
              house.tier >= 3 ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 
              trollCityTheme.backgrounds.glass}`} />
            
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className={`${getTierColor(house.tier)}`}>
                  Tier {house.tier}
                </Badge>
                <Badge variant="secondary" className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.text.muted} border ${trollCityTheme.borders.glass}`}>
                  {house.power_band}
                </Badge>
              </div>
              <CardTitle className="text-2xl">{house.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 text-emerald-400 font-mono text-lg">
                <DollarSign className="w-4 h-4" />
                {house.base_price.toLocaleString()}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className={`${trollCityTheme.backgrounds.card} p-3 rounded border ${trollCityTheme.borders.glass}`}>
                  <div className={`${trollCityTheme.text.muted} text-xs mb-1`}>Daily Upkeep</div>
                  <div className="font-mono text-red-400">
                    {((house.base_price * (house.daily_tax_rate_bps + house.maintenance_rate_bps)) / 10000).toLocaleString()} coins
                  </div>
                </div>
                <div className={`${trollCityTheme.backgrounds.card} p-3 rounded border ${trollCityTheme.borders.glass}`}>
                  <div className={`${trollCityTheme.text.muted} text-xs mb-1`}>Influence</div>
                  <div className="font-mono text-purple-400">
                    +{house.influence_points} pts
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className={`text-xs font-medium ${trollCityTheme.text.muted} uppercase tracking-wider`}>Features</div>
                <ul className="space-y-1">
                  <li className={`flex items-center text-sm ${trollCityTheme.text.secondary}`}>
                    <Check className="w-4 h-4 mr-2 text-emerald-500" />
                    {house.rent_slots} Rental Slot{house.rent_slots !== 1 && 's'}
                  </li>
                  {Object.entries(house.feature_flags || {}).map(([key]) => (
                    <li key={key} className={`flex items-center text-sm ${trollCityTheme.text.secondary}`}>
                      <Check className="w-4 h-4 mr-2 text-emerald-500" />
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>

            <CardFooter className={`pt-4 border-t ${trollCityTheme.borders.glass}`}>
              <Button 
                className={`w-full ${trollCityTheme.gradients.button} text-white`}
                onClick={() => handlePurchase(house)}
                disabled={purchasing === house.id || (profile?.troll_coins || 0) < house.base_price}
              >
                {purchasing === house.id ? 'Processing...' : 'Purchase Property'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
    </div>
  );
}

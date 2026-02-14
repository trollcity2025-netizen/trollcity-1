import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { AlertTriangle, Home, Car, DollarSign, Activity, ShieldAlert, Building, Gavel, Key } from 'lucide-react';
import { toast } from 'sonner';
import HouseUpgrades from '../components/assets/HouseUpgrades';
import { trollCityTheme } from '../styles/trollCityTheme';

interface House {
  id: string;
  name: string;
  tier: number;
  base_price: number;
  condition: number;
  status: 'active' | 'delinquent' | 'foreclosed' | 'auctioned';
  daily_tax_rate_bps: number;
  maintenance_rate_bps: number;
  next_due_at: string;
  influence_active: boolean;
  power_band: string;
  rent_slots: number;
}

interface CarAsset {
  id: string;
  name: string;
  tier: string;
  base_price: number;
  condition: number;
  status: string;
  insurance_rate_bps: number;
  plate_number: string;
  plate_status: string;
  image_url: string;
  exposure_level: number;
}

export default function ActiveAssetsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [houses, setHouses] = useState<House[]>([]);
  const [cars, setCars] = useState<CarAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch Houses
      const { data: housesData, error: housesError } = await supabase
        .from('user_houses')
        .select(`
          id, condition, status, next_due_at, influence_active,
          houses_catalog (
            name, tier, base_price, daily_tax_rate_bps, maintenance_rate_bps, power_band, rent_slots
          )
        `)
        .eq('user_id', user.id);

      if (housesError) throw housesError;

      const formattedHouses = housesData.map((h: any) => ({
        id: h.id,
        name: h.houses_catalog.name,
        tier: h.houses_catalog.tier,
        base_price: h.houses_catalog.base_price,
        daily_tax_rate_bps: h.houses_catalog.daily_tax_rate_bps,
        maintenance_rate_bps: h.houses_catalog.maintenance_rate_bps,
        power_band: h.houses_catalog.power_band,
        rent_slots: h.houses_catalog.rent_slots,
        condition: h.condition,
        status: h.status,
        next_due_at: h.next_due_at,
        influence_active: h.influence_active,
      }));
      setHouses(formattedHouses);

      // Fetch Cars (TMV System)
      const { data: carsData, error: carsError } = await supabase
        .from('user_vehicles')
        .select(`
          id, condition, purchased_at,
          vehicles_catalog (
            name, tier, price, image, speed, armor
          ),
          vehicle_registrations (
             plate_number, status
          ),
          vehicle_insurance_policies (
             status, premium_amount
          )
        `)
        .eq('user_id', user.id);

      if (carsError) throw carsError;

      const formattedCars = carsData.map((c: any) => {
        // Handle array responses for joined tables
        const registration = Array.isArray(c.vehicle_registrations) ? c.vehicle_registrations[0] : c.vehicle_registrations;
        const insurance = Array.isArray(c.vehicle_insurance_policies) ? c.vehicle_insurance_policies[0] : c.vehicle_insurance_policies;
        
        // Estimate insurance rate bps if not available (default 0.1% = 10bps for simplicity, or 50bps)
        // Premium amount is usually ~2000 flat in new schema, but let's try to derive a bps if we want to show daily cost
        const price = c.vehicles_catalog.price || 10000;
        const _premium = insurance?.premium_amount || 2000;
        // Mock bps for display purposes
        const insurance_rate_bps = 50; 

        return {
          id: c.id,
          name: c.vehicles_catalog.name,
          tier: c.vehicles_catalog.tier,
          base_price: price,
          insurance_rate_bps: insurance_rate_bps,
          image_url: c.vehicles_catalog.image,
          exposure_level: 0, // Not used in TMV
          condition: c.condition,
          status: insurance?.status === 'active' ? 'insured' : (registration?.status === 'active' ? 'active' : 'unregistered'),
          plate_number: registration?.plate_number || 'NO PLATE',
          plate_status: registration?.status || 'none',
        };
      });
      setCars(formattedCars);

    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const calculateDailyCost = (price: number, bps: number) => {
    return Math.floor((price * bps) / 10000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'insured': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'delinquent': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'uninsured': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'foreclosed': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'impounded': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'auctioned': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default: return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  if (loading) return <div className="p-8 text-center">Loading assets...</div>;

  return (
    <div className={`container mx-auto p-4 md:p-8 space-y-8 max-w-7xl min-h-screen ${trollCityTheme.text.primary}`}>
      <div className="flex flex-col gap-2">
        <h1 className={`text-3xl font-bold ${trollCityTheme.text.gradient}`}>
          Active Asset Economy
        </h1>
        <p className={trollCityTheme.text.secondary}>
          Manage your high-value assets. Keep them maintained to avoid penalties and foreclosure.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button 
          variant="outline" 
          className={`h-24 flex flex-col items-center justify-center gap-2 ${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} hover:border-emerald-500/50 transition-all text-white hover:text-emerald-400`}
          onClick={() => navigate('/real-estate')}
        >
          <Building className="w-8 h-8 mb-1" />
          Real Estate Office
        </Button>
        <Button 
          variant="outline" 
          className={`h-24 flex flex-col items-center justify-center gap-2 ${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} hover:border-cyan-500/50 transition-all text-white hover:text-cyan-400`}
          onClick={() => navigate('/car-dealership')}
        >
          <Car className="w-8 h-8 mb-1" />
          Car Dealership
        </Button>
        <Button 
          variant="outline" 
          className={`h-24 flex flex-col items-center justify-center gap-2 ${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} hover:border-purple-500/50 transition-all text-white hover:text-purple-400`}
          onClick={() => navigate('/rental-market')}
        >
          <Key className="w-8 h-8 mb-1" />
          Rental Market
        </Button>
        <Button 
          variant="outline" 
          className={`h-24 flex flex-col items-center justify-center gap-2 ${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} hover:border-orange-500/50 transition-all text-white hover:text-orange-400`}
          onClick={() => navigate('/auctions')}
        >
          <Gavel className="w-8 h-8 mb-1" />
          Auctions
        </Button>
      </div>

      <Tabs defaultValue="houses" className="w-full">
        <TabsList className={`${trollCityTheme.backgrounds.glass} ${trollCityTheme.borders.glass} p-1 border`}>
          <TabsTrigger value="houses" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-slate-400">
            <Home className="w-4 h-4 mr-2" /> Houses ({houses.length})
          </TabsTrigger>
          <TabsTrigger value="cars" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-slate-400">
            <Car className="w-4 h-4 mr-2" /> Cars ({cars.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="houses" className="mt-6 space-y-4">
          {houses.length === 0 ? (
            <div className={`text-center py-12 ${trollCityTheme.backgrounds.glass} rounded-xl border border-dashed border-zinc-700`}>
              <Home className={`w-12 h-12 mx-auto ${trollCityTheme.text.muted} mb-3`} />
              <h3 className={`text-lg font-medium ${trollCityTheme.text.secondary}`}>No Houses Owned</h3>
              <p className={trollCityTheme.text.muted}>Purchase a property to start building your empire.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {houses.map(house => (
                <Card key={house.id} className={`${trollCityTheme.components.card} !p-0 overflow-hidden`}>
                  <div className="h-2 bg-gradient-to-r from-emerald-500 to-cyan-500" />
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="outline" className={`mb-2 ${trollCityTheme.backgrounds.glass} ${trollCityTheme.borders.glass} ${trollCityTheme.text.muted}`}>
                          Tier {house.tier} {house.power_band}
                        </Badge>
                        <CardTitle className="text-xl text-white">{house.name}</CardTitle>
                      </div>
                      <Badge className={getStatusColor(house.status)} variant="outline">
                        {house.status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className={trollCityTheme.text.muted}>Condition</span>
                        <span className={house.condition < 50 ? 'text-red-400' : 'text-emerald-400'}>
                          {house.condition}%
                        </span>
                      </div>
                      <Progress value={house.condition} className="h-2 bg-slate-800" indicatorClassName={house.condition < 30 ? 'bg-red-500' : 'bg-emerald-500'} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className={`${trollCityTheme.backgrounds.glass} p-2 rounded border ${trollCityTheme.borders.glass}`}>
                        <div className={`${trollCityTheme.text.muted} text-xs mb-1`}>Daily Tax</div>
                        <div className="font-mono text-red-400 flex items-center">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {calculateDailyCost(house.base_price, house.daily_tax_rate_bps)}
                        </div>
                      </div>
                      <div className={`${trollCityTheme.backgrounds.glass} p-2 rounded border ${trollCityTheme.borders.glass}`}>
                        <div className={`${trollCityTheme.text.muted} text-xs mb-1`}>Daily Maint</div>
                        <div className="font-mono text-red-400 flex items-center">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {calculateDailyCost(house.base_price, house.maintenance_rate_bps)}
                        </div>
                      </div>
                    </div>

                    <div className={`flex items-center gap-2 text-xs ${trollCityTheme.text.muted}`}>
                      <Activity className="w-3 h-3" />
                      <span>Influence: {house.influence_active ? 'Active' : 'Inactive (Delinquent)'}</span>
                    </div>

                    {house.status === 'delinquent' && (
                      <div className="bg-red-900/20 border border-red-900/50 p-3 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                        <div className="text-sm">
                          <p className="text-red-200 font-medium">Risk of Foreclosure</p>
                          <p className="text-red-300/70 text-xs mt-1">
                            Pay outstanding dues immediately to restore influence and prevent auction.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className={`pt-2 border-t ${trollCityTheme.borders.glass}`}>
                      <HouseUpgrades userHouseId={house.id} houseStatus={house.status} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cars" className="mt-6 space-y-4">
           {cars.length === 0 ? (
            <div className={`text-center py-12 ${trollCityTheme.backgrounds.glass} rounded-xl border border-dashed border-zinc-700`}>
              <Car className={`w-12 h-12 mx-auto ${trollCityTheme.text.muted} mb-3`} />
              <h3 className={`text-lg font-medium ${trollCityTheme.text.secondary}`}>No Active Cars</h3>
              <p className={trollCityTheme.text.muted}>Visit the dealership to buy a vehicle.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cars.map(car => (
                <Card key={car.id} className={`${trollCityTheme.components.card} !p-0 overflow-hidden`}>
                  <div className="h-2 bg-gradient-to-r from-cyan-500 to-blue-500" />
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        {car.image_url && (
                          <img src={car.image_url} alt={car.name} className="w-12 h-12 object-contain rounded bg-black/50" />
                        )}
                        <div>
                          <Badge variant="outline" className={`mb-1 ${trollCityTheme.backgrounds.glass} ${trollCityTheme.borders.glass} ${trollCityTheme.text.muted}`}>
                            Tier {car.tier}
                          </Badge>
                          <CardTitle className="text-lg text-white">{car.name}</CardTitle>
                        </div>
                      </div>
                      <Badge className={getStatusColor(car.status)} variant="outline">
                        {car.status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className={trollCityTheme.text.muted}>Condition</span>
                        <span className={car.condition < 50 ? 'text-red-400' : 'text-emerald-400'}>
                          {car.condition}%
                        </span>
                      </div>
                      <Progress value={car.condition} className="h-2 bg-slate-800" indicatorClassName={car.condition < 30 ? 'bg-red-500' : 'bg-cyan-500'} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className={`${trollCityTheme.backgrounds.glass} p-2 rounded border ${trollCityTheme.borders.glass}`}>
                        <div className={`${trollCityTheme.text.muted} text-xs mb-1`}>Daily Insurance</div>
                        <div className="font-mono text-red-400 flex items-center">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {calculateDailyCost(car.base_price, car.insurance_rate_bps)}
                        </div>
                      </div>
                      <div className={`${trollCityTheme.backgrounds.glass} p-2 rounded border ${trollCityTheme.borders.glass}`}>
                        <div className={`${trollCityTheme.text.muted} text-xs mb-1`}>Exposure Level</div>
                        <div className="font-mono text-blue-400 flex items-center">
                          <ShieldAlert className="w-3 h-3 mr-1" />
                          {car.exposure_level}/4
                        </div>
                      </div>
                    </div>

                    {car.plate_number && (
                      <div className={`flex justify-between items-center text-xs ${trollCityTheme.backgrounds.glass} p-2 rounded border ${trollCityTheme.borders.glass}`}>
                        <span className={`${trollCityTheme.text.muted} uppercase tracking-wider`}>Plate</span>
                        <span className="font-mono text-yellow-500 font-bold">{car.plate_number}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

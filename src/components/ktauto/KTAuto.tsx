import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { Info, Car as CarIcon, DollarSign, AlertTriangle } from 'lucide-react';
import { formatCompactNumber } from '../../lib/utils';
import { useCoins } from '../../lib/hooks/useCoins';

interface CarCatalogItem {
  id: number;
  name: string;
  tier: number;
  base_price: number;
  image_url: string;
  insurance_rate_bps: number;
  exposure_level: number;
  registration_fee: number;
}

const TIER_MAP: Record<number, string> = {
  1: 'Starter',
  2: 'Mid',
  3: 'Luxury',
  4: 'Super',
  5: 'Elite'
};

export default function KTAuto() {
  const { user } = useAuthStore();
  const { troll_coins: balance, refreshCoins } = useCoins();
  const [cars, setCars] = useState<CarCatalogItem[]>([]);
  const [selectedCar, setSelectedCar] = useState<CarCatalogItem | null>(null);
  const [plateType, setPlateType] = useState<'temp' | 'hard'>('temp');
  const [purchasing, setPurchasing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  
  // License Check
  const [licenseStatus, setLicenseStatus] = useState<string>('valid');

  // Costs
  const TEMP_PLATE_FEE = 200;
  const HARD_PLATE_FEE = 2000;

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Cars Catalog from the dealership view
        const { data: carsData, error: carsError } = await supabase
          .from('v_dealership_catalog')
          .select('*')
          .order('base_price', { ascending: true });

        if (carsError) throw carsError;
        setCars(carsData || []);

        // Check License
        const { data: licenseData } = await supabase
          .from('user_driver_licenses')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle(); // Use maybeSingle to avoid error if not found
          
        if (licenseData) setLicenseStatus(licenseData.status);
      } catch (err) {
        console.error('Error fetching data:', err);
        toast.error('Failed to load dealership data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);

  const filteredCars = useMemo(() => {
    if (filter === 'all') return cars;
    return cars.filter(c => TIER_MAP[c.tier]?.toLowerCase() === filter.toLowerCase());
  }, [filter, cars]);

  const categories = ['all', 'Starter', 'Mid', 'Luxury', 'Super', 'Elite'];

  const handlePurchase = async () => {
    if (!user || !selectedCar) return;
    
    if (licenseStatus === 'suspended' || licenseStatus === 'revoked') {
      toast.error(`Cannot purchase vehicle: License is ${licenseStatus}`);
      return;
    }

    if (!licenseStatus || licenseStatus === 'none') {
      toast.error("You need a valid driver's license to purchase a vehicle. Please visit the DMV.");
      return;
    }

    const regFee = selectedCar.registration_fee + (plateType === 'hard' ? 2000 : 200);
    const totalCost = selectedCar.base_price + regFee;

    if ((balance || 0) < totalCost) {
      toast.error(`Insufficient funds. You need ${formatCompactNumber(totalCost)} coins.`);
      return;
    }

    setPurchasing(true);
    try {
      // Use purchase_car (UUID support) instead of purchase_vehicle
      const { data, error } = await supabase.rpc('purchase_car', {
        p_car_catalog_id: selectedCar.id
      });

      if (error) throw error;

      if (data && !data.success) {
        toast.error(data.error || data.message || 'Purchase failed');
        return;
      }

      toast.success(`Successfully purchased ${selectedCar.name}!`);
      setSelectedCar(null);
      refreshCoins();
    } catch (err: any) {
      console.error('Purchase failed:', err);
      toast.error(err.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const calculateTotal = () => {
    if (!selectedCar) return 0;
    const regFee = selectedCar.registration_fee + (plateType === 'hard' ? 2000 : 200);
    return selectedCar.base_price + regFee;
  };

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading dealership...</div>;

  return (
    <div className="space-y-6">
      {/* Header / Intro */}
      <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <CarIcon className="text-blue-400" /> KTAuto Dealership
            </h2>
            <p className="text-blue-200/70 text-sm mt-1">
              The premier destination for Troll City vehicles. All sales final. Coins only.
            </p>
          </div>
          <div className="flex gap-2">
            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2 justify-end">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === cat 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-black/30 text-blue-300 hover:bg-blue-500/20'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCars.map(car => (
          <div 
            key={car.id}
            className="group bg-black/40 border border-white/10 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-900/20 flex flex-col"
          >
            {/* Image Area */}
            <div className="relative aspect-[16/9] bg-gradient-to-b from-gray-800 to-black p-4 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {car.image_url ? (
                <img 
                  src={car.image_url} 
                  alt={car.name}
                  className="w-full h-full object-contain drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500"
                />
              ) : (
                <CarIcon className="w-12 h-12 text-zinc-700" />
              )}
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-blue-300 border border-white/10">
                {TIER_MAP[car.tier] || 'Unknown'}
              </div>
            </div>

            {/* Info Area */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">{car.name}</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Ins: {car.insurance_rate_bps / 100}%
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                    Exp: {car.exposure_level}/4
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <div className="text-yellow-400 font-mono font-bold text-lg">
                  {formatCompactNumber(car.base_price)} <span className="text-xs text-yellow-600">TC</span>
                </div>
                <button
                  onClick={() => setSelectedCar(car)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  View Deal
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase Modal */}
      {selectedCar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row">
            
            {/* Left: Car Preview */}
            <div className="w-full md:w-2/5 bg-gradient-to-br from-gray-800 to-black p-6 flex flex-col items-center justify-center relative">
               {selectedCar.image_url && (
                 <img 
                   src={selectedCar.image_url} 
                   alt={selectedCar.name} 
                   className="w-full object-contain drop-shadow-xl"
                 />
               )}
               <div className="mt-4 text-center">
                 <h3 className="text-xl font-bold text-white">{selectedCar.name}</h3>
                 <p className="text-sm text-gray-400">{TIER_MAP[selectedCar.tier]} Class</p>
               </div>
            </div>

            {/* Right: Details & Purchase */}
            <div className="w-full md:w-3/5 p-6 flex flex-col">
              <div className="flex-1 space-y-6">
                
                {/* License Warning */}
                {(!licenseStatus || licenseStatus === 'none' || licenseStatus === 'suspended' || licenseStatus === 'revoked') && (
                   <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-red-200">
                          {(!licenseStatus || licenseStatus === 'none') ? 'No License' : `License ${licenseStatus}`}
                        </h4>
                        <p className="text-xs text-red-200/70">
                          {(!licenseStatus || licenseStatus === 'none') 
                            ? 'You must pass the drivers test at the DMV before purchasing a vehicle.' 
                            : 'You cannot purchase vehicles until your license is restored.'}
                        </p>
                      </div>
                   </div>
                )}

                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Purchase Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Vehicle Base Price</span>
                      <span className="font-mono text-yellow-400">{selectedCar.base_price.toLocaleString()} TC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Registration Fee</span>
                      <span className="font-mono text-yellow-400">{selectedCar.registration_fee.toLocaleString()} TC</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Plate Fee</span>
                      <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                        <button
                          onClick={() => setPlateType('temp')}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            plateType === 'temp' ? 'bg-zinc-700 text-white' : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Temp ({TEMP_PLATE_FEE})
                        </button>
                        <button
                          onClick={() => setPlateType('hard')}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            plateType === 'hard' ? 'bg-zinc-700 text-white' : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Hard ({HARD_PLATE_FEE})
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg text-xs text-blue-200 space-y-1">
                  <p className="flex items-center gap-2 font-bold"><Info size={14}/> Important Info</p>
                  <ul className="list-disc pl-4 space-y-1 opacity-80">
                    <li>Sales are final. No refunds.</li>
                    <li>Daily upkeep required (Insurance: {selectedCar.insurance_rate_bps/100}%).</li>
                    <li>Vehicles can be impounded if fees are unpaid.</li>
                  </ul>
                </div>

                <div className="flex justify-between items-end pt-4 border-t border-white/10">
                   <div className="text-sm text-gray-400">Total Due Now</div>
                   <div className="text-2xl font-bold text-yellow-400 font-mono">
                     {calculateTotal().toLocaleString()} TC
                   </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { setSelectedCar(null); }}
                  disabled={purchasing}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={purchasing || (licenseStatus === 'suspended' || licenseStatus === 'revoked')}
                  className="flex-[2] px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/30 disabled:opacity-50 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  {purchasing ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <DollarSign size={18} /> Confirm Purchase
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

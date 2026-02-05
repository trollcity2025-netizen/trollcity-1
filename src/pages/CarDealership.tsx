import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Car, AlertTriangle, ArrowLeft, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CarCatalogItem {
  id: string;
  name: string;
  tier: number;
  base_price: number;
  exposure_level: number;
  insurance_rate_bps: number;
  registration_fee: number;
  image_url?: string;
  feature_flags: any;
}

export default function CarDealership() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CarCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { user, refreshProfile } = useAuthStore();

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    const { data, error } = await supabase
      .from('cars_catalog')
      .select('*')
      .order('base_price', { ascending: true });
    
    if (error) {
      console.error('Error fetching cars:', error);
      toast.error('Failed to load showroom');
    } else {
      setCatalog(data || []);
    }
    setLoading(false);
  };

  const handlePurchase = async (car: CarCatalogItem) => {
    if (!user) return;
    if (!confirm(`Are you sure you want to purchase the ${car.name} for ${car.base_price.toLocaleString()} coins?`)) return;

    setPurchasing(car.id);
    try {
      const { data, error } = await supabase.rpc('purchase_car', {
        p_car_catalog_id: car.id
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Congratulations! You purchased a ${car.name}.`);
        await refreshProfile();
        navigate('/active-assets'); // Redirect to garage
      } else {
        toast.error(data.error || 'Purchase failed');
      }
    } catch (err: any) {
      console.error('Purchase error:', err);
      toast.error(err.message || 'Failed to process purchase');
    } finally {
      setPurchasing(null);
    }
  };

  const getExposureLabel = (level: number) => {
    switch (level) {
      case 0: return { text: 'Stealth', color: 'text-gray-400' };
      case 1: return { text: 'Low Profile', color: 'text-blue-400' };
      case 2: return { text: 'Noticeable', color: 'text-yellow-400' };
      case 3: return { text: 'High Heat', color: 'text-orange-500' };
      case 4: return { text: 'Most Wanted', color: 'text-red-500' };
      default: return { text: 'Unknown', color: 'text-gray-400' };
    }
  };

  if (loading) return <div className={`p-8 text-center ${trollCityTheme.text.muted}`}>Loading showroom...</div>;

  return (
    <div className={`min-h-screen p-6 pb-24 ${trollCityTheme.backgrounds.primary} ${trollCityTheme.text.primary}`}>
      {/* Background Overlays */}
      <div className={`fixed inset-0 pointer-events-none ${trollCityTheme.overlays.radialPurple}`} />
      <div className={`fixed inset-0 pointer-events-none ${trollCityTheme.overlays.radialPink}`} />
      
      <div className="relative max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/active-assets')} className={`p-2 rounded-full transition ${trollCityTheme.interactive.hover} hover:bg-white/10`}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className={`text-3xl font-bold ${trollCityTheme.gradients.text}`}>
              Exotic Imports Dealership
            </h1>
            <p className={trollCityTheme.text.secondary}>High-performance machines for the discerning Troller.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalog.map((car) => {
            const exposure = getExposureLabel(car.exposure_level);
            return (
              <div key={car.id} className={`${trollCityTheme.components.card} group !p-0 overflow-hidden`}>
                {/* Image Placeholder */}
                <div className={`h-48 ${trollCityTheme.backgrounds.card} flex items-center justify-center relative border-b ${trollCityTheme.borders.glass}`}>
                   {car.image_url ? (
                     <img src={car.image_url} alt={car.name} className="w-full h-full object-cover" />
                   ) : (
                     <Car className={`w-16 h-16 ${trollCityTheme.text.muted} group-hover:text-purple-500 transition`} />
                   )}
                   <div className={`absolute top-2 right-2 ${trollCityTheme.backgrounds.card} px-2 py-1 rounded text-xs border ${trollCityTheme.borders.glass} backdrop-blur-sm`}>
                     Tier {car.tier}
                   </div>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <h3 className={`text-xl font-bold ${trollCityTheme.text.primary}`}>{car.name}</h3>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <span className={`${exposure.color} font-medium flex items-center gap-1`}>
                         <AlertTriangle className="w-3 h-3" /> {exposure.text}
                      </span>
                    </div>
                  </div>

                  <div className={`space-y-2 text-sm ${trollCityTheme.text.muted} bg-black/20 p-3 rounded-lg border ${trollCityTheme.borders.glass}`}>
                    <div className="flex justify-between">
                      <span>Base Price</span>
                      <span className="text-white font-mono">{car.base_price.toLocaleString()} 🪙</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Insurance (Daily)</span>
                      <span className="text-white">{(car.base_price * car.insurance_rate_bps / 10000).toFixed(0)} 🪙</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Registration</span>
                      <span className="text-white">{car.registration_fee.toLocaleString()} 🪙</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePurchase(car)}
                    disabled={purchasing === car.id}
                    className={`w-full py-3 ${trollCityTheme.gradients.button} rounded-lg font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5`}
                  >
                    {purchasing === car.id ? (
                      <span className="animate-pulse">Processing...</span>
                    ) : (
                      <>
                        <DollarSign className="w-4 h-4" />
                        Purchase
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

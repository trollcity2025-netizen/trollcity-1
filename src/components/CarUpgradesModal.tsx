import React, { useEffect, useState } from 'react';
import { X, Wrench, ArrowUp, Coins, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface CarUpgradesModalProps {
  userCarId: string;
  onClose: () => void;
  onUpdate: () => void;
}

interface Upgrade {
  id: string;
  name: string;
  type: string; // 'engine', 'transmission', 'tires', 'body', 'nitro'
  cost: number;
  value_increase_amount: number;
  description: string;
  tier: number;
}

interface UserUpgrade {
  id: string;
  upgrade_id: string;
  upgrade: Upgrade;
}

export default function CarUpgradesModal({ userCarId, onClose, onUpdate }: CarUpgradesModalProps) {
  const [availableUpgrades, setAvailableUpgrades] = useState<Upgrade[]>([]);
  const [installedUpgrades, setInstalledUpgrades] = useState<UserUpgrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [userCarId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch all available upgrades
      const { data: upgradesData, error: upgradesError } = await supabase
        .from('car_upgrades')
        .select('*')
        .order('cost', { ascending: true });

      if (upgradesError) throw upgradesError;

      // Fetch installed upgrades for this car
      const { data: installedData, error: installedError } = await supabase
        .from('user_car_upgrades')
        .select('*, upgrade:car_upgrades(*)')
        .eq('user_car_id', userCarId);

      if (installedError) throw installedError;

      setAvailableUpgrades(upgradesData || []);
      setInstalledUpgrades(installedData || []);
    } catch (error) {
      console.error('Error loading upgrades:', error);
      toast.error('Failed to load upgrades');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (upgrade: Upgrade) => {
    // Check if already installed (or higher tier installed?)
    // For simplicity, just check if this specific upgrade is installed
    const isInstalled = installedUpgrades.some(u => u.upgrade_id === upgrade.id);
    if (isInstalled) return;

    setPurchasing(upgrade.id);
    try {
      const { data, error } = await supabase.rpc('apply_car_upgrade', {
        p_user_car_id: userCarId,
        p_upgrade_id: upgrade.id
      });

      if (error) throw error;

      toast.success(`Purchased ${upgrade.name}!`);
      await loadData();
      onUpdate(); // Refresh parent to update value
    } catch (error: any) {
      console.error('Purchase failed:', error);
      toast.error(error.message || 'Failed to purchase upgrade');
    } finally {
      setPurchasing(null);
    }
  };

  const getUpgradeIcon = (type: string) => {
    switch (type) {
      case 'engine': return <Wrench className="w-5 h-5 text-red-400" />;
      case 'transmission': return <Settings className="w-5 h-5 text-blue-400" />;
      case 'tires': return <div className="w-5 h-5 rounded-full border-4 border-zinc-400" />;
      case 'body': return <div className="w-5 h-5 bg-zinc-400 rounded" />;
      case 'nitro': return <Zap className="w-5 h-5 text-yellow-400" />;
      default: return <Wrench className="w-5 h-5 text-gray-400" />;
    }
  };

  const categories = ['engine', 'transmission', 'tires', 'body', 'nitro'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Car Upgrades</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
            </div>
          ) : (
            categories.map(category => {
              const categoryUpgrades = availableUpgrades.filter(u => u.type === category);
              if (categoryUpgrades.length === 0) return null;

              return (
                <div key={category} className="space-y-3">
                  <h3 className="text-sm font-bold uppercase text-zinc-500 tracking-wider flex items-center gap-2">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryUpgrades.map(upgrade => {
                      const isInstalled = installedUpgrades.some(u => u.upgrade_id === upgrade.id);
                      // Check if a better upgrade of same type is installed? 
                      // For now, allow mixing if the logic permits, but usually it's one per type.
                      // The UI will just show list.
                      
                      return (
                        <div key={upgrade.id} className={`p-3 rounded-xl border ${isInstalled ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-zinc-800/50 border-zinc-700'} flex flex-col gap-2 transition-all hover:border-zinc-600`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className={`font-bold ${isInstalled ? 'text-emerald-400' : 'text-white'}`}>{upgrade.name}</h4>
                              <p className="text-xs text-zinc-400">{upgrade.description}</p>
                            </div>
                            {isInstalled && <div className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded uppercase font-bold">Installed</div>}
                          </div>
                          
                          <div className="mt-2 flex items-center justify-between">
                             <div className="text-xs text-emerald-400 flex items-center gap-1">
                               <ArrowUp className="w-3 h-3" />
                               Value +{upgrade.value_increase_amount.toLocaleString()}
                             </div>
                             
                             {!isInstalled && (
                               <button
                                 onClick={() => handlePurchase(upgrade)}
                                 disabled={purchasing === upgrade.id}
                                 className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                               >
                                 {purchasing === upgrade.id ? (
                                   <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                 ) : (
                                   <>
                                     <Coins className="w-3 h-3" />
                                     {upgrade.cost.toLocaleString()}
                                   </>
                                 )}
                               </button>
                             )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
          
          {!loading && availableUpgrades.length === 0 && (
             <div className="text-center py-10 text-zinc-500">
               <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
               <p>No upgrades available at the moment.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ZapIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function SettingsIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }

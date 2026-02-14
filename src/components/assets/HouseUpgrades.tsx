import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Wrench, Shield, Home, Gem, Sun } from 'lucide-react';
import { toast } from 'sonner';

interface Upgrade {
  id: string;
  name: string;
  description: string;
  base_price: number;
  effects: any;
  icon_name: string;
  max_per_house: number;
}

interface Installation {
  id: string;
  upgrade_id: string;
}

interface HouseUpgradesProps {
  userHouseId: string;
  houseStatus: string;
}

export default function HouseUpgrades({ userHouseId, houseStatus }: HouseUpgradesProps) {
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch catalog
      const { data: catalogData, error: catalogError } = await supabase
        .from('house_upgrades_catalog')
        .select('*');
      
      if (catalogError) throw catalogError;
      setUpgrades(catalogData);

      // Fetch installations
      const { data: installData, error: installError } = await supabase
        .from('house_installations')
        .select('*')
        .eq('user_house_id', userHouseId);
        
      if (installError) throw installError;
      setInstallations(installData);
    } catch (error) {
      console.error('Error fetching upgrades:', error);
    } finally {
      setLoading(false);
    }
  }, [userHouseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePurchase = async (upgrade: Upgrade) => {
    if (houseStatus !== 'active') {
      toast.error('House must be active to upgrade');
      return;
    }

    setProcessing(upgrade.id);
    try {
      const { data, error } = await supabase.rpc('purchase_house_upgrade', {
        p_user_house_id: userHouseId,
        p_upgrade_id: upgrade.id
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Upgrade installed successfully!');
        fetchData(); // Refresh list
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Failed to purchase upgrade');
    } finally {
      setProcessing(null);
    }
  };

  if (loading && upgrades.length === 0) {
    return <div className="p-4 text-center text-zinc-500">Loading upgrades...</div>;
  }

  const getIcon = (name: string) => {
    switch (name) {
      case 'Home': return <Home className="w-5 h-5" />;
      case 'Sun': return <Sun className="w-5 h-5" />;
      case 'Shield': return <Shield className="w-5 h-5" />;
      case 'Gem': return <Gem className="w-5 h-5" />;
      default: return <Wrench className="w-5 h-5" />;
    }
  };

  const isInstalled = (upgradeId: string) => {
    return installations.some(i => i.upgrade_id === upgradeId);
  };

  return (
    <Dialog onOpenChange={(open) => { if (open) fetchData(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-2 border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800">
          <Wrench className="w-4 h-4" /> Manage Upgrades
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-2xl">
        <DialogHeader>
          <DialogTitle>Property Upgrades</DialogTitle>
          <DialogDescription>
            Enhance your property to increase slots, reduce fees, or boost influence.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {upgrades.map(upgrade => {
              const installed = isInstalled(upgrade.id);
              return (
                <div key={upgrade.id} className={`p-4 rounded-lg border flex items-center gap-4 ${
                  installed 
                    ? 'bg-emerald-950/20 border-emerald-900/50' 
                    : 'bg-zinc-900/50 border-zinc-800'
                }`}>
                  <div className={`p-3 rounded-full ${
                    installed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {getIcon(upgrade.icon_name)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-zinc-200">{upgrade.name}</h4>
                      {installed && (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                          INSTALLED
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400 mt-1">{upgrade.description}</p>
                    <div className="flex gap-2 mt-2">
                      {Object.entries(upgrade.effects).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="bg-zinc-950 border-zinc-800 text-xs text-zinc-500">
                          {key.replace(/_/g, ' ')}: {String(value)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-mono text-emerald-400 mb-2">
                      {installed ? 'Owned' : `$${upgrade.base_price.toLocaleString()}`}
                    </div>
                    {!installed && (
                      <Button 
                        size="sm" 
                        disabled={processing === upgrade.id || houseStatus !== 'active'}
                        onClick={() => handlePurchase(upgrade)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {processing === upgrade.id ? 'Installing...' : 'Install'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

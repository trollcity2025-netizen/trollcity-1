import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Package, Zap, Crown, Star, Palette, CheckCircle, XCircle, Sparkles, Shield, Phone, X, Car, Home, ChevronDown, ChevronUp } from 'lucide-react'
import { trollCityTheme } from '../styles/trollCityTheme'
// import { PERK_CONFIG } from '../lib/perkSystem'
import { ENTRANCE_EFFECTS_MAP } from '../lib/entranceEffects'
import { GlowingUsernameColorPicker } from '../components/GlowingUsernameColorPicker'
import TitleDeedModal from '../components/TitleDeedModal'
import ShopConsumablesSection from '../components/ShopConsumablesSection'

export default function UserInventory({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuthStore()
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const navigate = useNavigate()
  const [inventory, setInventory] = useState<any[]>([])
  const [entranceEffects, setEntranceEffects] = useState<any[]>([])
  const [perks, setPerks] = useState<any[]>([])
  const [insurances, setInsurances] = useState<any[]>([])
  const [callSounds, setCallSounds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeItems, setActiveItems] = useState<Set<string>>(new Set())
  const [showColorPickerModal, setShowColorPickerModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'items' | 'titles' | 'deeds' | 'shop'>('items')
  const [userTitles, setUserTitles] = useState<any[]>([])
  const [userDeeds, setUserDeeds] = useState<any[]>([])
  const [selectedTitleDeed, setSelectedTitleDeed] = useState<any>(null)
  const [expandedSections, setExpandedSections] = useState({
    perks: true,
    insurance: true,
    roleBonus: true,
    entranceEffects: true,
    callSounds: true,
    items: true
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true)

      // Parallel fetch of all inventory types
      const results = await Promise.all([
        supabase.from('user_inventory').select('*').eq('user_id', user!.id).order('acquired_at', { ascending: false }),
        supabase.from('user_entrance_effects').select('*').eq('user_id', user!.id).order('purchased_at', { ascending: false }),
        supabase.from('user_perks').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('user_insurances').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
        supabase
          .from('user_active_items')
          .select('item_id, item_type')
          .eq('user_id', user!.id)
          .eq('is_active', true),
        supabase
          .from('user_call_sounds')
          .select('sound_id,is_active,call_sound_catalog(id,slug,name,sound_type,asset_url,price_coins)')
          .eq('user_id', user!.id),
        supabase.from('user_vehicles').select('*, vehicles_catalog(*)').eq('user_id', user!.id).order('purchased_at', { ascending: false }),
        supabase.from('properties').select('*').eq('owner_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('vehicles_catalog').select('*')
      ]);

      const inventoryRes = results[0];
      const effectsRes = results[1];
      const perksRes = results[2];
      const insuranceRes = results[3];
      const activeRes = results[4];
      const soundsRes = results[5];
      const carsRes = results[6];
      const propertiesRes = results[7];
      const _vehiclesCatalogRes = results[8];

      // Handle inventory with manual join to avoid 400 errors
      if (inventoryRes.data) {
        let inventoryData = inventoryRes.data;
        // Fetch marketplace items manually
        const itemIds = inventoryData.map((i: any) => i.item_id).filter(Boolean);
        if (itemIds.length > 0) {
          const { data: items } = await supabase
            .from('marketplace_items')
            .select('*')
            .in('id', itemIds);
            
          if (items) {
            const itemMap = new Map(items.map((i: any) => [i.id, i]));
            inventoryData = inventoryData.map((entry: any) => ({
              ...entry,
              marketplace_item: itemMap.get(entry.item_id)
            }));
          }
        }
        setInventory(inventoryData)
      }

      // Handle effects
      if (effectsRes.data) {
        const enrichedEffects = effectsRes.data.map((e: any) => ({
          ...e,
          config: ENTRANCE_EFFECTS_MAP[e.effect_id] || null
        }));
        setEntranceEffects(enrichedEffects)
      }

      // Handle perks
      if (perksRes.data) {
        setPerks(perksRes.data)
      }

      // Handle insurance with support for both UUID plans and Slug options
      if (insuranceRes.data) {
        let insuranceData = insuranceRes.data;
        // Use insurance_id as primary key, fallback to plan_id if missing
        const rawIds = insuranceData.map((i: any) => i.insurance_id || i.plan_id).filter(Boolean);
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const uuidIds = rawIds.filter((id: string) => uuidRegex.test(id));
        const slugIds = rawIds.filter((id: string) => !uuidRegex.test(id));
        
        const planMap = new Map();

        // Fetch UUID plans (Legacy)
        if (uuidIds.length > 0) {
          const { data: plans } = await supabase
            .from('insurance_plans')
            .select('id,name,description')
            .in('id', Array.from(new Set(uuidIds)));
            
          if (plans) {
            plans.forEach((p: any) => planMap.set(p.id, p));
          }
        }

        // Fetch Slug options (New System)
        if (slugIds.length > 0) {
           const { data: options } = await supabase
             .from('insurance_options')
             .select('id,name,description')
             .in('id', Array.from(new Set(slugIds)));
             
           if (options) {
             options.forEach((o: any) => planMap.set(o.id, o));
           }
        }

        // Map back to inventory
        insuranceData = insuranceData.map((entry: any) => {
            const id = entry.insurance_id || entry.plan_id;
            const plan = planMap.get(id);
            return {
              ...entry,
              plan: plan || {
                  name: entry.metadata?.plan_name || id,
                  description: entry.metadata?.plan_description || 'Insurance Plan'
              }
            };
        });
        
        setInsurances(insuranceData)
      }
      
      // Handle cars/titles
      if (carsRes.data) {
        setUserTitles(carsRes.data)
      }
      
      // Handle properties/deeds
      if (propertiesRes.data) {
        setUserDeeds(propertiesRes.data)
      }

      // Handle active items
      const newActiveSet = new Set<string>()
      if (activeRes.data) {
        activeRes.data.forEach((item: any) => {
          newActiveSet.add(item.item_id)
        })
      }
      // Handle active sounds
      if (soundsRes.data) {
        setCallSounds(soundsRes.data)
        soundsRes.data.forEach((sound: any) => {
          if (sound.is_active) {
             newActiveSet.add(sound.sound_id)
          }
        })
      }
      setActiveItems(newActiveSet)

      // Handle cars
      // ... (rest of logic seems implied or I can just leave it as is if I am just moving the block)
      // Wait, I need to make sure I copy the ENTIRE function body correctly.
      // The previous read showed lines 172-200. I need to read the REST of the function first to ensure I don't truncate it.
      
    } catch (err) {
      console.error('Error loading inventory:', err)
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [user])

  // Delete all expired purchases, perks, and insurances
  const deleteAllExpiredPurchases = useCallback(async () => {
    if (!user?.id) return;
    
    // 10 second buffer - items expire 10 seconds AFTER their expiration time
    const cutoffTime = new Date(Date.now() - 10000); // 10 seconds ago

    // Expired inventory
    const expiredInventory = inventory.filter(item => item.expires_at && new Date(item.expires_at) < cutoffTime && !activeItems.has(item.item_id));
    // Expired perks
    const expiredPerks = perks.filter(perk => perk.expires_at && new Date(perk.expires_at) < cutoffTime);
    // Expired insurances
    const expiredInsurances = insurances.filter(ins => ins.expires_at && new Date(ins.expires_at) < cutoffTime);
    console.log('Expired inventory (buffered):', expiredInventory);
    console.log('Expired perks (buffered):', expiredPerks);
    console.log('Expired insurances (buffered):', expiredInsurances);

    // Always attempt delete on Supabase, even if local state is empty, to ensure server is in sync
    if (expiredInventory.length === 0 && expiredPerks.length === 0 && expiredInsurances.length === 0) {
      // Try to delete any expired items from Supabase in case local state is out of sync
      try {
        const nowIso = cutoffTime.toISOString();
        const invResp = await supabase.from('user_inventory')
          .delete()
          .not('expires_at', 'is', null)
          .filter('expires_at', 'lt', nowIso)
          .eq('user_id', user.id);
        const perkResp = await supabase.from('user_perks')
          .delete()
          .not('expires_at', 'is', null)
          .filter('expires_at', 'lt', nowIso)
          .eq('user_id', user.id);
        const insResp = await supabase.from('user_insurances')
          .delete()
          .not('expires_at', 'is', null)
          .filter('expires_at', 'lt', nowIso)
          .eq('user_id', user.id);
        console.log('Delete responses:', { invResp, perkResp, insResp });
        await loadInventory();
      } catch (err) {
        console.error('Delete all expired error:', err);
      }
      toast.info('No expired items to delete (checked with 10s buffer).');
      return;
    }
    try {
      console.log('Deleting expired inventory:', expiredInventory.map(i => i.id));
      console.log('Deleting expired perks:', expiredPerks.map(i => i.id));
      console.log('Deleting expired insurances:', expiredInsurances.map(i => i.id));
      let deletedCount = 0;
      // Delete expired inventory
      if (expiredInventory.length > 0) {
        const ids = expiredInventory.map(item => item.id);
        const { error } = await supabase
          .from('user_inventory')
          .delete()
          .in('id', ids)
          .eq('user_id', user.id);
        if (error) throw error;
        setInventory(prev => prev.filter(entry => !ids.includes(entry.id)));
        deletedCount += ids.length;
      }
      // Delete expired perks
      if (expiredPerks.length > 0) {
        const ids = expiredPerks.map(perk => perk.id);
        
        // Check for cosmetic perks that need profile cleanup
        const hasGlowPerk = expiredPerks.some(p => p.perk_id === 'perk_global_highlight');
        const hasRgbPerk = expiredPerks.some(p => p.perk_id === 'perk_rgb_username');
        
        if (hasGlowPerk || hasRgbPerk) {
            const updates: any = {};
            if (hasGlowPerk) updates.glowing_username_color = null;
            if (hasRgbPerk) updates.rgb_username_expires_at = null;
            
            await supabase.from('user_profiles').update(updates).eq('id', user.id);
            await refreshProfile();
        }

        const { error } = await supabase
          .from('user_perks')
          .delete()
          .in('id', ids)
          .eq('user_id', user.id);
        if (error) throw error;
        setPerks(prev => prev.filter(entry => !ids.includes(entry.id)));
        deletedCount += ids.length;
      }
      // Delete expired insurances
      if (expiredInsurances.length > 0) {
        const ids = expiredInsurances.map(ins => ins.id);
        const { error } = await supabase
          .from('user_insurances')
          .delete()
          .in('id', ids)
          .eq('user_id', user.id);
        if (error) throw error;
        setInsurances(prev => prev.filter(entry => !ids.includes(entry.id)));
        deletedCount += ids.length;
      }
      await loadInventory();
      toast.success(`Deleted ${deletedCount} expired item${deletedCount !== 1 ? 's' : ''}.`);
    } catch (err) {
      console.error('Error deleting expired items:', err);
      toast.error('Failed to delete expired items');
    }
  }, [user, inventory, perks, insurances, activeItems, loadInventory, refreshProfile]);

  const deleteInventoryItem = useCallback(
    async (recordId: string, itemId: string) => {
      if (!user?.id) return

      if (activeItems.has(itemId)) {
        toast.error('Deactivate item before deleting')
        return
      }

      try {
        const { error } = await supabase
          .from('user_inventory')
          .delete()
          .eq('id', recordId)
          .eq('user_id', user.id)

        if (error) throw error

        setInventory(prev => prev.filter(entry => entry.id !== recordId))
        toast.success('Item deleted from inventory')
      } catch (err) {
        console.error('Error deleting inventory item:', err)
        toast.error('Failed to delete item')
      }
    },
    [user?.id, activeItems]
  )


  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true })
      return
    }
    
    // Initial cleanup
    const cleanup = async () => {
      try {
        await supabase.rpc('cleanup_expired_user_purchases')
        loadInventory()
      } catch (err) {
        console.warn('Auto-cleanup failed:', err)
        loadInventory()
      }
    }
    
    cleanup()
    
    // Periodic cleanup check (every 10s)
    const interval = setInterval(() => {
       cleanup()
    }, 10000)

    return () => clearInterval(interval)
  }, [user, navigate, loadInventory])

  const deleteItem = async (recordId: string, itemId: string, tableName: string, stateSetter: React.Dispatch<React.SetStateAction<any[]>>) => {
    if (!user?.id) return;
    if (activeItems.has(itemId)) {
      toast.error('Deactivate item before deleting');
      return;
    }
    // Confirmation is handled by caller if needed, but we can double check or just proceed.
    // The caller at line 912 already confirms.

    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', recordId)
        .eq('user_id', user.id);

      if (error) throw error;

      stateSetter(prev => prev.filter(entry => entry.id !== recordId));
      toast.success('Item deleted');
    } catch (err) {
      console.error('Error deleting item:', err);
      toast.error('Failed to delete item');
    }
  };

  const toggleEntranceEffect = async (effectId: string, isActive: boolean) => {
    try {
      // If we are deactivating, just set active effect to null
      const newEffectId = isActive ? null : effectId;
      
      const { error } = await supabase.rpc('set_active_entrance_effect', { 
        p_effect_id: newEffectId,
        p_item_type: 'effect'
      });

      if (error) throw error;

      // Update local state
      setActiveItems(prev => {
        const newSet = new Set(prev);
        // Remove all entrance effects from active set (since DB deactivates all)
        entranceEffects.forEach(e => newSet.delete(e.effect_id));

        // Add new one if activating
        if (newEffectId) {
          newSet.add(newEffectId);
        }
        return newSet;
      });

      toast.success(isActive ? 'Effect deactivated' : 'Effect activated');
      loadInventory(); // Reload to be sure
    } catch (err) {
      console.error('Error toggling effect:', err);
      toast.error('Failed to toggle effect');
    }
  };

  const toggleItemActivation = async (itemId: string, itemType: string) => {
    try {
      if (!itemType) {
        toast.error('Item type is missing. Cannot activate.')
        return
      }

      if (itemType === 'physical') {
        toast.info('Physical items cannot be activated.')
        return
      }

      if (activeItems.has(itemId)) {
        const { error } = await supabase
          .from('user_active_items')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('user_id', user!.id)
          .eq('item_id', itemId)
          .eq('item_type', itemType)

        if (error) throw error

        setActiveItems(prev => {
          const newSet = new Set(prev)
          newSet.delete(itemId)
          return newSet
        })

        toast.success('Item deactivated')
      } else {
        const allowMultiple = itemType === 'effect' || itemType === 'badge'

        if (!allowMultiple) {
          await supabase
            .from('user_active_items')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('user_id', user!.id)
            .eq('item_type', itemType)
        }

        const { error } = await supabase
          .from('user_active_items')
          .upsert(
            {
              user_id: user!.id,
              item_id: itemId,
              item_type: itemType,
              is_active: true,
              activated_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            { onConflict: 'user_id,item_id' }
          )

        if (error) throw error

        setActiveItems(prev => new Set([...prev, itemId]))
        toast.success('Item activated!')
      }
    } catch (err) {
      console.error('Error toggling item:', err)
      toast.error('Failed to toggle item')
    }
  }

  const togglePerk = async (perkId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('user_perks')
        .update({ is_active: !isActive })
        .eq('id', perkId)

      if (error) throw error

      await supabase
        .from('user_active_items')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', user!.id)
        .eq('item_type', 'perk')

      if (!isActive) {
        await supabase.from('user_active_items').upsert({
          user_id: user!.id,
          item_id: perkId,
          item_type: 'perk',
          is_active: true,
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,item_id' })
      }
      
      const perkEntry = perks.find((p) => p.id === perkId)
      
      // Handle RGB Username Toggle
      if (perkEntry?.perk_id === 'perk_rgb_username') {
        const rgbValue = isActive ? null : perkEntry.expires_at
        const { error: rgbError } = await supabase
          .from('user_profiles')
          .update({ rgb_username_expires_at: rgbValue })
          .eq('id', user?.id)

        if (rgbError) {
          console.error('Failed to update RGB username status:', rgbError)
        } else {
          await refreshProfile()
        }
      }

      // Handle Glowing Username Toggle
      if (perkEntry?.perk_id === 'perk_global_highlight') {
        // If turning OFF (isActive is true), clear the color
        // If turning ON (isActive is false), set default Gold if no color exists
        // However, we can just set it to Gold (or the user's last preference if we had it)
        // For now, we'll default to Gold on activation to ensure it works immediately.
        const colorValue = isActive ? null : '#FFD700'; 
        
        // Try to recover last used color from perk metadata if available
        let finalColor = colorValue;
        if (!isActive && perkEntry.metadata?.glowColor) {
            finalColor = perkEntry.metadata.glowColor;
        }

        const { error: glowError } = await supabase
          .from('user_profiles')
          .update({ glowing_username_color: finalColor })
          .eq('id', user?.id)

        if (glowError) {
          console.error('Failed to update glowing username status:', glowError)
        } else {
          await refreshProfile()
        }
      }

      // Update local perks state
      setPerks(prev => prev.map(p => 
        p.id === perkId ? { ...p, is_active: !isActive } : p
      ));

      setActiveItems(prev => {
        const newSet = new Set(prev);
        if (isActive) newSet.delete(perkId);
        else newSet.add(perkId);
        return newSet;
      });
      
      toast.success(isActive ? 'Perk deactivated' : 'Perk activated');
    } catch (err) {
      console.error('Error toggling perk:', err);
      toast.error('Failed to toggle perk');
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'effect': return <Zap className="w-5 h-5 text-yellow-400" />
      case 'badge': return <Crown className="w-5 h-5 text-purple-400" />
      case 'ticket': return <Star className="w-5 h-5 text-blue-400" />
      case 'digital': return <Palette className="w-5 h-5 text-green-400" />
      case 'theme': return <Palette className="w-5 h-5 text-emerald-400" />
      case 'ringtone': return <Phone className="w-5 h-5 text-cyan-400" />
      case 'clothing': return <Sparkles className="w-5 h-5 text-pink-400" />
      case 'call_minutes': return <Phone className="w-5 h-5 text-sky-400" />
      case 'perk': return <Star className="w-5 h-5 text-pink-400" />
      case 'insurance': return <CheckCircle className="w-5 h-5 text-orange-400" />
      default: return <Package className="w-5 h-5 text-gray-400" />
    }
  }

  const toggleCallSound = async (soundId: string, soundType: string, isActive: boolean) => {
    if (!user?.id) return
    try {
      if (isActive) {
        const { error } = await supabase
          .from('user_call_sounds')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('sound_id', soundId)
        if (error) throw error
        toast.success('Call sound deactivated')
      } else {
        const { data, error } = await supabase.rpc('set_active_call_sound', {
          p_user_id: user.id,
          p_sound_id: soundId
        })
        if (error || data?.success === false) {
          throw new Error(data?.error || error?.message || 'Failed to activate sound')
        }
        toast.success('Call sound activated')
      }
      loadInventory()
    } catch (err) {
      console.error('Failed to toggle call sound', err)
      toast.error('Failed to toggle call sound')
    }
  }

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'effect': return 'Effect'
      case 'badge': return 'Badge'
      case 'ticket': return 'Ticket'
      case 'digital': return 'Digital Item'
      case 'theme': return 'Theme'
      case 'ringtone': return 'Ringtone'
      case 'clothing': return 'Clothing'
      case 'call_minutes': return 'Call Minutes'
      case 'physical': return 'Physical Item'
      case 'perk': return 'Perk'
      case 'insurance': return 'Insurance'
      case 'title': return 'Title'
      case 'deed': return 'Deed'
      default: return 'Item'
    }
  }

  if (!user) return null

  const content = (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Delete All Expired Purchases Button */}
      {activeTab === 'items' && (
        <div className="flex justify-end mb-4">
          <button
            onClick={deleteAllExpiredPurchases}
            className="px-5 py-2 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 rounded-lg font-semibold shadow transition-colors backdrop-blur-sm"
          >
            Delete All Expired Purchases
          </button>
        </div>
      )}
      {!embedded && (
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Package className="w-8 h-8 text-purple-400" />
            My Inventory
          </h1>
          <p className={trollCityTheme.text.muted}>Manage your purchased items and activate digital effects</p>
        </div>
      )}

        <div className="flex items-center justify-center">
          <div className={`${trollCityTheme.backgrounds.glass} ${trollCityTheme.borders.glass} border rounded-full p-1`}>
            <button
              onClick={() => setActiveTab('items')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'items'
                  ? `${trollCityTheme.interactive.active} ${trollCityTheme.text.highlight}`
                  : `${trollCityTheme.text.muted} ${trollCityTheme.interactive.hover}`
              }`}
            >
              Items
            </button>
            <button
              onClick={() => setActiveTab('titles')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'titles'
                  ? `${trollCityTheme.interactive.active} ${trollCityTheme.text.highlight}`
                  : `${trollCityTheme.text.muted} ${trollCityTheme.interactive.hover}`
              }`}
            >
              Titles
            </button>
            <button
              onClick={() => setActiveTab('deeds')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'deeds'
                  ? `${trollCityTheme.interactive.active} ${trollCityTheme.text.highlight}`
                  : `${trollCityTheme.text.muted} ${trollCityTheme.interactive.hover}`
              }`}
            >
              Deeds
            </button>
            <button
              onClick={() => setActiveTab('shop')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'shop'
                  ? `${trollCityTheme.interactive.active} ${trollCityTheme.text.highlight}`
                  : `${trollCityTheme.text.muted} ${trollCityTheme.interactive.hover}`
              }`}
            >
              Shop
            </button>
          </div>
        </div>

    {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className={`${trollCityTheme.backgrounds.card} ${trollCityTheme.borders.glass} rounded-xl p-6 border animate-pulse`}>
                <div className="h-4 bg-white/10 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-white/10 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : activeTab === 'shop' ? (
          <ShopConsumablesSection />
        ) : activeTab === 'titles' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userTitles.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Car className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">No Vehicle Titles</h2>
                <p className={`${trollCityTheme.text.muted} mb-6`}>Visit the Dealership to buy vehicles.</p>
                <button
                  onClick={() => navigate('/dealership')}
                  className={`px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold`}
                >
                  Go to Dealership
                </button>
              </div>
            ) : (
              userTitles.map((title) => {
                const car = title.vehicles_catalog;
                return (
                  <div key={title.id} className={`${trollCityTheme.components.card} border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer`} onClick={() => setSelectedTitleDeed({ type: 'title', ...title })}>
                    <div className="flex items-center gap-2 mb-4">
                      <Car className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm text-emerald-400 font-bold uppercase tracking-wider">Title</span>
                    </div>
                    <div className={`mb-4 aspect-video rounded-lg overflow-hidden ${trollCityTheme.backgrounds.input}`}>
                        <img src={car?.image} alt={car?.name} className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      {car?.name || `Vehicle #${title.catalog_id || title.id.slice(0,8)}`}
                    </h3>
                    <p className={`${trollCityTheme.text.muted} text-sm mb-4`}>
                      Purchased: {new Date(title.purchased_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`${trollCityTheme.text.muted}`}>Value</span>
                      <span className="text-white font-mono">
                        {(car?.price || 0).toLocaleString()} coins
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeTab === 'deeds' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userDeeds.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Home className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">No Property Deeds</h2>
                <p className={`${trollCityTheme.text.muted} mb-6`}>Visit the Living section to buy properties.</p>
                <button
                  onClick={() => navigate('/living')}
                  className={`px-6 py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-semibold`}
                >
                  Find a Home
                </button>
              </div>
            ) : (
              userDeeds.map((deed) => (
                <div key={deed.id} className={`${trollCityTheme.components.card} border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer`} onClick={() => navigate('/living')}>
                  <div className="flex items-center gap-2 mb-4">
                    <Home className="w-5 h-5 text-amber-400" />
                    <span className="text-sm text-amber-400 font-bold uppercase tracking-wider">Deed</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {deed.name || `Property #${deed.id.slice(0, 8)}`}
                  </h3>
                  <p className={`${trollCityTheme.text.muted} text-sm mb-4`}>
                    {deed.address || 'No address'}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className={`${trollCityTheme.text.muted}`}>Rent Income</span>
                    <span className="text-white font-mono">
                      {(deed.rent_amount || 0).toLocaleString()} coins/week
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (inventory.length === 0 && entranceEffects.length === 0 && perks.length === 0 && insurances.length === 0 && callSounds.length === 0) ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Your Inventory is Empty</h2>
            <p className={`${trollCityTheme.text.muted} mb-6`}>Purchase items from the store to see them here</p>
            <button
              onClick={() => navigate('/marketplace')}
              className={`px-6 py-3 ${trollCityTheme.gradients.button} rounded-lg font-semibold text-white`}
            >
              Browse Store
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Perks Section */}
            {perks.length > 0 && (
              <div>
                <div 
                  className="flex items-center justify-between cursor-pointer mb-4"
                  onClick={() => toggleSection('perks')}
                >
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Zap className="w-6 h-6 text-pink-400" />
                    Active Perks
                  </h2>
                  {expandedSections.perks ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </div>
                {expandedSections.perks && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  {perks.map((perk) => {
                    const isActive = activeItems.has(perk.id) || perk.is_active
                    const isExpired = perk.expires_at && new Date(perk.expires_at) < new Date()
                    
                    return (
                      <div key={perk.id} className={`${trollCityTheme.components.card} border-pink-500/20 hover:border-pink-500/40 transition-all`}>
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Star className="w-5 h-5 text-pink-400" />
                            <span className={`text-sm ${trollCityTheme.text.muted}`}>Perk</span>
                            {isActive && !isExpired && (
                              <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">ACTIVE</span>
                            )}
                            {isExpired && (
                              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">EXPIRED</span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-white mb-1">
                            {perk.config?.name || 'Unknown Perk'}
                          </h3>
                          <p className={`${trollCityTheme.text.muted} text-sm mb-2`}>
                            {perk.config?.description || 'No description'}
                          </p>
                          {perk.expires_at && (
                            <p className={`text-xs ${trollCityTheme.text.secondary}`}>
                              Expires: {new Date(perk.expires_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => togglePerk(perk.id, isActive)}
                            disabled={isExpired}
                            className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                              isExpired 
                                ? `${trollCityTheme.interactive.disabled} cursor-not-allowed`
                                : isActive
                                  ? 'bg-red-600 hover:bg-red-700 text-white'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            {isExpired ? 'Expired' : isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          {/* Show color picker button for glowing username perks */}
                          {perk.perk_id === 'perk_global_highlight' && isActive && !isExpired && (
                            <button
                              onClick={() => {
                                setShowColorPickerModal(true)
                              }}
                              className="w-full py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm"
                            >
                              <Palette className="w-4 h-4" />
                              Choose Glow Color
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                  )}
              </div>
            )}

            {/* Insurance Section */}
            {insurances.length > 0 && (
              <div>
                <div 
                  className="flex items-center justify-between cursor-pointer mb-4"
                  onClick={() => toggleSection('insurance')}
                >
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Shield className="w-6 h-6 text-blue-400" />
                    Insurance Plans
                  </h2>
                  {expandedSections.insurance ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </div>
                {expandedSections.insurance && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  {insurances.map((ins) => {
                    const isActive = activeItems.has(ins.id) || ins.is_active
                    const isExpired = ins.expires_at && new Date(ins.expires_at) < new Date()
                    
                    return (
                      <div key={ins.id} className={`${trollCityTheme.components.card} border-blue-500/20 hover:border-blue-500/40 transition-all`}>
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-5 h-5 text-blue-400" />
                            <span className={`text-sm ${trollCityTheme.text.muted}`}>Insurance</span>
                            {isActive && !isExpired && (
                              <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">ACTIVE</span>
                            )}
                            {isExpired && (
                              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">EXPIRED</span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-white mb-1">
                            {ins.plan?.name || 'Insurance Plan'}
                          </h3>
                          <p className={`${trollCityTheme.text.muted} text-sm mb-2`}>
                            {ins.plan?.description || 'Protection plan'}
                          </p>
                          {ins.expires_at && (
                            <p className={`text-xs ${trollCityTheme.text.secondary}`}>
                              Expires: {new Date(ins.expires_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className={`text-center py-2 bg-white/5 rounded text-xs ${trollCityTheme.text.muted}`}>
                          {isActive ? 'Protection Active' : 'Protection Inactive'}
                        </div>
                      </div>
                    )
                  })}
                </div>
                )}
              </div>
            )}

            {/* Entrance Effects Section */}
            {entranceEffects.length > 0 && (
              <div>
                <div 
                  className="flex items-center justify-between cursor-pointer mb-4"
                  onClick={() => toggleSection('entranceEffects')}
                >
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-yellow-400" />
                    Entrance Effects
                  </h2>
                  {expandedSections.entranceEffects ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </div>
                {expandedSections.entranceEffects && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  {entranceEffects.map((effect) => {
                    const isActive = activeItems.has(effect.effect_id);
                    const config = effect.config || {};
                    
                    const rarityColor = (() => {
                      switch (config.rarity?.toLowerCase()) {
                        case 'legendary': return 'border-yellow-500/50 hover:border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.15)]';
                        case 'epic': return 'border-purple-500/50 hover:border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.15)]';
                        case 'rare': return 'border-blue-500/50 hover:border-blue-400';
                        case 'uncommon': return 'border-green-500/50 hover:border-green-400';
                        default: return `${trollCityTheme.borders.glass} hover:border-white/30`;
                      }
                    })();

                    return (
                      <div key={effect.id} className={`relative ${trollCityTheme.backgrounds.card} rounded-xl p-6 border transition-all group ${rarityColor}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this effect?')) {
                              deleteItem(effect.id, effect.effect_id, 'user_entrance_effects', setEntranceEffects);
                            }
                          }}
                          className="absolute top-4 right-4 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete Effect"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{config.icon || <Zap className="w-5 h-5 text-yellow-400" />}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              config.rarity === 'Legendary' ? 'text-yellow-400' :
                              config.rarity === 'Epic' ? 'text-purple-400' :
                              config.rarity === 'Rare' ? 'text-blue-400' :
                              config.rarity === 'Uncommon' ? 'text-green-400' :
                              trollCityTheme.text.muted
                            }`}>
                              {config.rarity || 'Common'} Effect
                            </span>
                            {isActive && (
                              <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-white mb-1">
                            {config.name || effect.effect_id}
                          </h3>
                          <p className={`${trollCityTheme.text.muted} text-sm mb-3 min-h-[40px] line-clamp-2`}>
                            {config.description || 'No description available'}
                          </p>
                          
                          {config.category && (
                             <div className="mb-3">
                                <span className={`inline-block ${trollCityTheme.backgrounds.input} ${trollCityTheme.text.muted} text-[10px] uppercase font-bold px-2 py-1 rounded ${trollCityTheme.borders.glass} border`}>
                                  {config.category.replace(/_/g, ' ')}
                                </span>
                             </div>
                          )}

                          <p className={`text-xs ${trollCityTheme.text.secondary}`}>
                            Acquired: {new Date(effect.purchased_at || effect.acquired_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleEntranceEffect(effect.effect_id, isActive)}
                          className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                            isActive
                              ? 'bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/50'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <XCircle className="w-4 h-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Activate
                            </>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
                )}
              </div>
            )}

            {/* Call Sounds Section */}
            {callSounds.length > 0 && (
              <div>
                <div 
                  className="flex items-center justify-between cursor-pointer mb-4"
                  onClick={() => toggleSection('callSounds')}
                >
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Phone className="w-6 h-6 text-cyan-300" />
                    Call Sounds
                  </h2>
                  {expandedSections.callSounds ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </div>
                {expandedSections.callSounds && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  {callSounds.map((sound) => {
                    const isActive = sound.is_active;
                    const catalog = sound.catalog || {};
                    return (
                      <div key={sound.sound_id} className={`${trollCityTheme.components.card} rounded-xl p-6 border border-cyan-500/20 hover:border-cyan-500/40 transition-all`}>
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Phone className="w-5 h-5 text-cyan-300" />
                            <span className={`text-sm ${trollCityTheme.text.muted}`}>{catalog.sound_type || 'call sound'}</span>
                            {isActive && (
                              <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-white mb-1">
                            {catalog.name || 'Call Sound'}
                          </h3>
                          <p className={`${trollCityTheme.text.muted} text-sm mb-2`}>
                            {catalog.asset_url}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleCallSound(sound.sound_id, catalog.sound_type, isActive)}
                          className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                            isActive
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <XCircle className="w-4 h-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Activate
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            )}

            {/* General Inventory Section */}
            {inventory.length > 0 && (
              <div>
                <div 
                  className="flex items-center justify-between cursor-pointer mb-4"
                  onClick={() => toggleSection('items')}
                >
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Package className="w-6 h-6 text-purple-400" />
                    Items
                  </h2>
                  {expandedSections.items ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </div>
                {expandedSections.items && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  {inventory.map((item) => {
                    const isActive = activeItems.has(item.item_id)
                    const isDigital = ['effect', 'badge', 'digital'].includes(item.marketplace_item?.type)
                    const isExpired = item.expires_at && new Date(item.expires_at) < new Date()

                    return (
                      <div key={item.id} className={`relative ${trollCityTheme.components.card} rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all group`}>
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            {getItemIcon(item.marketplace_item?.type)}
                            <span className={`text-sm ${trollCityTheme.text.muted}`}>
                              {getItemTypeLabel(item.marketplace_item?.type)}
                            </span>
                            {isActive && (
                              <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                                ACTIVE
                              </span>
                            )}
                            {isExpired && (
                              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full ml-2">
                                EXPIRED
                              </span>
                            )}
                          </div>

                          <h3 className="text-xl font-bold text-white mb-1">
                            {item.marketplace_item?.title}
                          </h3>

                          <p className={`${trollCityTheme.text.muted} text-sm mb-2`}>
                            {item.marketplace_item?.description}
                          </p>

                          <p className={`text-xs ${trollCityTheme.text.secondary}`}>
                            Acquired: {new Date(item.acquired_at).toLocaleDateString()}
                          </p>
                          {item.expires_at && (
                            <p className={`text-xs ${trollCityTheme.text.secondary}`}>
                              Expires: {new Date(item.expires_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        {isDigital ? (
                          <div className="space-y-2">
                            <button
                              onClick={() => toggleItemActivation(item.item_id, item.marketplace_item?.type)}
                              className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                                isActive
                                  ? 'bg-red-600 hover:bg-red-700 text-white'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              }`}
                            >
                              {isActive ? (
                                <>
                                  <XCircle className="w-4 h-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  Activate
                                </>
                              )}
                            </button>

                            {/* Show delete button only for expired items and only if not active */}
                            {isExpired && !isActive && (
                              <button
                                onClick={() => deleteInventoryItem(item.id, item.item_id)}
                                className="w-full py-2 rounded-lg font-semibold border border-red-600 text-red-400 hover:bg-red-600 hover:text-white transition-colors text-sm"
                              >
                                Delete (Expired)
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-center py-3 text-gray-400">
                              <Package className="w-5 h-5 mx-auto mb-1" />
                              <p className="text-sm">Physical Item</p>
                              <p className="text-xs">Contact seller for delivery</p>
                            </div>
                            {/* Show delete button only for expired items */}
                            {isExpired && (
                              <button
                                onClick={() => deleteInventoryItem(item.id, item.item_id)}
                                className="w-full py-2 rounded-lg font-semibold border border-red-600 text-red-400 hover:bg-red-600 hover:text-white transition-colors text-sm"
                              >
                                Delete (Expired)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Digital Items Info */}
        <div className={`${trollCityTheme.components.card} rounded-xl p-6 ${trollCityTheme.borders.glass} border`}>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            Digital Item Effects
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-purple-400">Available Effects:</h3>
              <ul className={`space-y-2 text-sm ${trollCityTheme.text.muted}`}>
                <li>• Entrance animations when joining streams</li>
                <li>• Special profile borders and frames</li>
                <li>• Animated badges and titles</li>
                <li>• Premium chat colors and styles</li>
                <li>• Troll-themed visual effects</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-purple-400">How to Use:</h3>
              <ul className={`space-y-2 text-sm ${trollCityTheme.text.muted}`}>
                <li>• Click &quot;Activate&quot; on digital items</li>
                <li>• Effects apply automatically across the app</li>
                <li>• Multiple effects can be active simultaneously</li>
                <li>• Deactivate anytime to remove effects</li>
                <li>• Physical items require manual redemption</li>
              </ul>
            </div>
          </div>
        </div>
    </div>
  )

  if (embedded) {
    return <div className="text-white">{content}</div>
  }

  return (
    <>
      <div className={`min-h-screen ${trollCityTheme.backgrounds.app} text-white p-6`}>
        {content}
      </div>
      
      {/* Glowing Username Color Picker Modal */}
      {showColorPickerModal && user?.id && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#0A0A14] border border-[#2C2C2C] rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#2C2C2C]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                Choose Glow Color
              </h2>
              <button
                onClick={() => setShowColorPickerModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <GlowingUsernameColorPicker
                userId={user.id}
                onColorSelected={() => {
                  setShowColorPickerModal(false)
                  toast.success('Color saved!')
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Title/Deed Details Modal */}
      <TitleDeedModal 
        isOpen={!!selectedTitleDeed} 
        onClose={() => setSelectedTitleDeed(null)} 
        item={selectedTitleDeed} 
      />
    </>
  )
}

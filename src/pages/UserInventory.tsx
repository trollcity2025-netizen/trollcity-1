import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Package, Zap, Crown, Star, Palette, CheckCircle, XCircle, Sparkles, Shield, Phone, X, Car, Home } from 'lucide-react'
import { PERK_CONFIG } from '../lib/perkSystem'
import { ENTRANCE_EFFECTS_MAP, ROLE_BASED_ENTRANCE_EFFECTS, USER_SPECIFIC_ENTRANCE_EFFECTS } from '../lib/entranceEffects'
import { GlowingUsernameColorPicker } from '../components/GlowingUsernameColorPicker'
import AvatarCustomizer from './AvatarCustomizer'
import { cars } from '../data/vehicles'
import TitleDeedModal from '../components/TitleDeedModal'
import ShopConsumablesSection from '../components/ShopConsumablesSection'

export default function UserInventory({ embedded = false }: { embedded?: boolean }) {
  const { user, profile, refreshProfile } = useAuthStore()
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

  // Delete all expired purchases, perks, and insurances
  const deleteAllExpiredPurchases = useCallback(async () => {
    if (!user?.id) return;
    // Expired inventory
    const expiredInventory = inventory.filter(item => item.expires_at && new Date(item.expires_at) < new Date() && !activeItems.has(item.item_id));
    // Expired perks
    const expiredPerks = perks.filter(perk => perk.expires_at && new Date(perk.expires_at) < new Date());
    // Expired insurances
    const expiredInsurances = insurances.filter(ins => ins.expires_at && new Date(ins.expires_at) < new Date());
    console.log('Expired inventory:', expiredInventory);
    console.log('Expired perks:', expiredPerks);
    console.log('Expired insurances:', expiredInsurances);

    // Always attempt delete on Supabase, even if local state is empty, to ensure server is in sync
    if (expiredInventory.length === 0 && expiredPerks.length === 0 && expiredInsurances.length === 0) {
      // Try to delete any expired items from Supabase in case local state is out of sync
      try {
        const nowIso = new Date().toISOString();
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
      toast.info('No expired purchases, perks, or insurances to delete.');
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
  }, [user?.id, inventory, perks, insurances, activeItems]);

  const roleEffectKey = (() => {
    if (!profile) return null;
    const username = (profile.username || '').toLowerCase();
    const userSpecific = Object.keys(USER_SPECIFIC_ENTRANCE_EFFECTS).find((k) => k.toLowerCase() === username);
    if (userSpecific) return `user_${username}`;
    if (profile.role === 'admin' || profile.troll_role === 'admin' || profile.is_admin) return 'admin';
    if (profile.role === 'secretary' || profile.troll_role === 'secretary') return 'secretary';
    if (profile.role === 'lead_troll_officer' || profile.troll_role === 'lead_troll_officer' || profile.is_lead_officer) return 'lead_troll_officer';
    if (profile.role === 'troll_officer' || profile.troll_role === 'troll_officer') return 'troll_officer';
    return null;
  })();
  const roleEffect = (() => {
    if (!profile) return null;
    const username = (profile.username || '').toLowerCase();
    const userConfig = Object.entries(USER_SPECIFIC_ENTRANCE_EFFECTS).find(
      ([key]) => key.toLowerCase() === username
    )?.[1];
    if (userConfig) return { ...userConfig, type: 'User Exclusive' };
    const roleKey = roleEffectKey;
    return roleKey && ROLE_BASED_ENTRANCE_EFFECTS[roleKey] ? ROLE_BASED_ENTRANCE_EFFECTS[roleKey] : null;
  })();

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
        supabase.from('user_cars').select('*').eq('user_id', user!.id).order('purchased_at', { ascending: false }),
        supabase.from('properties').select('*').eq('owner_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('vehicles_catalog').select('*')
      ]);

      const inventoryRes = results[0];
      const effectsRes = results[1];
      const perksRes = results[2];
      const insuranceRes = results[3];
      const activeRes = results[4];
      const callSoundsRes = results[5];
      const titlesRes = results[6];
      const deedsRes = results[7];
      const catalogRes = results[8];
      
      const carsCatalog = catalogRes.data || [];

      // 1. Process Standard Inventory
      const inventoryData = inventoryRes.data || []
      const itemIds = Array.from(new Set(inventoryData.map((e: any) => e.item_id).filter(Boolean)))
      
      const itemDetailsMap: Record<string, any> = {}
      if (itemIds.length) {
        const { data: itemsData } = await supabase
          .from('marketplace_items')
          .select('id, title, description, type')
          .in('id', itemIds)
        itemsData?.forEach((item) => { itemDetailsMap[item.id] = item })
      }
      
      setInventory(inventoryData.map((entry) => ({
        ...entry,
        marketplace_item: itemDetailsMap[entry.item_id] || null,
      })).filter((item: any) => item.marketplace_item?.type !== 'physical'))

      // 2. Process Entrance Effects
      const effectsData = effectsRes.data || []
      setEntranceEffects(effectsData.map(e => ({
        ...e,
        config: ENTRANCE_EFFECTS_MAP[e.effect_id]
      })))

      // 3. Process Perks
      const perksData = perksRes.data || []
      setPerks(perksData.map(p => ({
        ...p,
        config: PERK_CONFIG[p.perk_id as keyof typeof PERK_CONFIG]
      })))

      // 4. Process Insurance
      const insuranceData = insuranceRes.data || []
      const planIds = Array.from(new Set(insuranceData.map((i: any) => i.insurance_id).filter(Boolean)))
      const insuranceMap: Record<string, any> = {}
      
      if (planIds.length > 0) {
        // Fetch plan names from insurance_plans if available, or insurance_options
        // Trying insurance_options first as per CoinStoreModal
        const { data: plans } = await supabase
          .from('insurance_options') 
          .select('id, name, description, icon')
          .in('id', planIds)
        
        plans?.forEach((p) => { insuranceMap[p.id] = p })
      }

      setInsurances(insuranceData.map(i => ({
        ...i,
        plan: insuranceMap[i.insurance_id] || { name: 'Insurance Plan', description: 'Protection' }
      })))

      const callSoundsData = (callSoundsRes?.data || []).map((row: any) => ({
        ...row,
        catalog: row.call_sound_catalog
      }));
      setCallSounds(callSoundsData)

      // Process Titles and Deeds
      // Only show active vehicle title (one vehicle per user)
      const allTitlesData = titlesRes.data || [];
      const activeTitle = allTitlesData.find((t: any) => t.is_active === true);
      const titlesData = activeTitle ? [activeTitle] : [];
      const deedsData = deedsRes.data || [];
      
      setUserTitles(titlesData.map((t: any) => {
         // Find car details for display
         // Try matching by model_url first (reliable), then by car_id (legacy)
         const carDef = carsCatalog.find((c: any) => 
             c.model_url === t.model_url || 
             c.id === t.car_id || 
             c.slug === t.car_id
         );
         return { ...t, carDef };
      }));
      
      setUserDeeds(deedsData);
      
      // 5. Active Items
      const activeSet = new Set(activeRes.data?.map(item => item.item_id) || [])
      
      // Also check active perks (they have is_active column)
      perksData.forEach(p => {
        if (p.is_active) activeSet.add(p.id)
      })

      // Also check active insurance
      insuranceData.forEach(i => {
        if (i.is_active) activeSet.add(i.id)
      })

      // Also check active entrance effects
      // Note: user_entrance_effects usually doesn't have is_active for toggle, but let's check
      // If we are using user_active_items table for entrance effects, then activeSet covers it.
      // But if user_entrance_effects has is_active column, we should check it.
      // Based on schema, user_entrance_effects might not have is_active, but we use user_active_items for effects.
      
      setActiveItems(activeSet)

    } catch (err) {
      console.error('Error loading inventory:', err)
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true })
      return
    }
    loadInventory()
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
        
        // Also remove role effect if active
        if (roleEffectKey) newSet.delete(`role_effect_${roleEffectKey}`);

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

  const toggleRoleEffect = async (isActive: boolean) => {
      if (!roleEffect) return;
      const roleEffectId = `role_effect_${roleEffectKey || 'default'}`;

      try {
          if (isActive) {
              // Deactivate
              const { error } = await supabase.rpc('set_active_entrance_effect', { p_effect_id: null });
              if (error) throw error;

              setActiveItems(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(roleEffectId);
                  return newSet;
              });
              toast.success('Role effect deactivated');
          } else {
              // Activate
              const { error } = await supabase.rpc('set_active_entrance_effect', { 
                  p_effect_id: roleEffectId,
                  p_item_type: 'role_effect'
              });
              if (error) throw error;

              setActiveItems(prev => {
                  const newSet = new Set(prev);
                  // Remove purchased effects from local state
                  entranceEffects.forEach(e => newSet.delete(e.effect_id));
                  // Add role effect
                  newSet.add(roleEffectId);
                  return newSet;
              });
              toast.success('Role effect activated');
          }
          loadInventory();
      } catch (err) {
          console.error('Error toggling role effect:', err);
          toast.error('Failed to toggle role effect');
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
            className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-semibold shadow transition-colors"
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
          <p className="text-gray-400">Manage your purchased items and activate digital effects</p>
        </div>
      )}

        <div className="flex items-center justify-center">
          <div className="inline-flex bg-black/40 border border-[#2C2C2C] rounded-full p-1">
            <button
              onClick={() => setActiveTab('items')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'items'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Items
            </button>
            <button
              onClick={() => setActiveTab('titles')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'titles'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Titles
            </button>
            <button
              onClick={() => setActiveTab('deeds')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'deeds'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Deeds
            </button>
            <button
              onClick={() => setActiveTab('shop')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'shop'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Shop
            </button>
          </div>
        </div>

    {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C] animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : activeTab === 'shop' ? (
          <ShopConsumablesSection />
        ) : activeTab === 'titles' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userTitles.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Car className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">No Vehicle Titles</h2>
                <p className="text-gray-400 mb-6">Visit the Dealership to buy vehicles.</p>
                <button
                  onClick={() => navigate('/dealership')}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold"
                >
                  Go to Dealership
                </button>
              </div>
            ) : (
              userTitles.map((title) => {
                const car = title.carDef;
                return (
                  <div key={title.id} className="bg-zinc-900 rounded-xl p-6 border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer" onClick={() => setSelectedTitleDeed({ type: 'title', ...title })}>
                    <div className="flex items-center gap-2 mb-4">
                      <Car className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm text-emerald-400 font-bold uppercase tracking-wider">Title</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      {car?.name || `Vehicle #${title.car_id || title.id.slice(0,8)}`}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Purchased: {new Date(title.purchased_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Value</span>
                      <span className="text-white font-mono">
                        {(title.current_value || car?.price || 0).toLocaleString()} coins
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
                <Home className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">No Property Deeds</h2>
                <p className="text-gray-400 mb-6">Visit the Living section to buy properties.</p>
                <button
                  onClick={() => navigate('/living')}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-semibold"
                >
                  Find a Home
                </button>
              </div>
            ) : (
              userDeeds.map((deed) => (
                <div key={deed.id} className="bg-zinc-900 rounded-xl p-6 border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer" onClick={() => navigate('/living')}>
                  <div className="flex items-center gap-2 mb-4">
                    <Home className="w-5 h-5 text-amber-400" />
                    <span className="text-sm text-amber-400 font-bold uppercase tracking-wider">Deed</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {deed.name || `Property #${deed.id.slice(0, 8)}`}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    {deed.address || 'No address'}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Rent Income</span>
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
            <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Your Inventory is Empty</h2>
            <p className="text-gray-400 mb-6">Purchase items from the store to see them here</p>
            <button
              onClick={() => navigate('/marketplace')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
            >
              Browse Store
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Perks Section */}
            {perks.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-pink-400" />
                  Active Perks
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {perks.map((perk) => {
                    const isActive = activeItems.has(perk.id)
                    const isExpired = perk.expires_at && new Date(perk.expires_at) < new Date()
                    
                    return (
                      <div key={perk.id} className="bg-zinc-900 rounded-xl p-6 border border-pink-500/20 hover:border-pink-500/40 transition-all">
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Star className="w-5 h-5 text-pink-400" />
                            <span className="text-sm text-gray-400">Perk</span>
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
                          <p className="text-gray-400 text-sm mb-2">
                            {perk.config?.description || 'No description'}
                          </p>
                          {perk.expires_at && (
                            <p className="text-xs text-gray-500">
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
                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
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
              </div>
            )}

            {/* Insurance Section */}
            {insurances.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-blue-400" />
                  Insurance Plans
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {insurances.map((ins) => {
                    const isActive = activeItems.has(ins.id)
                    const isExpired = ins.expires_at && new Date(ins.expires_at) < new Date()
                    
                    return (
                      <div key={ins.id} className="bg-zinc-900 rounded-xl p-6 border border-blue-500/20 hover:border-blue-500/40 transition-all">
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-5 h-5 text-blue-400" />
                            <span className="text-sm text-gray-400">Insurance</span>
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
                          <p className="text-gray-400 text-sm mb-2">
                            {ins.plan?.description || 'Protection plan'}
                          </p>
                          {ins.expires_at && (
                            <p className="text-xs text-gray-500">
                              Expires: {new Date(ins.expires_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="text-center py-2 bg-zinc-800 rounded text-xs text-gray-400">
                          {isActive ? 'Protection Active' : 'Protection Inactive'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Role Bonus Section */}
            {roleEffect && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Crown className="w-6 h-6 text-yellow-400" />
                  Role Bonus
                </h2>
                <div className="bg-gradient-to-r from-yellow-900/40 to-black rounded-xl p-6 border border-yellow-500/40">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-yellow-500/20 rounded-lg">
                      <Sparkles className="w-8 h-8 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-white">{roleEffect.name}</h3>
                        <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full uppercase">
                          Permanent
                        </span>
                        {activeItems.has(`role_effect_${roleEffectKey || 'default'}`) && (
                             <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">ACTIVE</span>
                        )}
                      </div>
                      <p className="text-gray-300 mb-2">{roleEffect.description}</p>
                      <div className="flex items-center gap-4 mt-4">
                        <button
                          onClick={() => toggleRoleEffect(activeItems.has(`role_effect_${roleEffectKey || 'default'}`))}
                          className={`px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                            activeItems.has(`role_effect_${roleEffectKey || 'default'}`)
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {activeItems.has(`role_effect_${roleEffectKey || 'default'}`) ? (
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
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Entrance Effects Section */}
            {entranceEffects.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-yellow-400" />
                  Entrance Effects
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {entranceEffects.map((effect) => {
                    const isActive = activeItems.has(effect.effect_id)
                    return (
                      <div key={effect.id} className="relative bg-zinc-900 rounded-xl p-6 border border-yellow-500/20 hover:border-yellow-500/40 transition-all group">
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
                            <Zap className="w-5 h-5 text-yellow-400" />
                            <span className="text-sm text-gray-400">Entrance Effect</span>
                            {isActive && (
                              <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-white mb-1">
                            {effect.config?.name || effect.effect_id}
                          </h3>
                          <p className="text-gray-400 text-sm mb-2">
                            {effect.config?.description || 'No description available'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Acquired: {new Date(effect.acquired_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleEntranceEffect(effect.effect_id, isActive)}
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
                    )
                  })}
                </div>
              </div>
            )}

            {/* Call Sounds Section */}
            {callSounds.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Phone className="w-6 h-6 text-cyan-300" />
                  Call Sounds
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {callSounds.map((sound) => {
                    const isActive = sound.is_active;
                    const catalog = sound.catalog || {};
                    return (
                      <div key={sound.sound_id} className="bg-zinc-900 rounded-xl p-6 border border-cyan-500/20 hover:border-cyan-500/40 transition-all">
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Phone className="w-5 h-5 text-cyan-300" />
                            <span className="text-sm text-gray-400">{catalog.sound_type || 'call sound'}</span>
                            {isActive && (
                              <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-white mb-1">
                            {catalog.name || 'Call Sound'}
                          </h3>
                          <p className="text-gray-400 text-sm mb-2">
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
              </div>
            )}

            {/* General Inventory Section */}
            {inventory.length > 0 && (
              <div>
                 <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Package className="w-6 h-6 text-purple-400" />
                  Items
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inventory.map((item) => {
                    const isActive = activeItems.has(item.item_id)
                    const isDigital = ['effect', 'badge', 'digital'].includes(item.marketplace_item?.type)
                    const isExpired = item.expires_at && new Date(item.expires_at) < new Date()

                    return (
                      <div key={item.id} className="relative bg-zinc-900 rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all group">
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            {getItemIcon(item.marketplace_item?.type)}
                            <span className="text-sm text-gray-400">
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

                          <p className="text-gray-400 text-sm mb-2">
                            {item.marketplace_item?.description}
                          </p>

                          <p className="text-xs text-gray-500">
                            Acquired: {new Date(item.acquired_at).toLocaleDateString()}
                          </p>
                          {item.expires_at && (
                            <p className="text-xs text-gray-500">
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
              </div>
            )}
          </div>
        )}

        {/* Digital Items Info */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C]">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            Digital Item Effects
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-purple-400">Available Effects:</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Entrance animations when joining streams</li>
                <li>• Special profile borders and frames</li>
                <li>• Animated badges and titles</li>
                <li>• Premium chat colors and styles</li>
                <li>• Troll-themed visual effects</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-purple-400">How to Use:</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Click "Activate" on digital items</li>
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
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
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

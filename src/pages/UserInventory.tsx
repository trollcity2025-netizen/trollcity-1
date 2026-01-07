import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Package, Zap, Crown, Star, Palette, CheckCircle, XCircle, Sparkles, Shield } from 'lucide-react'
import { PERK_CONFIG } from '../lib/perkSystem'
import { ENTRANCE_EFFECTS_MAP, ROLE_BASED_ENTRANCE_EFFECTS, USER_SPECIFIC_ENTRANCE_EFFECTS } from '../lib/entranceEffects'

export default function UserInventory() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [inventory, setInventory] = useState<any[]>([])
  const [entranceEffects, setEntranceEffects] = useState<any[]>([])
  const [perks, setPerks] = useState<any[]>([])
  const [insurances, setInsurances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeItems, setActiveItems] = useState<Set<string>>(new Set())

  const roleEffect = (() => {
    if (!profile) return null;

    // Check for user-specific effect first
    const userConfig = Object.entries(USER_SPECIFIC_ENTRANCE_EFFECTS).find(
      ([key]) => key.toLowerCase() === (profile.username || '').toLowerCase()
    )?.[1];
    
    if (userConfig) return { ...userConfig, type: 'User Exclusive' };

    const role = profile.role === 'admin' || profile.troll_role === 'admin' ? 'admin' :
                 profile.role === 'secretary' || profile.troll_role === 'secretary' ? 'secretary' :
                 profile.role === 'lead_troll_officer' || profile.troll_role === 'lead_troll_officer' || profile.is_lead_officer ? 'lead_troll_officer' :
                 profile.role === 'troll_officer' || profile.troll_role === 'troll_officer' ? 'troll_officer' : null;
    
    return role ? ROLE_BASED_ENTRANCE_EFFECTS[role] : null;
  })();

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true)

      // Parallel fetch of all inventory types
      const [
        inventoryRes,
        effectsRes,
        perksRes,
        insuranceRes,
        activeRes
      ] = await Promise.all([
        supabase.from('user_inventory').select('*').eq('user_id', user!.id).order('acquired_at', { ascending: false }),
        supabase.from('user_entrance_effects').select('*').eq('user_id', user!.id).order('purchased_at', { ascending: false }),
        supabase.from('user_perks').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('user_insurances').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('user_active_items').select('item_id').eq('user_id', user!.id)
      ]);

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
      })))

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
        if (roleEffect) newSet.delete(`role_effect_${roleEffect.id || 'default'}`);

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
      const roleEffectId = `role_effect_${roleEffect.id || 'default'}`;

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
      if (activeItems.has(itemId)) {
        // Deactivate
        const { error } = await supabase
          .from('user_active_items')
          .delete()
          .eq('user_id', user!.id)
          .eq('item_id', itemId)

        if (error) throw error

        setActiveItems(prev => {
          const newSet = new Set(prev)
          newSet.delete(itemId)
          return newSet
        })

        toast.success('Item deactivated')
      } else {
        // Check if we can activate this type (some items might have limits)
        if (itemType === 'effect' || itemType === 'badge') {
          // Allow multiple of these
          const { error } = await supabase
            .from('user_active_items')
            .insert({
              user_id: user!.id,
              item_id: itemId,
              item_type: itemType
            })

          if (error) throw error

          setActiveItems(prev => new Set([...prev, itemId]))
          toast.success('Item activated!')
        } else {
          // For other types, might have single activation limit
          toast.info('This item type has special activation rules')
        }
      }
    } catch (err) {
      console.error('Error toggling item:', err)
      toast.error('Failed to toggle item')
    }
  }

  const togglePerk = async (perkId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('user_active_items')
        .delete()
        .eq('user_id', user!.id)
        .eq('item_id', perkId);

      if (!isActive) {
        await supabase.from('user_active_items').insert({
          user_id: user!.id,
          item_id: perkId,
          item_type: 'perk'
        });
      }

      if (error && isActive) throw error;
      
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
      case 'perk': return <Star className="w-5 h-5 text-pink-400" />
      case 'insurance': return <CheckCircle className="w-5 h-5 text-orange-400" />
      default: return <Package className="w-5 h-5 text-gray-400" />
    }
  }

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'effect': return 'Effect'
      case 'badge': return 'Badge'
      case 'ticket': return 'Ticket'
      case 'digital': return 'Digital Item'
      case 'perk': return 'Perk'
      case 'insurance': return 'Insurance'
      default: return 'Item'
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Package className="w-8 h-8 text-purple-400" />
            My Inventory
          </h1>
          <p className="text-gray-400">Manage your purchased items and activate digital effects</p>
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
        ) : (inventory.length === 0 && entranceEffects.length === 0 && perks.length === 0 && insurances.length === 0) ? (
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
                        {activeItems.has(`role_effect_${roleEffect.id || 'default'}`) && (
                             <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">ACTIVE</span>
                        )}
                      </div>
                      <p className="text-gray-300 mb-2">{roleEffect.description}</p>
                      <div className="flex items-center gap-4 mt-4">
                        <button
                          onClick={() => toggleRoleEffect(activeItems.has(`role_effect_${roleEffect.id || 'default'}`))}
                          className={`px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                            activeItems.has(`role_effect_${roleEffect.id || 'default'}`)
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {activeItems.has(`role_effect_${roleEffect.id || 'default'}`) ? (
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
                      <div key={effect.id} className="bg-zinc-900 rounded-xl p-6 border border-yellow-500/20 hover:border-yellow-500/40 transition-all">
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

                    return (
                      <div key={item.id} className="bg-zinc-900 rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                        {/* Item Info */}
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
                        </div>

                        {/* Action Button */}
                        {isDigital ? (
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
                        ) : (
                          <div className="text-center py-3 text-gray-400">
                            <Package className="w-5 h-5 mx-auto mb-1" />
                            <p className="text-sm">Physical Item</p>
                            <p className="text-xs">Contact seller for delivery</p>
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
    </div>
  )
}

// AbilityBox - Modal showing user's broadcast abilities inventory
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Clock, Shield, Lock, Unlock } from 'lucide-react';
import {
  UserAbility,
  BroadcastActiveEffect,
  getAbilityById,
  getRarityColor,
  getRarityGlow,
  AbilityId,
  BroadcastAbility,
} from '../../types/broadcastAbilities';

interface AbilityBoxProps {
  isOpen: boolean;
  onClose: () => void;
  abilities: UserAbility[];
  activeEffects: BroadcastActiveEffect[];
  onActivate: (abilityId: AbilityId, targetUserId?: string, targetUsername?: string) => Promise<boolean>;
  getCooldownRemaining: (abilityId: AbilityId) => number;
  isEffectActive: (abilityId: AbilityId) => boolean;
  getEffectRemaining: (abilityId: AbilityId) => number;
  isInBroadcast: boolean;
  loading: boolean;
}

export default function AbilityBox({
  isOpen,
  onClose,
  abilities,
  activeEffects,
  onActivate,
  getCooldownRemaining,
  isEffectActive,
  getEffectRemaining,
  isInBroadcast,
  loading,
}: AbilityBoxProps) {
  const [selectedAbility, setSelectedAbility] = useState<BroadcastAbility | null>(null);
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  const handleActivate = async (ability: BroadcastAbility) => {
    if (ability.requiresTarget) {
      setSelectedAbility(ability);
      setShowTargetPicker(true);
    } else {
      const success = await onActivate(ability.id);
      if (success) {
        setSelectedAbility(null);
      }
    }
  };

  const handleTargetSelected = async (targetUserId: string, targetUsername: string) => {
    if (!selectedAbility) return;
    setShowTargetPicker(false);
    const success = await onActivate(selectedAbility.id, targetUserId, targetUsername);
    if (success) {
      setSelectedAbility(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-gradient-to-br from-slate-900 via-purple-950/50 to-slate-900 border-2 border-purple-500/40 rounded-2xl shadow-[0_0_60px_rgba(168,85,247,0.3)] w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-xl">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Ability Box</h2>
                <p className="text-xs text-purple-300/70">Broadcast Powers</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[60vh]">
            {abilities.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📦</div>
                <p className="text-gray-400 font-bold">No abilities yet</p>
                <p className="text-gray-500 text-sm mt-1">Win rare abilities from the Troll Wheel!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {abilities.map((userAbility) => {
                  const def = getAbilityById(userAbility.ability_id);
                  if (!def) return null;

                  const cooldownRemaining = getCooldownRemaining(userAbility.ability_id);
                  const isOnCooldown = cooldownRemaining > 0;
                  const effectActive = isEffectActive(userAbility.ability_id);
                  const effectRemaining = getEffectRemaining(userAbility.ability_id);
                  const canUse = isInBroadcast && !isOnCooldown && !loading && userAbility.quantity > 0;
                  const rarityColor = getRarityColor(def.rarity);
                  const rarityGlow = getRarityGlow(def.rarity);

                  return (
                    <motion.div
                      key={userAbility.id}
                      layout
                      className={`relative bg-slate-800/80 rounded-xl border transition-all ${
                        canUse
                          ? 'border-purple-500/40 hover:border-purple-400/70 cursor-pointer'
                          : 'border-slate-700/50'
                      }`}
                      style={effectActive ? { boxShadow: `0 0 20px ${rarityGlow}` } : {}}
                      onClick={() => canUse && handleActivate(def)}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                            style={{ background: `${def.color}20`, boxShadow: `0 0 15px ${rarityGlow}` }}
                          >
                            {def.icon}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white">{def.name}</span>
                              <span
                                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                                style={{ background: `${rarityColor}30`, color: rarityColor }}
                              >
                                {def.rarity}
                              </span>
                              {userAbility.quantity > 1 && (
                                <span className="text-[10px] font-bold bg-white/10 text-white px-2 py-0.5 rounded-full">
                                  x{userAbility.quantity}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{def.description}</p>

                            {/* Status */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {effectActive && (
                                <span className="text-[10px] font-bold bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Zap className="w-3 h-3" /> ACTIVE ({effectRemaining}s)
                                </span>
                              )}
                              {isOnCooldown && (
                                <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {cooldownRemaining}s
                                </span>
                              )}
                              {!isInBroadcast && (
                                <span className="text-[10px] font-bold bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> Join broadcast to use
                                </span>
                              )}
                              {canUse && (
                                <span className="text-[10px] font-bold bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Unlock className="w-3 h-3" /> TAP TO ACTIVATE
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Rarity glow bar at bottom */}
                      <div
                        className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                        style={{ background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)` }}
                      />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Target Picker Sub-Modal */}
        {showTargetPicker && selectedAbility && (
          <TargetPickerModal
            ability={selectedAbility}
            onSelect={handleTargetSelected}
            onCancel={() => {
              setShowTargetPicker(false);
              setSelectedAbility(null);
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// Target Picker for targeted abilities
interface TargetPickerModalProps {
  ability: BroadcastAbility;
  onSelect: (userId: string, username: string) => void;
  onCancel: () => void;
}

function TargetPickerModal({ ability, onSelect, onCancel }: TargetPickerModalProps) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        const { supabase } = await import('../../lib/supabase');
        const { data } = await supabase
          .from('user_profiles')
          .select('id, username')
          .limit(50)
          .order('username');
        if (data) setUsers(data);
      } catch (e) {
        console.warn('Failed to load users:', e);
      }
      setLoading(false);
    };
    loadUsers();
  }, []);

  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900 border-2 rounded-2xl p-4 w-full max-w-sm mx-4 max-h-[70vh] overflow-hidden flex flex-col"
        style={{ borderColor: `${ability.color}60` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{ability.icon}</span>
            <div>
              <h3 className="font-bold text-white text-sm">{ability.name}</h3>
              <p className="text-[10px] text-gray-400">Select a target user</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500 mb-3 focus:outline-none focus:border-purple-500"
        />

        <div className="overflow-y-auto flex-1 space-y-1">
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-4">Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No users found</p>
          ) : (
            filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => onSelect(user.id, user.username)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-left"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: `${ability.color}30`, color: ability.color }}
                >
                  {user.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span className="text-white text-sm font-medium">{user.username}</span>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

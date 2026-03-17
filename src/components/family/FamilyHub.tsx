// =============================================================================
// FAMILY HUB - PREMIUM FAMILY DASHBOARD
// Dark + Neon Theme with Glassmorphism Cards
// =============================================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Star, Flame, Users, MessageCircle, Phone, 
  Coins, Gift, Zap, Crown, Shield, ChevronRight,
  Lock, Unlock, Target, Award, TrendingUp, Calendar,
  Play, Radio, Video, Clock, Sparkles, ShieldCheck
} from 'lucide-react';
import { 
  useFamilyStats, 
  useAchievementTiers, 
  useFamilyAchievements, 
  useWeeklyGoals,
  useLevelUnlocks,
  useFamilyLeaderboard,
  type FamilyStats,
  type AchievementTier,
  type FamilyAchievement,
  type WeeklyGoal,
  type LevelUnlock
} from '../../hooks/useFamilyAchievementSystem';
import { useAuthStore } from '../../lib/store';
import { cn } from '../../lib/utils';

// Tier Colors
const TIER_COLORS: Record<number, string> = {
  1: '#4CAF50',
  2: '#2196F3',
  3: '#9C27B0',
  4: '#FF9800',
  5: '#E91E63',
  6: '#00BCD4',
  7: '#3F51B5',
  8: '#673AB7',
  9: '#FFC107',
  10: '#FF5722',
  11: '#9E9E9E',
  12: '#795548',
  13: '#607D8B',
  14: '#3F51B5',
  15: '#000000',
  16: '#FFD700',
};

interface FamilyHubProps {
  familyId: string;
  familyName: string;
  familyBanner?: string;
  onJoinCall?: () => void;
  onLeaveCall?: () => void;
  isInCall?: boolean;
  activeCallMembers?: number;
}

// Family Header Component
function FamilyHeader({ 
  familyName, 
  stats, 
  tier,
  banner 
}: { 
  familyName: string; 
  stats: FamilyStats | null; 
  tier: AchievementTier | null;
  banner?: string;
}) {
  const xpProgress = stats ? (stats.xp / stats.xp_to_next_level) * 100 : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Banner Background */}
      {banner && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${banner})` }}
        />
      )}
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/80 to-transparent" />
      
      {/* Content */}
      <div className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Family Avatar/Icon */}
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-bold border-4"
              style={{ 
                borderColor: tier?.tier_color || '#FFD700',
                backgroundColor: `${tier?.tier_color}20`
              }}
            >
              {tier?.tier_icon || '👑'}
            </div>
            
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                {familyName}
                {tier && (
                  <span 
                    className="px-3 py-1 rounded-full text-sm font-bold"
                    style={{ 
                      backgroundColor: `${tier.tier_color}30`,
                      color: tier.tier_color,
                      border: `1px solid ${tier.tier_color}`
                    }}
                  >
                    {tier.tier_icon} {tier.tier_name}
                  </span>
                )}
              </h1>
              <p className="text-zinc-400">Level {stats?.level || 1} Family</p>
            </div>
          </div>
          
          {/* XP Display */}
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <Zap className="text-yellow-400" size={20} />
              <span className="text-2xl font-bold text-yellow-400">
                {stats?.xp?.toLocaleString() || 0}
              </span>
            </div>
            <p className="text-zinc-500 text-sm">
              {stats?.xp_to_next_level?.toLocaleString() || 1000} to Level {(stats?.level || 1) + 1}
            </p>
          </div>
        </div>
        
        {/* XP Progress Bar */}
        <div className="mt-6">
          <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full rounded-full"
              style={{ 
                background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)'
              }}
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Active Call Panel Component
function ActiveCallPanel({ 
  onJoin, 
  onLeave, 
  isInCall,
  memberCount = 0 
}: { 
  onJoin?: () => void; 
  onLeave?: () => void; 
  isInCall?: boolean;
  memberCount?: number;
}) {
  return (
    <div className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 rounded-2xl p-6 border border-purple-500/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-14 h-14 rounded-xl flex items-center justify-center",
            isInCall ? "bg-red-500 animate-pulse" : "bg-purple-600"
          )}>
            {isInCall ? <Phone className="text-white" size={24} /> : <Phone className="text-white/50" size={24} />}
          </div>
          
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              {isInCall ? (
                <>
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Call Active
                </>
              ) : (
                'Family Call'
              )}
            </h3>
            <p className="text-purple-300 text-sm">
              {isInCall ? `${memberCount} members in call` : 'No active call'}
            </p>
          </div>
        </div>
        
        <button
          onClick={isInCall ? onLeave : onJoin}
          className={cn(
            "px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all",
            isInCall 
              ? "bg-red-500 hover:bg-red-600 text-white" 
              : "bg-purple-500 hover:bg-purple-400 text-white"
          )}
        >
          {isInCall ? (
            <>
              <Phone size={18} />
              Leave
            </>
          ) : (
            <>
              <Phone size={18} />
              Join Call
            </>
          )}
        </button>
      </div>
      
      {/* Animated Background Effect */}
      {isInCall && (
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/10 to-transparent animate-pulse" />
        </div>
      )}
    </div>
  );
}

// Achievement Progress Card
function AchievementCard({ 
  achievement, 
  isUnlocked 
}: { 
  achievement: FamilyAchievement; 
  isUnlocked: boolean;
}) {
  const progress = isUnlocked ? 100 : (achievement.progress / achievement.target) * 100;
  
  return (
    <motion.div 
      className={cn(
        "relative p-4 rounded-xl border transition-all",
        isUnlocked 
          ? "bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50" 
          : "bg-zinc-800/50 border-zinc-700"
      )}
      whileHover={{ scale: 1.02 }}
    >
      {/* Glow Effect for Completed */}
      {isUnlocked && (
        <div className="absolute inset-0 rounded-xl bg-yellow-500/10 blur-xl" />
      )}
      
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className={cn(
            "font-bold",
            isUnlocked ? "text-yellow-400" : "text-zinc-300"
          )}>
            {achievement.achievement_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
          {isUnlocked ? (
            <Award className="text-yellow-400" size={20} />
          ) : (
            <Lock className="text-zinc-500" size={20} />
          )}
        </div>
        
        {/* Progress Bar */}
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
          <motion.div 
            className={cn(
              "h-full rounded-full",
              isUnlocked ? "bg-yellow-500" : "bg-purple-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        
        <div className="flex justify-between mt-2 text-xs text-zinc-500">
          <span>{achievement.progress.toLocaleString()}</span>
          <span>{achievement.target.toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
}

// Weekly Goal Tracker
function WeeklyGoalCard({ goal }: { goal: WeeklyGoal }) {
  const progress = (goal.progress / goal.target) * 100;
  const daysLeft = Math.ceil((new Date(goal.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  const difficultyColors = {
    easy: 'bg-green-500',
    medium: 'bg-yellow-500',
    hard: 'bg-red-500',
    elite: 'bg-purple-500'
  };

  // Generate specific label based on goal category
  const getGoalLabel = () => {
    const category = goal.category || goal.goal_key;
    const target = goal.target.toLocaleString();
    const current = goal.progress.toLocaleString();
    
    // Map goal keys to specific labels
    const goalLabels: Record<string, { verb: string; noun: string }> = {
      send_messages: { verb: 'Send', noun: 'messages' },
      win_battles: { verb: 'Win', noun: 'battles' },
      earn_coins: { verb: 'Earn', noun: 'coins' },
      host_calls: { verb: 'Host', noun: 'calls' },
      invite_members: { verb: 'Invite', noun: 'members' },
      send_gifts: { verb: 'Send', noun: 'gifts' },
      total_call_minutes: { verb: 'Talk for', noun: 'minutes' },
      reach_streak: { verb: 'Maintain', noun: 'day streak' },
      earn_xp: { verb: 'Earn', noun: 'XP' },
      complete_achievements: { verb: 'Complete', noun: 'achievements' },
      total_messages: { verb: 'Send', noun: 'messages' },
      total_battle_wins: { verb: 'Win', noun: 'battles' },
      total_calls: { verb: 'Make', noun: 'calls' },
      total_coins: { verb: 'Earn', noun: 'coins' },
      total_gifts: { verb: 'Send', noun: 'gifts' },
      active_members: { verb: 'Have', noun: 'active members' },
    };
    
    const label = goalLabels[category] || goalLabels[goal.goal_key] || { verb: 'Complete', noun: 'goals' };
    
    return `${label.verb} ${target} ${label.noun}: ${current}/${target}`;
  };
  
  // Icon based on category
  const getGoalIcon = () => {
    const category = goal.category || goal.goal_key;
    if (category.includes('message') || category.includes('messages')) return <MessageCircle size={16} />;
    if (category.includes('battle')) return <Trophy size={16} />;
    if (category.includes('coin')) return <Coins size={16} />;
    if (category.includes('call')) return <Phone size={16} };
    if (category.includes('invite') || category.includes('member')) return <Users size={16} />;
    if (category.includes('gift')) return <Gift size={16} />;
    if (category.includes('streak') || category.includes('active')) return <Flame size={16} />;
    return <Target size={16} />;
  };

  return (
    <motion.div 
      className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700"
      whileHover={{ scale: 1.01 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-white font-bold">{goal.title}</h4>
          <p className="text-zinc-400 text-sm">{goal.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-bold uppercase",
            difficultyColors[goal.difficulty as keyof typeof difficultyColors]
          )}>
            {goal.difficulty}
          </span>
          {goal.completed && (
            <ShieldCheck className="text-green-400" size={20} />
          )}
        </div>
      </div>
      
      {/* Progress */}
      <div className="mb-2">
        <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
          <motion.div 
            className={cn(
              "h-full rounded-full",
              goal.completed ? "bg-green-500" : "bg-gradient-to-r from-purple-500 to-pink-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      <div className="flex justify-between items-center text-sm">
        <span className="text-purple-300 font-medium">
          {getGoalIcon()}
          <span className="ml-2">{getGoalLabel()}</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="text-yellow-400 flex items-center gap-1">
            <Zap size={14} /> {goal.xp_reward} XP
          </span>
          <span className="text-green-400 flex items-center gap-1">
            <Coins size={14} /> {goal.coin_reward}
          </span>
          {!goal.completed && (
            <span className="text-zinc-500 flex items-center gap-1">
              <Clock size={14} /> {daysLeft}d left
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Member List Item
function MemberItem({ 
  username, 
  avatar, 
  role, 
  contribution 
}: { 
  username: string; 
  avatar?: string; 
  role: string;
  contribution?: number;
}) {
  const roleColors: Record<string, string> = {
    leader: 'text-yellow-400 border-yellow-400',
    co_leader: 'text-purple-400 border-purple-400',
    member: 'text-zinc-400 border-zinc-400'
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
        {avatar ? (
          <img src={avatar} alt={username} className="w-full h-full rounded-full object-cover" />
        ) : (
          username[0]?.toUpperCase()
        )}
      </div>
      
      <div className="flex-1">
        <p className="text-white font-medium">{username}</p>
        <p className={cn("text-xs uppercase", roleColors[role] || roleColors.member)}>
          {role.replace('_', ' ')}
        </p>
      </div>
      
      {contribution !== undefined && (
        <div className="text-right">
          <p className="text-yellow-400 font-bold">{contribution.toLocaleString()}</p>
          <p className="text-zinc-500 text-xs">contribution</p>
        </div>
      )}
    </div>
  );
}

// Level Unlock Badge
function LevelUnlockBadge({ unlock }: { unlock: LevelUnlock }) {
  return (
    <motion.div 
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-zinc-800 to-zinc-700 border border-zinc-600"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <span className="text-2xl">{unlock.icon}</span>
      <div>
        <p className="text-white font-bold text-sm">{unlock.unlock_name}</p>
        <p className="text-zinc-400 text-xs">{unlock.unlock_description}</p>
      </div>
    </motion.div>
  );
}

// Main Family Hub Component
export default function FamilyHub({ 
  familyId, 
  familyName, 
  familyBanner,
  onJoinCall,
  onLeaveCall,
  isInCall = false,
  activeCallMembers = 0
}: FamilyHubProps) {
  const { user } = useAuthStore();
  const { stats, loading: statsLoading } = useFamilyStats(familyId);
  const { tiers, loading: tiersLoading } = useAchievementTiers();
  const { achievements, loading: achievementsLoading } = useFamilyAchievements(familyId);
  const { goals, loading: goalsLoading } = useWeeklyGoals(familyId);
  const { unlocks, loading: unlocksLoading } = useLevelUnlocks(stats?.level || 1);
  const { leaderboard, loading: leaderboardLoading } = useFamilyLeaderboard(10);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'goals' | 'leaderboard'>('overview');
  const [showSecrets, setShowSecrets] = useState(false);

  // Get current tier info
  const currentTier = tiers.find(t => t.tier_number === (stats?.current_tier || 1));

  // Loading state
  if (statsLoading || tiersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Family Header */}
        <FamilyHeader 
          familyName={familyName}
          stats={stats}
          tier={currentTier}
          banner={familyBanner}
        />

        {/* Call Panel */}
        <ActiveCallPanel 
          onJoin={onJoinCall}
          onLeave={onLeaveCall}
          isInCall={isInCall}
          memberCount={activeCallMembers}
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            icon={<MessageCircle className="text-blue-400" size={24} />}
            label="Messages"
            value={stats?.total_messages?.toLocaleString() || 0}
            color="blue"
          />
          <StatCard 
            icon={<Phone className="text-purple-400" size={24} />}
            label="Calls"
            value={stats?.total_calls?.toLocaleString() || 0}
            color="purple"
          />
          <StatCard 
            icon={<Trophy className="text-yellow-400" size={24} />}
            label="Battle Wins"
            value={stats?.total_battle_wins?.toLocaleString() || 0}
            color="yellow"
          />
          <StatCard 
            icon={<Flame className="text-orange-400" size={24} />}
            label="Day Streak"
            value={stats?.current_streak || 0}
            color="orange"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: <TrendingUp size={18} /> },
            { id: 'achievements', label: 'Achievements', icon: <Award size={18} /> },
            { id: 'goals', label: 'Weekly Goals', icon: <Target size={18} /> },
            { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={18} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all",
                activeTab === tab.id
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                  : "bg-zinc-800/50 text-zinc-400 border border-zinc-700 hover:bg-zinc-800"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* Unlocked Features */}
              <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="text-yellow-400" />
                  Unlocked Features
                </h3>
                <div className="space-y-2">
                  {unlocks.map(unlock => (
                    <LevelUnlockBadge key={unlock.level} unlock={unlock} />
                  ))}
                  {unlocks.length === 0 && (
                    <p className="text-zinc-500">Reach higher levels to unlock features!</p>
                  )}
                </div>
              </div>

              {/* Recent Achievements */}
              <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Award className="text-purple-400" />
                  Recent Achievements
                </h3>
                <div className="space-y-2">
                  {achievements.slice(0, 5).map(ach => (
                    <AchievementCard 
                      key={ach.id} 
                      achievement={ach} 
                      isUnlocked={ach.completed} 
                    />
                  ))}
                  {achievements.length === 0 && (
                    <p className="text-zinc-500">Start playing to unlock achievements!</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'achievements' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Achievements</h3>
                <button
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="text-sm text-zinc-400 hover:text-white"
                >
                  {showSecrets ? 'Hide Secrets' : 'Show Secrets'}
                </button>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievements.map(ach => (
                  <AchievementCard 
                    key={ach.id} 
                    achievement={ach} 
                    isUnlocked={ach.completed} 
                  />
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'goals' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Target className="text-green-400" />
                  Weekly Goals
                </h3>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Calendar size={18} />
                  <span>Week {goals[0]?.week_number || 0}</span>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {goals.map(goal => (
                  <WeeklyGoalCard key={goal.id} goal={goal} />
                ))}
                {goals.length === 0 && (
                  <div className="col-span-full text-center py-8 text-zinc-500">
                    <Target size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No active weekly goals</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'leaderboard' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Trophy className="text-yellow-400" />
                Family Leaderboard
              </h3>
              
              <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
                {leaderboard.map((entry, index) => (
                  <div 
                    key={entry.family_id}
                    className={cn(
                      "flex items-center gap-4 p-4 border-b border-zinc-800 last:border-0",
                      entry.family_id === familyId && "bg-yellow-500/10"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                      index === 0 && "bg-yellow-500 text-black",
                      index === 1 && "bg-gray-400 text-black",
                      index === 2 && "bg-orange-600 text-white",
                      index > 2 && "bg-zinc-700 text-zinc-300"
                    )}>
                      {index + 1}
                    </div>
                    
                    <div className="flex-1">
                      <p className="font-bold text-white">{entry.family_name}</p>
                      <p className="text-sm text-zinc-400">Level {entry.level} • {entry.member_count} members</p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-yellow-400 font-bold">{entry.xp?.toLocaleString()}</p>
                      <p className="text-xs text-zinc-500">XP</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
  };

  return (
    <motion.div 
      className={cn(
        "p-4 rounded-xl border bg-gradient-to-br",
        colorClasses[color]
      )}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-zinc-400">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default FamilyHub;

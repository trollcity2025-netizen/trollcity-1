import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  MessageSquare,
  Radio,
  Gift,
  Coins,
  Users,
  Shield,
  LayoutDashboard,
  Banknote,
  FileText,
  UserCheck,
  ListChecks,
  Receipt,
  Sword,
  UserPlus,
  Bug,
  Store,
  Crown,
  Mic,
} from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { supabase, isAdminEmail } from '../lib/supabase'

export default function Sidebar() {
  const { profile, user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const isActive = (path: string) => location.pathname === path

  // Real-time wallet state
  const [walletData, setWalletData] = useState({
    paid_coins: profile?.paid_coin_balance || 0,
    trollmonds: 0, // Will be loaded from wallets table if exists
  })

  const badge =
    profile?.role === 'admin'
      ? '🛡️'
      : profile?.tier && ['gold', 'platinum', 'diamond'].includes(profile.tier)
      ? '⭐'
      : null

  const [canSeeOfficer, setCanSeeOfficer] = useState(false)
  const [canSeeFamilyLounge, setCanSeeFamilyLounge] = useState(false)
  const isAdmin = profile?.role === 'admin'

  // Real-time wallet updates
  useEffect(() => {
    if (!user || !profile) return

    const loadWalletData = async () => {
      try {
        // Load from wallets table if it exists
        const { data: wallet } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .single()

        if (wallet) {
          setWalletData({
            paid_coins: (wallet as any).paid_coins || profile.paid_coin_balance || 0,
            trollmonds: (wallet as any).trollmonds || 0,
          })
        } else {
          // Fallback to profile data
          setWalletData({
            paid_coins: profile.paid_coin_balance || 0,
            trollmonds: 0,
          })
        }
      } catch (error) {
        // Wallets table might not exist, use profile data
        setWalletData({
          paid_coins: profile.paid_coin_balance || 0,
          trollmonds: 0,
        })
      }
    }

    loadWalletData()

    // Realtime Supabase listener for wallet updates
    const channel = supabase
      .channel("wallet_updates_sidebar")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
            const wallet = payload.new as any
            setWalletData({
              paid_coins: wallet.paid_coins || profile.paid_coin_balance || 0,
              trollmonds: wallet.trollmonds || 0,
            })
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
            const profileData = payload.new as any
            setWalletData(prev => ({
              ...prev,
              paid_coins: profileData.paid_coin_balance || prev.paid_coins,
            }))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, profile?.id, profile?.paid_coin_balance])

  useEffect(() => {
    const checkAccess = async () => {
      if (!profile) { 
        setCanSeeOfficer(false)
        setCanSeeFamilyLounge(false)
        return 
      }
      
      const isAdmin = profile.role === 'admin'
      const isOfficer = profile.role === 'troll_officer'
      
      // Troll Officer Lounge: Only admin and troll_officer role
      setCanSeeOfficer(isAdmin || isOfficer)

      // Troll Family Lounge: Admin, troll_officer, OR approved family application
      if (isAdmin || isOfficer) { 
        setCanSeeFamilyLounge(true)
        return 
      }
      
      // Check if user has an approved family application
      try {
        const { data: familyApp } = await supabase
          .from('applications')
          .select('status')
          .eq('user_id', profile.id)
          .eq('type', 'family')
          .eq('status', 'approved')
          .maybeSingle()

        setCanSeeFamilyLounge(!!familyApp)
      } catch {
        setCanSeeFamilyLounge(false)
      }
    }
    checkAccess()
  }, [profile?.id, profile?.role])

  if (!user) return null

  return (
    <div className="w-64 min-h-screen bg-[#0A0A14] text-white flex flex-col border-r border-[#2C2C2C] shadow-xl">

      {/* Profile Block with Real-time Wallet */}
      <div className="p-5 text-center border-b border-[#2C2C2C]">
        <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-4 border-purple-500 shadow-lg">
          <img
            src={
              profile?.avatar_url ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username || 'user'}`
            }
            alt="avatar"
            className="w-full h-full object-cover"
          />
        </div>

        <p className="mt-3 font-bold text-lg flex items-center justify-center gap-2">
          @{profile?.username || 'Guest'}
          {badge && <span className="text-yellow-400">{badge}</span>}
        </p>

        <p className="text-xs text-gray-400">
          {profile?.role === 'admin' ? 'Admin' : profile?.role === 'troll_officer' ? 'Troll Officer' : 'Member'}
        </p>

        {/* Real-time Wallet Section */}
        <div className="mt-4 space-y-2">
          {/* TROLL COINS */}
          <div
            onClick={() => navigate("/earnings")}
            className="flex items-center justify-between bg-[#1C1C24] px-3 py-2 rounded-lg border border-green-500/40 text-green-300 cursor-pointer hover:bg-[#252530] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">💰</span>
              <span className="text-sm font-semibold">Troll Coins</span>
            </div>
            <span className="font-bold">
              {walletData.paid_coins?.toLocaleString() ?? 0}
            </span>
          </div>

          {/* TROLLMONDS */}
          <div
            onClick={() => navigate("/trollmond-store")}
            className="flex items-center justify-between bg-[#1C1C24] px-3 py-2 rounded-lg border border-green-500/40 text-green-300 cursor-pointer hover:bg-[#252530] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">💎</span>
              <span className="text-sm font-semibold">Trollmonds</span>
            </div>
            <span className="font-bold">
              {walletData.trollmonds?.toLocaleString() ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 p-4 space-y-1">
        <MenuLink to="/" icon={<Home />} label="Home" active={isActive('/')} />
        <MenuLink to="/messages" icon={<MessageSquare />} label="Messages" active={isActive('/messages')} />
        <MenuLink to="/following" icon={<UserCheck />} label="Following" active={isActive('/following')} />
        <MenuLink to="/store" icon={<Coins />} label="Coin Store" active={isActive('/store')} />
        <MenuLink to="/transactions" icon={<Receipt />} label="Transactions" active={isActive('/transactions')} />
        <MenuLink to="/shop-partner" icon={<Store />} label="Sell on Troll City" active={isActive('/shop-partner')} />
        <MenuLink to="/shop-dashboard" icon={<Store />} label="Shop Earnings" active={isActive('/shop-dashboard')} />
        <MenuLink to="/creator-contract" icon={<Crown />} label="TrollTract" active={isActive('/creator-contract')} />
        <MenuLink to="/creator-dashboard" icon={<LayoutDashboard />} label="Creator Dashboard" active={isActive('/creator-dashboard')} />

        <MenuLink to="/leaderboard" icon={<span className="inline-block w-5 h-5">🏆</span>} label="Leaderboard" active={isActive('/leaderboard')} />
        <MenuLink to="/wall" icon={<span className="inline-block w-5 h-5">🧌</span>} label="Troll City Wall" active={isActive('/wall')} />

        <MenuLink to="/go-live" icon={<Radio />} label="Go Live" active={isActive('/go-live')} />
        <MenuLink to="/tromody" icon={<Mic />} label="Tromody Show" active={isActive('/tromody')} />
        <MenuLink to="/battles" icon={<Sword />} label="Battle History" active={isActive('/battles')} />
        <MenuLink to="/empire-partner" icon={<UserPlus />} label="Empire Partner" active={isActive('/empire-partner')} />
        <MenuLink to="/trollifications" icon={<Gift />} label="Trollifications" active={isActive('/trollifications')} />
        <MenuLink to="/troll-wheel" icon={<span className="inline-block w-5 h-5">🎡</span>} label="Troll Wheel" active={isActive('/troll-wheel')} />
        
        {/* Applications - Show for everyone */}
        <MenuLink to="/apply" icon={<FileText />} label="Applications" active={isActive('/apply')} />

        {/* Troll Officer Lounge - Only for admin and troll_officer role */}
        {canSeeOfficer && (
          <>
            <MenuLink to="/officer/lounge" icon={<Shield />} label="Officer Lounge" active={isActive('/officer/lounge')} />
            <MenuLink to="/officer/moderation" icon={<Shield />} label="Officer Moderation" active={isActive('/officer/moderation')} />
          </>
        )}

        {/* Troll Family Lounge - Only for admin, troll_officer, OR approved family app */}
        {canSeeFamilyLounge && (
          <MenuLink to="/family" icon={<Users />} label="Troll Family Lounge" active={isActive('/family')} />
        )}

        <MenuLink to="/earnings" icon={<Banknote />} label="Earnings" active={isActive('/earnings') || isActive('/my-earnings')} />
        <MenuLink to="/support" icon={<FileText />} label="Support" active={isActive('/support')} />
        <MenuLink to="/safety" icon={<Shield />} label="Safety & Policies" active={isActive('/safety')} />

        {/* 🔐 RFC — Only Admin */}
        {profile?.role === 'admin' && (
          <MenuLink to="/rfc" icon={<Shield />} label="RFC" active={isActive('/rfc')} />
        )}

        {/* Admin Earnings Dashboard — Only Admin */}
        {profile?.role === 'admin' && (
          <MenuLink to="/admin/earnings" icon={<Banknote />} label="Earnings Dashboard" active={isActive('/admin/earnings')} />
        )}
      </nav>

      {/* Lead Officer Section — Only Lead Officers */}
      {profile?.is_lead_officer && (
        <div className="p-4 border-t border-[#2C2C2C]">
          <p className="text-gray-500 uppercase text-xs mb-2">Lead Officer</p>
          <MenuLink to="/lead-officer" icon={<Shield />} label="Lead Officer HQ" active={isActive('/lead-officer')} />
        </div>
      )}

      {/* Admin Dashboard — Only Admin */}
      {profile?.role === 'admin' && (
        <div className="p-4 border-t border-[#2C2C2C]">
          <p className="text-gray-500 uppercase text-xs mb-2">Admin Controls</p>
          <MenuLink to="/admin" icon={<LayoutDashboard />} label="Admin Dashboard" active={isActive('/admin')} />
          <MenuLink to="/admin/officer-reports" icon={<FileText />} label="Officer Reports" active={isActive('/admin/officer-reports')} />
          <MenuLink to="/store-debug" icon={<Bug />} label="Store Debug" active={isActive('/store-debug')} />
          <MenuLink to="/changelog" icon={<ListChecks />} label="Updates & Changes" active={isActive('/changelog')} />
        </div>
      )}

    </div>
  )
}

function MenuLink({ to, icon, label, active }: any) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
        active
          ? 'bg-purple-600 text-white border border-purple-400'
          : 'hover:bg-[#1F1F2E] text-gray-300'
      }`}
    >
      <span className="w-5 h-5">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

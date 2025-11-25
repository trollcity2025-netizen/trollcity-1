import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { Users, Crown, UploadCloud, Star } from 'lucide-react'

interface Family {
  id: string
  name: string
  icon_emoji: string | null
  banner_url: string | null
  description: string | null
  level: number
  total_points: number
}

interface FamilyMember {
  id: string
  user_id: string
  role: 'leader' | 'co-leader' | 'member'
  contribution_points: number
  profiles?: {
    username: string
    avatar_url: string | null
    has_crown_badge: boolean
  }
}

export default function FamilyProfilePage() {
  const { user } = useAuthStore()
  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingBanner, setUploadingBanner] = useState(false)

  const isLeader =
    members.find((m) => m.user_id === user?.id)?.role === 'leader' ||
    members.find((m) => m.user_id === user?.id)?.role === 'co-leader'

  useEffect(() => {
    if (!user) return
    loadFamily()
  }, [user])

  const loadFamily = async () => {
    setLoading(true)

    // 1) Find user's family
    const { data: member, error: memberErr } = await supabase
      .from('troll_family_members')
      .select('family_id')
      .eq('user_id', user!.id)
      .single()

    if (memberErr || !member?.family_id) {
      setFamily(null)
      setMembers([])
      setLoading(false)
      return
    }

    // 2) Load family info
    const { data: fam, error: famErr } = await supabase
      .from('troll_families')
      .select('*')
      .eq('id', member.family_id)
      .single()

    if (famErr || !fam) {
      setFamily(null)
      setMembers([])
      setLoading(false)
      return
    }

    setFamily(fam as Family)

    // 3) Load family members
    const { data: memberList, error: membersErr } = await supabase
      .from('troll_family_members')
      .select(
        `
        id,
        user_id,
        role,
        contribution_points,
        user_profiles:user_id (
          username,
          avatar_url,
          has_crown_badge
        )
      `
      )
      .eq('family_id', fam.id)
      .order('role', { ascending: true })

    if (membersErr) {
      console.error(membersErr)
      setMembers([])
    } else {
      setMembers((memberList || []) as unknown as FamilyMember[])
    }

    setLoading(false)
  }

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!family) return
      const file = event.target.files?.[0]
      if (!file) return

      setUploadingBanner(true)

      const fileExt = file.name.split('.').pop()
      const fileName = `${family.id}-${Date.now()}.${fileExt}`
      const filePath = `banners/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('family-banners')
        .upload(filePath, file)

      if (uploadError) {
        console.error(uploadError)
        toast.error('Failed to upload banner')
        setUploadingBanner(false)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('family-banners').getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('troll_families')
        .update({ banner_url: publicUrl })
        .eq('id', family.id)

      if (updateError) {
        console.error(updateError)
        toast.error('Failed to update banner')
      } else {
        toast.success('Banner updated')
        setFamily({ ...family, banner_url: publicUrl })
      }
    } finally {
      setUploadingBanner(false)
    }
  }

  const getRankName = (points: number) => {
    if (points >= 5000) return 'Royal Family'
    if (points >= 2500) return 'Diamond Clan'
    if (points >= 1500) return 'Platinum Squad'
    if (points >= 750) return 'Gold Tribe'
    if (points >= 300) return 'Silver House'
    return 'Bronze Family'
  }

  if (loading) {
    return (
      <div className="min-h-screen tc-cosmic-bg text-white flex items-center justify-center">
        <div className="loading-pulse text-lg">Loading family...</div>
      </div>
    )
  }

  if (!family) {
    return (
      <div className="min-h-screen tc-cosmic-bg text-white flex items-center justify-center">
        <div className="troll-card p-6 max-w-md text-center">
          <h2 className="text-xl font-bold mb-2">No Troll Family Yet</h2>
          <p className="text-gray-300 text-sm">
            Join a Troll Family from the Families section to unlock Troll Family City,
            crowns, ranks, and weekly rewards.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen tc-cosmic-bg text-white p-6">
      {/* Banner */}
      <div className="relative mb-6">
        {family.banner_url ? (
          <img
            src={family.banner_url}
            alt="Family Banner"
            className="w-full h-40 object-cover rounded-2xl shadow-troll-glow"
          />
        ) : (
          <div className="w-full h-40 rounded-2xl troll-card flex items-center justify-center text-gray-400 text-sm">
            No banner set yet.
          </div>
        )}

        {isLeader && (
          <label className="absolute bottom-3 right-3 bg-black/70 rounded-full px-3 py-1 text-xs flex items-center gap-1 cursor-pointer gaming-button-pink">
            <UploadCloud size={14} />
            {uploadingBanner ? 'Uploading...' : 'Change Banner'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerUpload}
              disabled={uploadingBanner}
            />
          </label>
        )}
      </div>

      {/* Family Header */}
      <div className="troll-card p-4 mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{family.icon_emoji || '👹'}</span>
            <h1 className="text-2xl font-extrabold">{family.name}</h1>
          </div>
          <div className="text-sm text-gray-300 mt-1">
            Level {family.level} • {getRankName(family.total_points)}
          </div>
          {family.description && (
            <p className="text-xs text-gray-400 mt-1">{family.description}</p>
          )}
        </div>

        <div className="text-right text-sm">
          <div className="flex items-center justify-end gap-1 text-yellow-300">
            <Crown size={16} />
            Weekly Crown Eligible
          </div>
          <div className="flex items-center justify-end gap-1 text-purple-300 text-xs mt-1">
            <Star size={14} /> {family.total_points.toLocaleString()} family points
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="troll-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} />
          <h2 className="font-semibold">Family Members</h2>
        </div>

        {members.length === 0 ? (
          <p className="text-gray-300 text-sm">No members found.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-black/40 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                    {m.profiles?.avatar_url ? (
                      <img
                        src={m.profiles.avatar_url}
                        alt={m.profiles.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-300">
                        {m.profiles?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-purple-200">
                        {m.profiles?.username || 'Unknown'}
                      </span>
                      {m.role === 'leader' && (
                        <span className="neon-pill neon-pill-red text-[9px]">Leader</span>
                      )}
                      {m.role === 'co-leader' && (
                        <span className="neon-pill neon-pill-blue text-[9px]">
                          Co-Leader
                        </span>
                      )}
                      {m.profiles?.has_crown_badge && (
                        <span className="neon-pill neon-pill-gold text-[9px] flex items-center gap-1">
                          👑 Crowned
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      Contribution:{' '}
                      <span className="text-green-400">
                        {m.contribution_points.toLocaleString()} pts
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-400 text-right">
                  <div>Role: {m.role}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

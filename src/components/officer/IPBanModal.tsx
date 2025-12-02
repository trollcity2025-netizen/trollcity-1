import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { X, AlertTriangle } from 'lucide-react'

interface IPBanModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  targetUserId?: string
  targetUsername?: string
  targetIP?: string
}

const BAN_REASONS = [
  { value: 'nudity', label: 'Nudity / Sexual Content' },
  { value: 'fraud', label: 'Fraud / Scamming' },
  { value: 'death_threats', label: 'Death Threats' },
  { value: 'abuse', label: 'Abuse / Harassment' },
  { value: 'other', label: 'Other Violation' },
] as const

export default function IPBanModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  targetUserId,
  targetUsername,
  targetIP 
}: IPBanModalProps) {
  const { user, profile } = useAuthStore()
  const [ipAddress, setIPAddress] = useState(targetIP || '')
  const [internalTargetIP, setInternalTargetIP] = useState(targetIP || '')
  const [banReason, setBanReason] = useState<string>('abuse')
  const [banDetails, setBanDetails] = useState('')
  const [banDuration, setBanDuration] = useState<'permanent' | 'temporary'>('permanent')
  const [temporaryDays, setTemporaryDays] = useState(7)
  const [banning, setBanning] = useState(false)

  const handleBan = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in')
      return
    }

    // Officers can ban IPs but can't see them - only admins can see IP addresses
    if (!profile.is_admin && !profile.is_troll_officer) {
      toast.error('Only troll officers and admins can ban IP addresses')
      return
    }

    // For officers, use internalTargetIP if available, otherwise require admin to enter IP
    let ipToBan = ''
    
    if (!profile.is_admin) {
      // Officers can't see IPs, but can ban using internalTargetIP if provided
      if (internalTargetIP) {
        ipToBan = internalTargetIP
      } else {
        toast.error('IP address is required. Only admins can view and enter IP addresses.')
        return
      }
    } else {
      // Admins must enter IP address
      if (!ipAddress.trim()) {
        toast.error('Please enter an IP address')
        return
      }

      // Validate IP address format (only for admins)
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
      if (!ipRegex.test(ipAddress.trim())) {
        toast.error('Invalid IP address format')
        return
      }
      
      ipToBan = ipAddress.trim()
    }

    if (!banReason) {
      toast.error('Please select a ban reason')
      return
    }

    // No confirmation - proceed directly

    setBanning(true)
    try {
      // Calculate banned_until date
      let bannedUntil: string | null = null
      if (banDuration === 'temporary') {
        const untilDate = new Date()
        untilDate.setDate(untilDate.getDate() + temporaryDays)
        bannedUntil = untilDate.toISOString()
      }

      const { data, error } = await supabase.rpc('ban_ip_address', {
        p_ip_address: ipToBan,
        p_ban_reason: banReason,
        p_officer_id: user.id,
        p_ban_details: banDetails.trim() || null,
        p_banned_until: bannedUntil
      })

      if (error) throw error

      if (data?.success) {
        const displayIP = profile.is_admin ? ipToBan : '***.***.***.***'
        toast.success(`IP address ${displayIP} banned successfully${data.affected_users ? ` (${data.affected_users} users affected)` : ''}`)
        onSuccess()
        onClose()
        // Reset form
        setIPAddress('')
        setBanReason('abuse')
        setBanDetails('')
        setBanDuration('permanent')
        setTemporaryDays(7)
      } else {
        toast.error(data?.error || 'Failed to ban IP address')
      }
    } catch (error: any) {
      console.error('Error banning IP:', error)
      toast.error(error?.message || 'Failed to ban IP address')
    } finally {
      setBanning(false)
    }
  }

  // Fetch user's IP if targetUserId is provided (only for admins to see, but officers can still ban)
  useEffect(() => {
    if (targetUserId && !targetIP && isOpen) {
      supabase
        .from('user_profiles')
        .select('last_known_ip')
        .eq('id', targetUserId)
        .single()
        .then(({ data }) => {
          if (data?.last_known_ip) {
            // Only set IPAddress for admins to see
            if (profile?.is_admin) {
              setIPAddress(data.last_known_ip)
            }
            // Always set internalTargetIP for banning (officers can use it but won't see it)
            setInternalTargetIP(data.last_known_ip)
          }
        })
    }
  }, [targetUserId, targetIP, isOpen, profile?.is_admin])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center p-6 z-50">
      <div className="bg-[#08010A] p-6 rounded-xl border border-purple-600 w-full max-w-md shadow-[0_0_40px_rgba(130,0,200,0.6)]">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-red-400" size={24} />
            <h2 className="text-xl font-bold text-purple-400">Ban IP Address</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {targetUsername && (
          <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500 rounded-lg">
            <p className="text-sm text-yellow-400">
              Banning IP for user: <strong>{targetUsername}</strong>
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              IP Address *
            </label>
            {profile?.is_admin ? (
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIPAddress(e.target.value)}
                placeholder="192.168.1.1"
                className="w-full bg-black/50 border border-purple-600 p-3 rounded-lg text-sm text-white placeholder-gray-500"
                disabled={!!targetIP}
              />
            ) : (
              <div className="w-full bg-black/50 border border-purple-600 p-3 rounded-lg text-sm text-gray-500">
                IP addresses are only visible to admins. You can still ban this user's IP.
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Ban Reason *
            </label>
            <select
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              className="w-full bg-black/50 border border-purple-600 p-3 rounded-lg text-sm text-white"
            >
              {BAN_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Additional Details
            </label>
            <textarea
              value={banDetails}
              onChange={(e) => setBanDetails(e.target.value)}
              placeholder="Provide additional context about the violation..."
              rows={3}
              className="w-full bg-black/50 border border-purple-600 p-3 rounded-lg text-sm text-white placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Ban Duration
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="permanent"
                  checked={banDuration === 'permanent'}
                  onChange={(e) => setBanDuration(e.target.value as 'permanent')}
                  className="text-purple-600"
                />
                <span className="text-sm text-gray-300">Permanent Ban</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="temporary"
                  checked={banDuration === 'temporary'}
                  onChange={(e) => setBanDuration(e.target.value as 'temporary')}
                  className="text-purple-600"
                />
                <span className="text-sm text-gray-300">Temporary Ban</span>
                {banDuration === 'temporary' && (
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={temporaryDays}
                    onChange={(e) => setTemporaryDays(parseInt(e.target.value) || 7)}
                    className="ml-2 w-20 bg-black/50 border border-purple-600 p-1 rounded text-sm text-white"
                  />
                )}
                {banDuration === 'temporary' && (
                  <span className="text-xs text-gray-400">days</span>
                )}
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBan}
              disabled={banning || (!profile?.is_admin && !targetIP) || (profile?.is_admin && !ipAddress.trim()) || !banReason}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {banning ? 'Banning...' : 'Ban IP Address'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


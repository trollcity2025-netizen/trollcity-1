import React, { useState } from 'react'
import { LiveKitRoomWrapper } from '../LiveKitVideoGrid'
import { UserRole } from '../LiveKitRoles'
import { ChevronRight, CircleDot, Gift, Mic, Power, Settings, Users, Video } from 'lucide-react'
import { toast } from 'sonner'

export function StreamHeader({
  title,
  hostName,
  viewers,
  statusLabel,
  connectionColor = 'text-green-300',
  avatarUrl,
  statusDetail,
}: {
  title?: string
  hostName?: string
  viewers?: number
  statusLabel: string
  connectionColor?: string
  avatarUrl?: string
  statusDetail?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-purple-600/40 bg-gradient-to-r from-[#0a0214] to-[#13001f] p-5 shadow-[0_30px_60px_rgba(44,5,80,0.45)]">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 overflow-hidden rounded-full border border-purple-500/40 bg-[#0f041c] shadow-[0_0_25px_rgba(143,76,255,0.45)]">
          {avatarUrl ? <img src={avatarUrl} alt={hostName} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.3em] text-white/70">T</div>}
        </div>
        <div>
          <div className="text-sm uppercase tracking-[0.4em] text-white/50">Trolls @ Night</div>
          <h1 className="text-2xl font-extrabold text-white">{title || 'Live Broadcast'}</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">{hostName || 'Host'}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className={`text-sm font-semibold uppercase tracking-[0.4em] ${connectionColor}`}>{statusLabel}</span>
        {statusDetail && <span className="text-xs uppercase tracking-[0.3em] text-white/60">{statusDetail}</span>}
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
          <CircleDot className="h-3 w-3 text-green-300" />
          {viewers?.toLocaleString()} viewers
        </div>
      </div>
    </div>
  )
}

export function StreamStage({
  roomName,
  identity,
  role,
  allowPublish,
  maxParticipants,
  className = '',
  isConnected,
  isConnecting,
  children,
}: {
  roomName: string
  identity: string
  role?: UserRole | 'viewer' | 'broadcaster'
  allowPublish?: boolean
  maxParticipants?: number
  className?: string
  isConnected: boolean
  isConnecting: boolean
  children?: React.ReactNode
}) {
  const _status = isConnected ? 'Connected' : isConnecting ? 'Connecting' : 'Disconnected'
  const showOverlay = !isConnected && !isConnecting

  return (
    <div className={`rounded-[32px] border border-purple-500/30 bg-gradient-to-br from-[#06010b] to-[#150027] p-4 shadow-[0_30px_90px_rgba(52,16,153,0.55)] ${className}`}>
      <div className="relative overflow-hidden rounded-[28px] border border-white/5 bg-black/80">
        <LiveKitRoomWrapper
          roomName={roomName}
          identity={identity}
          role={role || 'viewer'}
          allowPublish={allowPublish}
          autoConnect={true}
          maxParticipants={maxParticipants}
          className="h-[420px] w-full"
        />
        {showOverlay && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-black/60 text-center text-white">
            <p className="text-lg font-semibold">Waiting for connection…</p>
          </div>
        )}
        {children && (
          <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

export function StreamControlBar({
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCamera,
  onDisconnect,
  onOpenGuestPanel,
  onOpenGiftDrawer,
  onOpenMenuPanel,
  isPublishing,
}: {
  micEnabled: boolean
  cameraEnabled: boolean
  onToggleMic: () => void
  onToggleCamera: () => void
  onDisconnect: () => void
  onOpenGuestPanel?: () => void
  onOpenGiftDrawer?: () => void
  onOpenMenuPanel?: () => void
  isPublishing?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-purple-500/30 bg-[#01000b]/70 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-white shadow-[0_15px_40px_rgba(48,9,99,0.6)]">
      <button
        onClick={onToggleMic}
        className="flex items-center gap-2 rounded-full border border-white/30 bg-gradient-to-br from-purple-500/20 to-pink-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-purple-400"
      >
        <Mic className={`h-4 w-4 ${micEnabled ? 'text-emerald-300' : 'text-red-400'}`} />
        {micEnabled ? 'Mute Mic' : 'Unmute Mic'}
      </button>
      <button
        onClick={onToggleCamera}
        className="flex items-center gap-2 rounded-full border border-white/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-cyan-400"
      >
        <Video className={`h-4 w-4 ${cameraEnabled ? 'text-cyan-300' : 'text-red-400'}`} />
        {cameraEnabled ? 'Camera' : 'No Camera'}
      </button>
      <div className="flex-1" />
      <div className="flex gap-3">
        {onOpenGuestPanel && (
          <button
            onClick={onOpenGuestPanel}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
          >
            <Users className="h-3 w-3" />
            Guests
          </button>
        )}
        {onOpenGiftDrawer && (
          <button
            onClick={onOpenGiftDrawer}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
          >
            <Gift className="h-3 w-3" />
            Gifts
          </button>
        )}
        {onOpenMenuPanel && (
          <button
            onClick={onOpenMenuPanel}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
          >
            <Settings className="h-3 w-3" />
            Menu
          </button>
        )}
        <button
          onClick={onDisconnect}
          className="flex items-center gap-2 rounded-full border border-red-500/70 bg-red-500/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-red-500/50"
        >
          <Power className="h-3 w-3" />
          {isPublishing ? 'End Stream' : 'Disconnect'}
        </button>
      </div>
    </div>
  )
}

export function StreamSidePanel({
  title,
  subtitle,
  badge,
  borderHighlight = false,
  children,
}: {
  title: string
  subtitle?: string
  badge?: string
  borderHighlight?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-[28px] border ${borderHighlight ? 'border-pink-500/60' : 'border-purple-500/40'} bg-[#070115]/80 p-4 shadow-[0_30px_60px_rgba(23,6,65,0.65)]`}>
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-gray-400">
        <div>
          <span className="text-white">{title}</span>
          {subtitle && <span className="text-white/60 ml-2">{subtitle}</span>}
        </div>
        {badge && (
          <span className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white">{badge}</span>
        )}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  )
}

const queueData = [
  { id: 1, username: 'Mallory', reason: 'Spamming gifts', severity: 'Medium', time: '00:14', avatar: '' },
  { id: 2, username: 'LordOfCoins', reason: 'Inappropriate language', severity: 'High', time: '00:03', avatar: '' },
]

const actions = ['Warn', 'Mute', 'Timeout', 'Ban']

const logs = [
  { id: 1, text: 'Warned user Mallory for excessive spam', time: 'few seconds ago' },
  { id: 2, text: 'Muted LordOfCoins for 2m', time: '1m ago' },
]

export function TrollmodShowPanel() {
  const tabs = ['Queue', 'Actions', 'Logs', 'Settings']
  const [activeTab, setActiveTab] = useState('Queue')

  return (
    <div className="rounded-[28px] border border-yellow-400/30 bg-[#06000f]/90 p-4 shadow-[0_30px_80px_rgba(255,154,43,0.25)]">
      <div className="flex flex-wrap items-center gap-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] transition ${
              activeTab === tab
                ? 'border border-yellow-400/80 bg-yellow-400/20 text-yellow-200'
                : 'border border-purple-500/30 text-white/60 hover:border-white/40'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {activeTab === 'Queue' && (
          <div className="space-y-3">
            {queueData.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 p-3">
                <div>
                  <p className="text-sm font-semibold text-white">{entry.username}</p>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">{entry.reason}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-white/60">{entry.severity}</span>
                  <span className="text-[10px] text-gray-400">{entry.time}</span>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 text-[10px] text-white/60">
              <span className="rounded-full border border-white/10 px-3 py-1">Connect queue updates</span>
              <span className="rounded-full border border-white/10 px-3 py-1">Auto-refresh</span>
            </div>
          </div>
        )}
        {activeTab === 'Actions' && (
          <div className="grid gap-2">
            {actions.map((action) => (
              <button
                key={action}
                onClick={() => window.confirm(`Confirm ${action}?`) && toast(`${action} queued`)}
                className="flex items-center justify-between rounded-2xl border border-white/15 bg-gradient-to-br from-purple-600/20 to-pink-600/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-[0_20px_40px_rgba(157,84,255,0.2)]"
              >
                <span>{action}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ))}
            <p className="text-[10px] text-yellow-300 uppercase tracking-[0.3em]">Destructive actions require confirmation.</p>
          </div>
        )}
        {activeTab === 'Logs' && (
          <div className="space-y-2 text-sm text-gray-300">
            {logs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-white/10 bg-black/50 px-3 py-2">
                <p>{log.text}</p>
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">{log.time}</div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'Settings' && (
          <div className="space-y-2 text-sm text-white/70">
            <p>Role-based gating placeholder</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">Limit actions to admins/officers</p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function ServiceWorkerUpdateBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      setShowBanner(true)
    }
  })

  if (!needRefresh && !showBanner) {
    return null
  }

  const handleRefresh = async () => {
    if (updateServiceWorker) {
      await updateServiceWorker()
      window.location.reload()
    }
  }

  return (
    <div className="fixed inset-x-4 top-4 z-50 flex items-center justify-between rounded-full border border-white/30 bg-[#0d0421]/90 px-5 py-3 shadow-2xl shadow-black/60 backdrop-blur-md text-sm text-white">
      <span>Update available – refresh to get the latest experience.</span>
      <button
        onClick={handleRefresh}
        className="rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-2 text-black font-semibold shadow-lg shadow-yellow-500/40"
      >
        Refresh now
      </button>
    </div>
  )
}

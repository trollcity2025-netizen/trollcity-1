import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      if (typeof window === 'undefined') return
      if (window.innerWidth < 1024) return

      const installEvent = event as BeforeInstallPromptEvent
      installEvent.preventDefault()
      setPromptEvent(installEvent)
      setVisible(true)
    }

    const handleInstalled = () => {
      setVisible(false)
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  if (!promptEvent || !visible) {
    return null
  }

  const handleInstall = async () => {
    setVisible(false)
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') {
      setPromptEvent(null)
    } else {
      setVisible(true)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={handleInstall}
        className="flex items-center gap-2 rounded-full border border-white/40 bg-white px-4 py-2 text-sm font-semibold text-black shadow-2xl shadow-black/40 hover:bg-gray-200 transition"
      >
        Install Troll City
        <span className="text-xs text-gray-500">Desktop</span>
      </button>
    </div>
  )
}

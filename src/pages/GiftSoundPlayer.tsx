import { useEffect } from 'react'

const soundMap: Record<string, string> = {
  blunt: '/sounds/blunt.mp3',
  lighter: '/sounds/lighter.mp3',
  savscratch: '/sounds/scratch.mp3',
  diamond: '/sounds/diamond.mp3',
  car: '/sounds/car.mp3',
  crown: '/sounds/crown.mp3',
}

export default function GiftSoundPlayer({ giftId }: { giftId: string }) {
  useEffect(() => {
    const sound = soundMap[giftId]
    if (sound) new Audio(sound).play()
  }, [giftId])

  return null
}

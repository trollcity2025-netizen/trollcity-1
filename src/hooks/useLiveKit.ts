import { useContext } from 'react'
import { LiveKitContext } from '../contexts/LiveKitContext'

export function useLiveKit() {
  const ctx = useContext(LiveKitContext)
  if (!ctx) {
    throw new Error('useLiveKit must be used within LiveKitProvider')
  }
  return ctx
}
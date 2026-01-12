import { create } from 'zustand'

export const PURCHASE_REQUIRED_MESSAGE = 'Purchase required to use this feature'

interface PurchaseGateState {
  isOpen: boolean
  reason?: string
  show: (reason?: string) => void
  hide: () => void
}

export const usePurchaseGateStore = create<PurchaseGateState>((set) => ({
  isOpen: false,
  reason: undefined,
  show: (reason?: string) => set({ isOpen: true, reason }),
  hide: () => set({ isOpen: false, reason: undefined }),
}))

export const openPurchaseGate = (reason?: string) => {
  usePurchaseGateStore.getState().show(reason)
}

export const closePurchaseGate = () => {
  usePurchaseGateStore.getState().hide()
}

export function isPurchaseRequiredError(error: any) {
  if (!error) return false
  const message =
    typeof error === 'string'
      ? error
      : error?.message || error?.error || error?.statusText || (error?.data?.error ?? error?.data?.message)

  if (!message) return false
  return message.toString().includes(PURCHASE_REQUIRED_MESSAGE)
}

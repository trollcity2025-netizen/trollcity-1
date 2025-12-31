export const connectionStatusLabel = (isConnected: boolean, isConnecting: boolean, error?: string | null) => {
  if (isConnected) return 'Connected'
  if (isConnecting) return 'Connecting'
  if (error) return 'Error'
  return 'Disconnected'
}
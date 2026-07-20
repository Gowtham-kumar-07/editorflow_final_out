'use client'

import { WifiOff } from 'lucide-react'
import { useNetwork } from '@/hooks/use-network'

export function OfflineBanner() {
  const { isOnline } = useNetwork()

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-xs text-yellow-700 dark:text-yellow-400"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>No internet connection — some features may be unavailable</span>
    </div>
  )
}

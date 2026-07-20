'use client'

import { useEffect, useState } from 'react'

interface NetworkState {
  isOnline: boolean
}

/**
 * Tracks network connectivity using standard Web APIs.
 * navigator.onLine + the 'online'/'offline' events work correctly in both
 * the Android WebView shell and all browsers — no native plugin required.
 *
 * Initial state is always `true` so the server render and the first client
 * render agree (Node.js 22+ exposes a `navigator` global whose `onLine`
 * property is undefined, which was causing a hydration mismatch). The real
 * value is read inside useEffect(), which only runs after hydration.
 */
export function useNetwork(): NetworkState {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Sync to actual status immediately after hydration, then track changes.
    setIsOnline(navigator.onLine)
    const up   = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online',  up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online',  up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return { isOnline }
}

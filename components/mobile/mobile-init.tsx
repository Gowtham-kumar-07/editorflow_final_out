'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

// The native Android WebView shell injects window.EditorFlowNative via
// addJavascriptInterface(). It is undefined in every browser context.
declare global {
  interface Window {
    EditorFlowNative?: {
      isNative(): boolean
      hideSplash(): void
      setStatusBarStyle(isDark: boolean): void
    }
  }
}

export function MobileInit() {
  const { resolvedTheme } = useTheme()

  // Remove the native splash screen once React has mounted.
  // The Android shell holds the splash on-screen until this is called
  // (or the 15-second safety timeout fires).
  useEffect(() => {
    window.EditorFlowNative?.hideSplash()
  }, [])

  // Sync status-bar icon colour with the active theme.
  useEffect(() => {
    window.EditorFlowNative?.setStatusBarStyle(resolvedTheme === 'dark')
  }, [resolvedTheme])

  return null
}

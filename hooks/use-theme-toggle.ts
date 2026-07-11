'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/components/providers/theme-provider'

export function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  function toggle() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return {
    // Expose undefined before mount so callers render a consistent placeholder.
    resolvedTheme: mounted ? resolvedTheme : undefined,
    toggle,
    mounted,
  }
}

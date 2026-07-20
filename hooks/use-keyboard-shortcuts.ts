'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Two-key shortcut: press G, then within 500ms press a letter key to navigate.
// Only fires when focus is NOT inside an input, textarea, or contenteditable.
const G_SHORTCUTS: Record<string, string> = {
  d: '/dashboard',
  c: '/clients',
  p: '/projects',
  t: '/tasks',
}

export function useKeyboardShortcuts() {
  const router   = useRouter()
  const gActive  = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()

      if (key === 'g') {
        gActive.current = true
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => { gActive.current = false }, 500)
        return
      }

      if (gActive.current && G_SHORTCUTS[key]) {
        e.preventDefault()
        gActive.current = false
        if (timerRef.current) clearTimeout(timerRef.current)
        router.push(G_SHORTCUTS[key])
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])
}

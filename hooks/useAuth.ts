'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/supabase/client'

/**
 * Provides auth helpers for use in client components.
 *
 * signOut — clears the Supabase session, redirects to /login, and calls
 * router.refresh() so Next.js Server Components re-run with no user.
 */
export function useAuth() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const signOut = useCallback(async () => {
    setIsSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } finally {
      setIsSigningOut(false)
    }
  }, [router])

  return { signOut, isSigningOut }
}

'use server'

import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Signs the current user out of Supabase and redirects to /login.
 * Clears all session cookies so the middleware immediately detects the
 * logged-out state on the next request.
 */
export async function signOutAction(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

import { createClient } from '@/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * GET /api/auth/signout
 * Signs out the current user and redirects to /login.
 * Used by the plain <a> link on the onboarding page and any other
 * non-JS context where a Server Action form submit isn't available.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.url))
}

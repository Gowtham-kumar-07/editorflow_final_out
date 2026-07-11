import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/supabase/server'
import { safeRedirect } from '@/lib/safe-redirect'

/**
 * Supabase PKCE auth callback — handles email confirmation links.
 *
 * Supabase appends ?code=<code>&next=<path> when using the emailRedirectTo
 * option with email confirmation enabled. This route exchanges the code for a
 * session and then redirects to the `next` path (safe-validated) or /dashboard.
 *
 * This route is intentionally low-overhead. It is also triggered for OAuth
 * flows if they are ever enabled, since /auth/* is treated as public by the
 * middleware (proxy.ts).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(
        new URL(safeRedirect(next, '/dashboard'), origin)
      )
    }
  }

  // Exchange failed — send back to login with an error signal
  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin))
}

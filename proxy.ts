import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'
import {
  PUBLIC_ROUTES,
  INVITE_PATH_PREFIX,
  DEFAULT_AUTHENTICATED_ROUTE,
  ONBOARDING_ROUTE,
} from '@/lib/routes'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic =
    PUBLIC_ROUTES.has(pathname) || pathname.startsWith('/auth/')

  // Invitation paths bypass both the auth-redirect guard and the org-membership
  // guard so that:
  //   - Signed-out users can see invitation details and choose how to sign in.
  //   - Authenticated users who have not yet joined any org can accept an
  //     invitation without being forced through the onboarding flow first.
  const isInvitePath = pathname.startsWith(INVITE_PATH_PREFIX)

  // ── Build initial pass-through response ────────────────────────────────────
  // This MUST be returned (or its cookies copied) on every code path so that
  // @supabase/ssr can propagate refreshed session tokens to the browser.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 1. Mutate the request object so the rest of this middleware and any
          //    downstream Server Components share the refreshed tokens.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // 2. Rebuild supabaseResponse from the mutated request so Next.js
          //    passes the new cookies forward.
          supabaseResponse = NextResponse.next({ request })
          // 3. Add the same cookies to the response so the browser receives
          //    them via Set-Cookie headers.
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the JWT and triggers setAll() when a token refresh
  // occurs.  Do NOT remove this call — removing it breaks session propagation.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Route protection ────────────────────────────────────────────────────────

  // Invite paths are excluded: the page itself renders a sign-in/sign-up UI
  // for unauthenticated visitors so they know what they're accepting.
  if (!user && !isPublic && !isInvitePath) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    // Preserve the full path + query string so the login form can redirect back.
    const pathWithQuery = pathname + (request.nextUrl.search ?? '')
    loginUrl.searchParams.set('next', pathWithQuery)
    const redirectResponse = NextResponse.redirect(loginUrl)
    // Copy any refreshed session cookies onto the redirect so the browser
    // receives them even though we're not returning supabaseResponse.
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => redirectResponse.cookies.set(c.name, c.value, c))
    return redirectResponse
  }

  if (user && PUBLIC_ROUTES.has(pathname)) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = DEFAULT_AUTHENTICATED_ROUTE
    dashboardUrl.searchParams.delete('next')
    const redirectResponse = NextResponse.redirect(dashboardUrl)
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => redirectResponse.cookies.set(c.name, c.value, c))
    return redirectResponse
  }

  // ── Org guard ────────────────────────────────────────────────────────────────
  // An authenticated user who has no organization membership must complete
  // onboarding. Checked here so no layout or page needs its own redirect.
  // Skip /onboarding itself (circular), /api/* routes, and /invite/* routes
  // (user must be able to accept an invitation before belonging to any org).
  if (
    user &&
    !isPublic &&
    !isInvitePath &&
    pathname !== ONBOARDING_ROUTE &&
    !pathname.startsWith('/api/')
  ) {
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!membership) {
      const onboardingUrl = request.nextUrl.clone()
      onboardingUrl.pathname = ONBOARDING_ROUTE
      onboardingUrl.searchParams.delete('next')
      const onboardingRedirect = NextResponse.redirect(onboardingUrl)
      supabaseResponse.cookies
        .getAll()
        .forEach((c) => onboardingRedirect.cookies.set(c.name, c.value, c))
      return onboardingRedirect
    }
  }

  // IMPORTANT: return supabaseResponse (not NextResponse.next()) so that the
  // Set-Cookie headers from any token refresh reach the browser.
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

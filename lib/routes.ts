/** Centralised route constants used by middleware, layouts, and guards. */

export const PUBLIC_ROUTES = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
])

/**
 * Path prefix for invitation acceptance.
 * Excluded from both the auth redirect guard and the org-membership guard so
 * that unauthenticated users can see invitation details, and authenticated
 * users with no org membership can accept an invitation before onboarding.
 */
export const INVITE_PATH_PREFIX = '/invite/'

export const ONBOARDING_ROUTE = '/onboarding'
export const DEFAULT_AUTHENTICATED_ROUTE = '/dashboard'
export const DEFAULT_UNAUTHENTICATED_ROUTE = '/login'

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { Organization } from '@/types/organization'
import { logger } from '@/lib/logger'

const ACTION          = 'createOrgSelfServiceAction'
const UNIQUE_VIOLATION = '23505'

type CreateOrgSuccess = { data: Organization; error: null; code?: never }
type CreateOrgFailure = { data: null; error: string; code: string }
export type CreateOrgResult = CreateOrgSuccess | CreateOrgFailure

// ─── Self-service org creation (Sprint 17) ───────────────────────────────────
// Each step is explicit and independently logged so failures pinpoint the
// exact operation that broke. Steps 1–5 log operation/code/message/details/hint
// on failure. Profile update (step 5) is non-fatal — middleware falls back to
// organization_memberships if it fails.

export async function createOrgSelfServiceAction(params: {
  name:            string
  slug:            string
  logoUrl:         string | null
  defaultCurrency: string
  payrollCurrency: string
  timezone:        string
  dateFormat:      string
}): Promise<CreateOrgResult> {

  // ── Step 0: Authenticate caller ─────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    logger.error(`${ACTION} step=auth FAILED`, {
      operation: 'auth.getUser',
      message:   authError?.message ?? 'no session',
    })
    return { data: null, error: 'Session expired. Please sign in again.', code: 'AUTH_FAILED' }
  }
  logger.info(`${ACTION} step=auth ok`)

  // Service role client for all writes — caller identity already validated above.
  const admin = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  // ── Step 1: Membership guard ────────────────────────────────────────────
  const { data: existingMembership, error: guardError } = await admin
    .from('organization_memberships')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (guardError) {
    logger.error(`${ACTION} step=membership_guard FAILED`, {
      operation: 'organization_memberships.select',
      code:    guardError.code,
      message: guardError.message,
      details: guardError.details,
      hint:    guardError.hint,
    })
    return { data: null, error: 'Failed to create organization. Please try again.', code: 'CREATE_FAILED' }
  }
  if (existingMembership) {
    logger.warn(`${ACTION} step=membership_guard BLOCKED — user already has membership`)
    return { data: null, error: 'You already belong to an organization.', code: 'CREATE_FAILED' }
  }
  logger.info(`${ACTION} step=membership_guard ok`)

  // ── Step 2: Resolve unique slug ─────────────────────────────────────────
  const baseSlug   = params.slug.trim().toLowerCase()
  let resolvedSlug: string | null = null

  for (let attempt = 0; attempt <= 10; attempt++) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`

    const { data: taken, error: slugCheckError } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()

    if (slugCheckError) {
      logger.error(`${ACTION} step=slug_check FAILED attempt=${attempt}`, {
        operation: 'organizations.select(slug)',
        code:    slugCheckError.code,
        message: slugCheckError.message,
        details: slugCheckError.details,
        hint:    slugCheckError.hint,
      })
      return { data: null, error: 'Failed to create organization. Please try again.', code: 'CREATE_FAILED' }
    }
    if (!taken) { resolvedSlug = candidate; break }
  }

  if (!resolvedSlug) {
    logger.warn(`${ACTION} step=slug_resolution EXHAUSTED`, { baseSlug })
    return { data: null, error: 'Could not generate a unique slug. Please try a different name.', code: 'SLUG_TAKEN' }
  }
  logger.info(`${ACTION} step=slug_resolution ok`, { slug: resolvedSlug })

  // ── Step 3: Create organization ─────────────────────────────────────────
  // Only include columns the PostgREST schema cache knows about.
  // Sprint 17 columns (timezone, date_format, subscription_status, plan,
  // trial_ends_at) are patched in Step 6 once the migration is applied.
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name:                     params.name.trim(),
      slug:                     resolvedSlug,
      logo_url:                 params.logoUrl ?? null,
      owner_id:                 user.id,
      default_currency:         params.defaultCurrency.toUpperCase(),
      default_payroll_currency: params.payrollCurrency.toUpperCase(),
    })
    .select()
    .single()

  if (orgError || !org) {
    logger.error(`${ACTION} step=create_organization FAILED`, {
      operation: 'organizations.insert',
      code:    orgError?.code    ?? 'no_data',
      message: orgError?.message ?? 'insert returned no row',
      details: orgError?.details ?? null,
      hint:    orgError?.hint    ?? null,
    })
    return { data: null, error: 'Failed to create organization. Please try again.', code: 'CREATE_FAILED' }
  }
  logger.info(`${ACTION} step=create_organization ok`)

  // ── Step 4: Create owner membership ─────────────────────────────────────
  const { error: memberError } = await admin
    .from('organization_memberships')
    .insert({ organization_id: org.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    logger.error(`${ACTION} step=create_membership FAILED`, {
      operation: 'organization_memberships.insert',
      code:    memberError.code,
      message: memberError.message,
      details: memberError.details,
      hint:    memberError.hint,
    })
    // Best-effort rollback so the orphaned org does not block a retry
    await admin.from('organizations').delete().eq('id', org.id)
    return { data: null, error: 'Failed to create organization. Please try again.', code: 'CREATE_FAILED' }
  }
  logger.info(`${ACTION} step=create_membership ok`)

  // ── Step 5: Update profile.active_organization_id ───────────────────────
  const { error: profileError } = await admin
    .from('profiles')
    .update({ active_organization_id: org.id })
    .eq('id', user.id)

  if (profileError) {
    logger.error(`${ACTION} step=update_profile FAILED (non-fatal — middleware fallback active)`, {
      operation: 'profiles.update',
      code:    profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint:    profileError.hint,
    })
    // Non-fatal: resolveOrgId() falls back to organization_memberships when this column is NULL.
  } else {
    logger.info(`${ACTION} step=update_profile ok`)
  }

  // ── Step 6: Set timezone / date_format / billing defaults ──────────────
  const { error: patchError } = await admin
    .from('organizations')
    .update({
      timezone:            params.timezone,
      date_format:         params.dateFormat,
      subscription_status: 'trial',
      plan:                'starter',
      trial_ends_at:       new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', org.id)

  if (patchError) {
    logger.warn(`${ACTION} step=patch_org_defaults FAILED`, {
      operation: 'organizations.update',
      code:    patchError.code,
      message: patchError.message,
    })
  } else {
    logger.info(`${ACTION} step=patch_org_defaults ok`)
  }

  // ── Step 7: Notification preferences are event-driven — no init row required
  logger.info(`${ACTION} step=init_notifications ok`)

  // Invalidate the full layout tree so router.push('/dashboard') sees fresh
  // org data immediately without requiring a separate router.refresh() call.
  revalidatePath('/', 'layout')

  logger.info(`${ACTION} COMMIT SUCCESS`, { orgId: org.id, slug: resolvedSlug })
  return { data: org as Organization, error: null }
}

export async function createOrganizationAction(params: {
  name: string
  slug: string
  logoUrl: string | null
}): Promise<CreateOrgResult> {
  // Step 1: validate the caller's identity using their session cookies.
  // We use the user-scoped client for this — never trust a user-supplied ID.
  const userClient = await createClient()
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()

  if (authError || !user) {
    return { data: null, error: 'Session expired. Please sign in again.', code: 'AUTH_FAILED' }
  }

  // Step 2: use the service role client for all writes.
  // The service role bypasses RLS, which is safe here because:
  //   a) this code only runs server-side (Server Action, never sent to the browser)
  //   b) we already validated the caller's identity above
  //   c) we explicitly set owner_id / user_id to the validated user.id
  const admin = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  // Insert the organization
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name:     params.name,
      slug:     params.slug,
      logo_url: params.logoUrl,
      owner_id: user.id,
    })
    .select()
    .single()

  if (orgError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[createOrganizationAction] org insert failed:', {
        code: orgError.code, message: orgError.message, hint: orgError.hint,
      })
    }
    const isSlugTaken = orgError.code === UNIQUE_VIOLATION
    return {
      data: null,
      error: isSlugTaken
        ? 'This URL slug is already taken. Please choose a different one.'
        : 'Failed to create organization. Please try again.',
      code: isSlugTaken ? 'SLUG_TAKEN' : 'CREATE_FAILED',
    }
  }

  // Insert owner membership in the same logical operation
  const { error: memberError } = await admin
    .from('organization_memberships')
    .insert({ organization_id: org.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[createOrganizationAction] membership insert failed:', {
        code: memberError.code, message: memberError.message, hint: memberError.hint,
      })
    }
    // Best-effort cleanup so the orphaned org doesn't block a retry with the same slug
    await admin.from('organizations').delete().eq('id', org.id)
    return { data: null, error: 'Failed to assign ownership. Please try again.', code: 'CREATE_FAILED' }
  }

  // Set the user's active organization — non-fatal.
  await admin
    .from('profiles')
    .update({ active_organization_id: org.id })
    .eq('id', user.id)

  revalidatePath('/', 'layout')
  return { data: org, error: null }
}

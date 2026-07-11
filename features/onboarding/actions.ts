'use server'

import { createClient } from '@/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { Organization } from '@/types/organization'

const UNIQUE_VIOLATION = '23505'

type CreateOrgSuccess = { data: Organization; error: null; code?: never }
type CreateOrgFailure = { data: null; error: string; code: string }
export type CreateOrgResult = CreateOrgSuccess | CreateOrgFailure

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
        : `Failed to create organization: ${orgError.message}`,
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
    return { data: null, error: `Failed to assign ownership: ${memberError.message}`, code: 'CREATE_FAILED' }
  }

  // Set the user's active organization. Non-fatal: if PostgREST's schema cache
  // is stale (e.g. after an ALTER TABLE before a cache reload), the column
  // update is silently skipped. resolveOrgId() falls back to organization_memberships.
  await admin
    .from('profiles')
    .update({ active_organization_id: org.id })
    .eq('id', user.id)

  return { data: org, error: null }
}

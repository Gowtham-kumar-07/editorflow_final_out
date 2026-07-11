import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { Organization, OrganizationWithRole, CreateOrganizationParams } from '@/types/organization'

type TypedClient = SupabaseClient<Database>

// ─── Error codes ──────────────────────────────────────────────────────────────

/** Postgres unique-violation code returned by Supabase */
const UNIQUE_VIOLATION = '23505'

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns the first organization the user belongs to, enriched with their
 * membership role. Returns null when the user has no membership or when the
 * tables do not yet exist (safe for use before migrations run).
 */
export async function getUserOrganization(
  supabase: TypedClient,
  userId: string
): Promise<OrganizationWithRole | null> {
  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('organization_id, role')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership) return null

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', membership.organization_id)
    .single()

  if (orgError || !org) return null

  return { ...org, role: membership.role }
}

/**
 * Checks whether a slug is already taken.
 * Returns true when the slug is available, false when it is taken.
 */
export async function isSlugAvailable(
  supabase: TypedClient,
  slug: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (error) return true // optimistically allow if we can't check
  return data === null
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Uploads a logo file to the `organization-logos` Supabase Storage bucket.
 * Returns the public URL on success, or null on failure (bucket may not be
 * configured yet — the caller should treat this as a non-fatal error).
 */
export async function uploadOrganizationLogo(
  supabase: TypedClient,
  slug: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${slug}/logo.${ext}`

  const { data, error } = await supabase.storage
    .from('organization-logos')
    .upload(path, file, { upsert: true })

  if (error || !data) return null

  const {
    data: { publicUrl },
  } = supabase.storage.from('organization-logos').getPublicUrl(data.path)

  return publicUrl
}

/**
 * Creates an organization, assigns the creator as Owner, and sets their
 * active_organization_id — all in one atomic database transaction via RPC.
 *
 * Uses a SECURITY DEFINER function so auth.uid() is always authoritative
 * inside Postgres, avoiding the cookie-timing race that caused RLS failures
 * with sequential client-side inserts.
 *
 * Throws with `code: 'SLUG_TAKEN'`   when the slug is already in use (P0001).
 * Throws with `code: 'CREATE_FAILED'` for other database errors.
 */
export async function createOrganization(
  supabase: TypedClient,
  params: CreateOrganizationParams
): Promise<Organization> {
  const { name, slug, logoUrl } = params

  const { data, error } = await supabase.rpc('create_organization', {
    p_name:     name,
    p_slug:     slug,
    p_logo_url: logoUrl ?? undefined,
  })

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      // Log the raw error object so non-enumerable properties (e.g. on a TypeError
      // from a network failure) are visible alongside the standard PostgREST fields.
      console.error('[createOrganization] rpc error object:', error)
      console.error('[createOrganization] rpc error (serialized):', JSON.stringify(error, Object.getOwnPropertyNames(error)))
      console.error('[createOrganization] rpc error fields:', {
        code:    error.code,
        message: error.message,
        details: error.details,
        hint:    error.hint,
      })
    }

    // P0001 = slug already taken (unique_violation re-raised inside the function)
    const isSlugTaken = error.code === 'P0001' || error.code === UNIQUE_VIOLATION
    const err = new Error(
      isSlugTaken
        ? 'This URL slug is already taken. Please choose a different one.'
        : `Failed to create organization: ${error.message}`
    )
    ;(err as Error & { code: string }).code = isSlugTaken ? 'SLUG_TAKEN' : 'CREATE_FAILED'
    throw err
  }

  return data as Organization
}

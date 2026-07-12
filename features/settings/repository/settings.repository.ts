import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { OrgSettings, ProfileSettings } from '../types'

type Client = SupabaseClient<Database>

export async function dbGetOrgSettings(
  supabase: Client,
  orgId: string
): Promise<OrgSettings | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null
  return data
}

export async function dbGetProfileSettings(
  supabase: Client,
  userId: string
): Promise<ProfileSettings | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, preferred_currency')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data
}

export async function dbUpdateOrgSettings(
  supabase: Client,
  orgId: string,
  updates: Record<string, unknown>
): Promise<OrgSettings | null> {
  const { data, error } = await supabase.rpc('update_organization_settings', {
    p_org_id:  orgId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_updates: updates as any,
  })

  if (error) throw error   // propagate full PostgrestError; caller maps to user-friendly message
  if (!data) return null
  return data as OrgSettings
}

export async function dbUpdateProfile(
  supabase: Client,
  values: { full_name: string; preferred_currency?: string }
): Promise<ProfileSettings> {
  const { data, error } = await supabase.rpc('update_my_profile', {
    p_full_name:          values.full_name,
    p_preferred_currency: values.preferred_currency ?? undefined,
  })

  if (error) {
    console.error('PROFILE_UPDATE_FAILED', {
      code:    error.code,
      message: error.message,
      details: error.details,
      hint:    error.hint,
    })
    throw error
  }

  if (!data) throw new Error('Profile update returned no data')
  return data as ProfileSettings
}

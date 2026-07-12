'use server'

import { redirect }    from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, OrgRole } from '@/types/supabase'
import { canEditSettings }        from '@/lib/permissions'
import { logger }                 from '@/lib/logger'
import {
  dbGetOrgSettings,
  dbGetProfileSettings,
  dbUpdateOrgSettings,
  dbUpdateProfile,
} from '../repository/settings.repository'
import type { SettingsPageData, OrgSettings } from '../types'
import type {
  ProfileFormValues,
  OrgProfileFormValues,
  FinancialDefaultsValues,
  InvoiceBrandingValues,
  PaymentDetailsValues,
} from '../schema'

type TypedClient = SupabaseClient<Database>

export type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function resolveContext(client?: TypedClient) {
  const supabase = client ?? (await createClient())

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .maybeSingle()

  let orgId = profile?.active_organization_id ?? null
  if (!orgId) {
    const { data: mem } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    if (!mem?.organization_id) redirect('/onboarding')
    orgId = mem.organization_id
  }

  const { data: mem } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId!)
    .maybeSingle()

  const role = (mem?.role ?? 'member') as OrgRole

  return { supabase, userId: user.id, orgId: orgId!, role }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getSettingsAction(): Promise<SettingsPageData> {
  const { supabase, userId, orgId, role } = await resolveContext()
  const [profile, org] = await Promise.all([
    dbGetProfileSettings(supabase, userId),
    role !== 'member' ? dbGetOrgSettings(supabase, orgId) : null,
  ])

  return {
    profile: profile ?? { id: userId, full_name: null, email: null, avatar_url: null, preferred_currency: 'USD' },
    org:     org,
  }
}

export async function getOrgDefaultsAction(): Promise<{
  default_currency: string
  default_payment_terms_days: number | null
} | null> {
  const { supabase, orgId } = await resolveContext()
  const { data } = await supabase
    .from('organizations')
    .select('default_currency, default_payment_terms_days')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single()
  if (!data) return null
  return {
    default_currency:           data.default_currency           ?? 'USD',
    default_payment_terms_days: data.default_payment_terms_days ?? null,
  }
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function updateProfileAction(
  values: ProfileFormValues
): Promise<ActionResult<{ full_name: string; preferred_currency: string }>> {
  try {
    const { supabase } = await resolveContext()
    const updated = await dbUpdateProfile(supabase, {
      full_name:          values.full_name,
      preferred_currency: values.preferred_currency,
    })
    return {
      ok:   true,
      data: {
        full_name:          updated.full_name          ?? values.full_name,
        preferred_currency: updated.preferred_currency ?? values.preferred_currency,
      },
    }
  } catch (err) {
    const pg = err as { code?: string; message?: string }
    if (pg.code === 'P0010') return { ok: false, error: 'Name is required.' }
    if (pg.code === 'P0011') return { ok: false, error: 'Name is too long (max 100 characters).' }
    return { ok: false, error: 'Unable to save profile. Please try again.' }
  }
}

// ─── Org settings helpers ─────────────────────────────────────────────────────

type PgError = { code?: string; message?: string; details?: string; hint?: string }

function mapOrgSettingsError(err: unknown): string {
  const pg = err as PgError
  logger.error('settings patchOrg failed', {
    code:    pg.code    ?? 'unknown',
    details: pg.details ?? null,
    hint:    pg.hint    ?? null,
  })
  if (pg.code === 'P0003') return 'You do not have permission to update organization settings.'
  if (pg.code === 'P0004') return 'Organization not found. Please reload the page.'
  return 'Unable to save settings. Please try again.'
}

async function patchOrg(
  updates: Record<string, unknown>
): Promise<ActionResult<OrgSettings>> {
  try {
    const { supabase, orgId, role } = await resolveContext()
    if (!canEditSettings(role)) {
      return { ok: false, error: 'You do not have permission to update organization settings.' }
    }
    const result = await dbUpdateOrgSettings(supabase, orgId, updates)
    if (!result) return { ok: false, error: 'Unable to save settings. Please try again.' }
    return { ok: true, data: result }
  } catch (err) {
    return { ok: false, error: mapOrgSettingsError(err) }
  }
}

// ─── Org profile ──────────────────────────────────────────────────────────────

export async function updateOrgProfileAction(
  values: OrgProfileFormValues
): Promise<ActionResult<OrgSettings>> {
  return patchOrg({
    name:           values.name,
    tagline:        values.tagline        || null,
    business_email: values.business_email || null,
    business_phone: values.business_phone || null,
    website:        values.website        || null,
    address_line1:  values.address_line1  || null,
    address_line2:  values.address_line2  || null,
    city:           values.city           || null,
    state:          values.state          || null,
    postal_code:    values.postal_code    || null,
    country:        values.country        || null,
    tax_id:         values.tax_id         || null,
  })
}

// ─── Financial defaults ───────────────────────────────────────────────────────

export async function updateFinancialDefaultsAction(
  values: FinancialDefaultsValues
): Promise<ActionResult<OrgSettings>> {
  return patchOrg({
    default_currency:           values.default_currency,
    default_payment_terms_days: values.default_payment_terms_days,
    default_payroll_currency:   values.default_payroll_currency,
  })
}

// ─── Invoice branding ─────────────────────────────────────────────────────────

export async function updateInvoiceBrandingAction(
  values: InvoiceBrandingValues
): Promise<ActionResult<OrgSettings>> {
  return patchOrg({
    invoice_prefix:       values.invoice_prefix,
    invoice_accent_color: values.invoice_accent_color || null,
    invoice_footer_text:  values.invoice_footer_text  || null,
    invoice_legal_text:   values.invoice_legal_text   || null,
  })
}

// ─── Payment details ──────────────────────────────────────────────────────────

export async function updatePaymentDetailsAction(
  values: PaymentDetailsValues
): Promise<ActionResult<OrgSettings>> {
  return patchOrg({
    bank_name:           values.bank_name           || null,
    bank_account_name:   values.bank_account_name   || null,
    bank_account_number: values.bank_account_number || null,
    bank_ifsc:           values.bank_ifsc           || null,
    bank_swift:          values.bank_swift          || null,
    bank_branch:         values.bank_branch         || null,
    upi_id:              values.upi_id              || null,
  })
}

// ─── Logo upload ──────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
// Processed images are client-compressed to ≤ 4 MB before upload
const MAX_UPLOAD_BYTES   = 4 * 1024 * 1024

export async function uploadOrgLogoAction(
  formData: FormData
): Promise<ActionResult<{ logo_url: string }>> {
  try {
    const { supabase, orgId, role } = await resolveContext()
    if (!canEditSettings(role)) {
      return { ok: false, error: 'Permission denied' }
    }

    const file = formData.get('file') as File | null
    if (!file || file.size === 0) return { ok: false, error: 'No file provided' }
    if (!ALLOWED_IMAGE_MIME.has(file.type)) return { ok: false, error: 'Only JPEG, PNG, and WebP images are allowed.' }
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'Processed file must be under 4 MB.' }

    const { data: orgRow } = await supabase
      .from('organizations')
      .select('slug')
      .eq('id', orgId)
      .single()
    if (!orgRow) return { ok: false, error: 'Organization not found' }

    const ext   = (file.name.split('.').pop() ?? 'png').toLowerCase()
    const path  = `organization-logos/${orgRow.slug}/logo.${ext}`
    const bytes = await file.arrayBuffer()

    const { error: uploadErr } = await supabase.storage
      .from('organization-logos')
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (uploadErr) return { ok: false, error: 'Logo upload failed. Please try again.' }

    const { data: { publicUrl } } = supabase.storage
      .from('organization-logos')
      .getPublicUrl(path)

    const updated = await dbUpdateOrgSettings(supabase, orgId, {
      logo_url: `${publicUrl}?t=${Date.now()}`,
    })
    if (!updated) return { ok: false, error: 'Failed to save logo URL' }

    return { ok: true, data: { logo_url: updated.logo_url! } }
  } catch {
    return { ok: false, error: 'Logo upload failed. Please try again.' }
  }
}

export async function removeOrgLogoAction(): Promise<ActionResult<null>> {
  try {
    const result = await patchOrg({ logo_url: null })
    if (!result.ok) return result
    return { ok: true, data: null }
  } catch {
    return { ok: false, error: 'Failed to remove logo. Please try again.' }
  }
}

// ─── Payment QR upload ────────────────────────────────────────────────────────

export async function uploadOrgQrAction(
  formData: FormData
): Promise<ActionResult<{ payment_qr_url: string }>> {
  try {
    const { supabase, orgId, role } = await resolveContext()
    if (!canEditSettings(role)) {
      return { ok: false, error: 'Permission denied' }
    }

    const file = formData.get('file') as File | null
    if (!file || file.size === 0) return { ok: false, error: 'No file provided' }
    if (!ALLOWED_IMAGE_MIME.has(file.type)) return { ok: false, error: 'Only JPEG, PNG, and WebP images are allowed.' }
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'Processed file must be under 4 MB.' }

    const { data: orgRow } = await supabase
      .from('organizations')
      .select('slug')
      .eq('id', orgId)
      .single()
    if (!orgRow) return { ok: false, error: 'Organization not found' }

    const ext   = (file.name.split('.').pop() ?? 'png').toLowerCase()
    const path  = `organization-logos/${orgRow.slug}/qr.${ext}`
    const bytes = await file.arrayBuffer()

    const { error: uploadErr } = await supabase.storage
      .from('organization-logos')
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (uploadErr) return { ok: false, error: 'QR upload failed. Please try again.' }

    const { data: { publicUrl } } = supabase.storage
      .from('organization-logos')
      .getPublicUrl(path)

    const updated = await dbUpdateOrgSettings(supabase, orgId, {
      payment_qr_url: `${publicUrl}?t=${Date.now()}`,
    })
    if (!updated) return { ok: false, error: 'Failed to save QR URL' }

    return { ok: true, data: { payment_qr_url: updated.payment_qr_url! } }
  } catch {
    return { ok: false, error: 'QR upload failed. Please try again.' }
  }
}

export async function removeOrgQrAction(): Promise<ActionResult<null>> {
  try {
    const result = await patchOrg({ payment_qr_url: null })
    if (!result.ok) return result
    return { ok: true, data: null }
  } catch {
    return { ok: false, error: 'Failed to remove QR image. Please try again.' }
  }
}

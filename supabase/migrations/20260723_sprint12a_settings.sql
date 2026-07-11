-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 12A · Organization Settings, Business Profile, Invoice Branding,
--              Financial Defaults, Secure Logo/QR Management
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1. Add business profile + financial + branding + bank columns to organizations
-- 2. Update next_invoice_number to use org-level invoice_prefix
-- 3. Add profiles UPDATE RLS policy (may not exist yet)
-- 4. Create organization-logos storage bucket (public)
-- 5. Storage RLS policies for organization-logos bucket
-- 6. update_organization_settings SECURITY DEFINER RPC (JSONB patch)
-- 7. organization_qr_path() storage path helper
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. Add new columns to organizations ────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tagline                    text,
  ADD COLUMN IF NOT EXISTS business_email             text,
  ADD COLUMN IF NOT EXISTS business_phone             text,
  ADD COLUMN IF NOT EXISTS website                    text,
  ADD COLUMN IF NOT EXISTS address_line1              text,
  ADD COLUMN IF NOT EXISTS address_line2              text,
  ADD COLUMN IF NOT EXISTS city                       text,
  ADD COLUMN IF NOT EXISTS state                      text,
  ADD COLUMN IF NOT EXISTS postal_code                text,
  ADD COLUMN IF NOT EXISTS country                    text,
  ADD COLUMN IF NOT EXISTS tax_id                     text,
  ADD COLUMN IF NOT EXISTS default_currency           text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS default_payment_terms_days integer,
  ADD COLUMN IF NOT EXISTS invoice_accent_color       text,
  ADD COLUMN IF NOT EXISTS invoice_footer_text        text,
  ADD COLUMN IF NOT EXISTS invoice_legal_text         text,
  ADD COLUMN IF NOT EXISTS invoice_prefix             text NOT NULL DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS bank_name                  text,
  ADD COLUMN IF NOT EXISTS bank_account_name          text,
  ADD COLUMN IF NOT EXISTS bank_account_number        text,
  ADD COLUMN IF NOT EXISTS bank_ifsc                  text,
  ADD COLUMN IF NOT EXISTS bank_swift                 text,
  ADD COLUMN IF NOT EXISTS bank_branch                text,
  ADD COLUMN IF NOT EXISTS upi_id                     text,
  ADD COLUMN IF NOT EXISTS payment_qr_url             text;

COMMENT ON COLUMN public.organizations.tagline
  IS 'Short tagline shown on invoices and receipts.';
COMMENT ON COLUMN public.organizations.default_currency
  IS 'ISO 4217 currency code used as the default when creating new invoices. Default: USD.';
COMMENT ON COLUMN public.organizations.default_payment_terms_days
  IS 'Default net payment days for new invoices (e.g. 30 for Net 30). NULL = no default.';
COMMENT ON COLUMN public.organizations.invoice_prefix
  IS 'Invoice number prefix, e.g. "INV" → INV-2026-0001. Default: INV.';
COMMENT ON COLUMN public.organizations.invoice_accent_color
  IS 'Hex colour code for invoice PDF accent elements, e.g. #2563eb.';
COMMENT ON COLUMN public.organizations.payment_qr_url
  IS 'Public URL of the UPI/payment QR code image shown on invoices.';


-- ─── 2. Update next_invoice_number to use org invoice_prefix ─────────────────

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year     INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_next_num INTEGER;
  v_prefix   TEXT;
BEGIN
  -- Read the org's configured prefix; fall back to 'INV' if blank/missing.
  SELECT COALESCE(NULLIF(TRIM(invoice_prefix), ''), 'INV')
  INTO   v_prefix
  FROM   public.organizations
  WHERE  id = p_org_id;

  v_prefix := COALESCE(v_prefix, 'INV');

  INSERT INTO public.invoice_number_sequences (organization_id, year, last_number)
  VALUES (p_org_id, v_year, 1)
  ON CONFLICT (organization_id, year)
  DO UPDATE SET last_number = invoice_number_sequences.last_number + 1
  RETURNING last_number INTO v_next_num;

  RETURN v_prefix || '-' || v_year::TEXT || '-' || LPAD(v_next_num::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION public.next_invoice_number(uuid) IS
  'Atomically increments the per-org/per-year sequence and returns a formatted '
  'invoice number using the org''s invoice_prefix (default: INV).';


-- ─── 3. Profiles UPDATE RLS (idempotent — guards were missing before) ────────

DROP POLICY IF EXISTS "profiles: users can update own row" ON public.profiles;
CREATE POLICY "profiles: users can update own row"
  ON public.profiles FOR UPDATE TO authenticated
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ─── 4. Create organization-logos storage bucket (public) ────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-logos',
  'organization-logos',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/svg+xml'];


-- ─── 5. Storage RLS for organization-logos bucket ────────────────────────────
-- Public read (anyone can view logos via public URL).
-- Authenticated write (app layer enforces admin/owner before calling storage).

DROP POLICY IF EXISTS "org_logos: public read"          ON storage.objects;
DROP POLICY IF EXISTS "org_logos: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "org_logos: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "org_logos: authenticated delete" ON storage.objects;

CREATE POLICY "org_logos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'organization-logos');

CREATE POLICY "org_logos: authenticated upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'organization-logos');

CREATE POLICY "org_logos: authenticated update"
  ON storage.objects FOR UPDATE TO authenticated
  USING     (bucket_id = 'organization-logos');

CREATE POLICY "org_logos: authenticated delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'organization-logos');


-- ─── 6. update_organization_settings SECURITY DEFINER RPC ───────────────────
--
-- Accepts a JSONB patch so callers can update any subset of fields without
-- needing to re-send the full org row.  Only keys present in p_updates are
-- touched; absent keys leave the existing column value unchanged.
-- Callers must be owner or admin in the org.

CREATE OR REPLACE FUNCTION public.update_organization_settings(
  p_org_id  uuid,
  p_updates jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_org  public.organizations;
BEGIN
  -- Role check: owner or admin only.
  SELECT role::text INTO v_role
  FROM   public.organization_memberships
  WHERE  organization_id = p_org_id
    AND  user_id         = auth.uid()
    AND  deleted_at      IS NULL;

  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized to update organization settings'
      USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.organizations SET
    name          = CASE WHEN p_updates ? 'name'
                         THEN COALESCE(NULLIF(TRIM(p_updates->>'name'), ''), name)
                         ELSE name END,

    tagline       = CASE WHEN p_updates ? 'tagline'
                         THEN p_updates->>'tagline'        ELSE tagline END,
    business_email = CASE WHEN p_updates ? 'business_email'
                         THEN p_updates->>'business_email' ELSE business_email END,
    business_phone = CASE WHEN p_updates ? 'business_phone'
                         THEN p_updates->>'business_phone' ELSE business_phone END,
    website       = CASE WHEN p_updates ? 'website'
                         THEN p_updates->>'website'        ELSE website END,
    address_line1 = CASE WHEN p_updates ? 'address_line1'
                         THEN p_updates->>'address_line1'  ELSE address_line1 END,
    address_line2 = CASE WHEN p_updates ? 'address_line2'
                         THEN p_updates->>'address_line2'  ELSE address_line2 END,
    city          = CASE WHEN p_updates ? 'city'
                         THEN p_updates->>'city'           ELSE city END,
    state         = CASE WHEN p_updates ? 'state'
                         THEN p_updates->>'state'          ELSE state END,
    postal_code   = CASE WHEN p_updates ? 'postal_code'
                         THEN p_updates->>'postal_code'    ELSE postal_code END,
    country       = CASE WHEN p_updates ? 'country'
                         THEN p_updates->>'country'        ELSE country END,
    tax_id        = CASE WHEN p_updates ? 'tax_id'
                         THEN p_updates->>'tax_id'         ELSE tax_id END,

    default_currency =
      CASE WHEN p_updates ? 'default_currency'
           THEN COALESCE(NULLIF(TRIM(p_updates->>'default_currency'), ''), 'USD')
           ELSE default_currency END,

    default_payment_terms_days =
      CASE WHEN p_updates ? 'default_payment_terms_days'
           THEN NULLIF(p_updates->>'default_payment_terms_days', '')::integer
           ELSE default_payment_terms_days END,

    invoice_accent_color =
      CASE WHEN p_updates ? 'invoice_accent_color'
           THEN p_updates->>'invoice_accent_color'  ELSE invoice_accent_color END,
    invoice_footer_text =
      CASE WHEN p_updates ? 'invoice_footer_text'
           THEN p_updates->>'invoice_footer_text'   ELSE invoice_footer_text END,
    invoice_legal_text =
      CASE WHEN p_updates ? 'invoice_legal_text'
           THEN p_updates->>'invoice_legal_text'    ELSE invoice_legal_text END,
    invoice_prefix =
      CASE WHEN p_updates ? 'invoice_prefix'
           THEN COALESCE(NULLIF(TRIM(p_updates->>'invoice_prefix'), ''), 'INV')
           ELSE invoice_prefix END,

    bank_name           = CASE WHEN p_updates ? 'bank_name'
                               THEN p_updates->>'bank_name'           ELSE bank_name END,
    bank_account_name   = CASE WHEN p_updates ? 'bank_account_name'
                               THEN p_updates->>'bank_account_name'   ELSE bank_account_name END,
    bank_account_number = CASE WHEN p_updates ? 'bank_account_number'
                               THEN p_updates->>'bank_account_number' ELSE bank_account_number END,
    bank_ifsc           = CASE WHEN p_updates ? 'bank_ifsc'
                               THEN p_updates->>'bank_ifsc'           ELSE bank_ifsc END,
    bank_swift          = CASE WHEN p_updates ? 'bank_swift'
                               THEN p_updates->>'bank_swift'          ELSE bank_swift END,
    bank_branch         = CASE WHEN p_updates ? 'bank_branch'
                               THEN p_updates->>'bank_branch'         ELSE bank_branch END,
    upi_id              = CASE WHEN p_updates ? 'upi_id'
                               THEN p_updates->>'upi_id'              ELSE upi_id END,

    logo_url       = CASE WHEN p_updates ? 'logo_url'
                          THEN p_updates->>'logo_url'    ELSE logo_url END,
    payment_qr_url = CASE WHEN p_updates ? 'payment_qr_url'
                          THEN p_updates->>'payment_qr_url' ELSE payment_qr_url END,

    updated_at = NOW()

  WHERE id         = p_org_id
    AND deleted_at IS NULL
  RETURNING * INTO v_org;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found'
      USING ERRCODE = 'P0004';
  END IF;

  RETURN row_to_json(v_org);
END;
$$;

REVOKE ALL     ON FUNCTION public.update_organization_settings(uuid, jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.update_organization_settings(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.update_organization_settings(uuid, jsonb) IS
  'SECURITY DEFINER RPC — updates organization settings fields from a JSON patch. '
  'Only owner or admin may call it. Keys absent from p_updates are left unchanged.';


-- ─── 7. organization_qr_path() storage path helper ───────────────────────────

CREATE OR REPLACE FUNCTION public.organization_qr_path(p_org_slug text, p_ext text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'organization-logos/' || p_org_slug || '/qr.' || lower(p_ext);
$$;

COMMENT ON FUNCTION public.organization_qr_path(text, text) IS
  'Canonical Supabase Storage path for an organization payment QR code. '
  'Bucket: organization-logos (public). '
  'Example: organization_qr_path(''acme'', ''png'') → ''organization-logos/acme/qr.png''';

GRANT EXECUTE ON FUNCTION public.organization_qr_path(text, text) TO authenticated, anon;

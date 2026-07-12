-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 17 · SaaS Organization Self-Onboarding
--
-- 1. Billing placeholder columns on organizations
-- 2. timezone / date_format columns on organizations
-- 3. create_org_self_service() — atomic, membership-guarded, auto-slug RPC
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Org metadata: timezone + date format ──────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS timezone    TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS date_format TEXT NOT NULL DEFAULT 'MMM D, YYYY';

COMMENT ON COLUMN public.organizations.timezone
  IS 'IANA timezone identifier used for date display, e.g. America/New_York.';
COMMENT ON COLUMN public.organizations.date_format
  IS 'Display date format for invoices and reports, e.g. MMM D, YYYY.';

-- ─── 2. Billing placeholder columns ──────────────────────────────────────────
-- No Stripe integration yet — these are structural placeholders only.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS plan                TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS trial_ends_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id  TEXT;

COMMENT ON COLUMN public.organizations.subscription_status
  IS 'Billing lifecycle: trial | active | past_due | cancelled. Placeholder until Stripe is wired.';
COMMENT ON COLUMN public.organizations.plan
  IS 'Subscription tier: starter | pro | enterprise. Placeholder until billing is implemented.';
COMMENT ON COLUMN public.organizations.trial_ends_at
  IS 'When the 14-day trial expires. NULL for organizations created before billing was added.';
COMMENT ON COLUMN public.organizations.stripe_customer_id
  IS 'Stripe customer object ID. NULL until Stripe is integrated.';

-- Backfill existing orgs: set trial_ends_at based on created_at
UPDATE public.organizations
   SET trial_ends_at = created_at + INTERVAL '14 days'
 WHERE trial_ends_at IS NULL;

-- ─── 3. Self-service org creation RPC ────────────────────────────────────────
--
-- Accepts all wizard fields atomically:
--   a) validates auth
--   b) blocks creation if user already has a membership (invite users)
--   c) auto-increments slug if taken (up to 10 attempts)
--   d) creates org with billing defaults + settings
--   e) creates owner membership
--   f) sets profiles.active_organization_id
--
-- Error codes:
--   P0001 — slug taken after all attempts
--   P0002 — not authenticated
--   P0003 — user already has a membership
--   P0010 — name empty
--   P0011 — name too long

CREATE OR REPLACE FUNCTION public.create_org_self_service(
  p_name             TEXT,
  p_slug             TEXT,
  p_logo_url         TEXT DEFAULT NULL,
  p_default_currency TEXT DEFAULT 'USD',
  p_payroll_currency TEXT DEFAULT 'USD',
  p_timezone         TEXT DEFAULT 'UTC',
  p_date_format      TEXT DEFAULT 'MMM D, YYYY'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_org      public.organizations;
  v_slug     TEXT;
  v_attempt  INT := 0;
  v_inserted BOOLEAN := FALSE;
BEGIN
  -- Must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0002';
  END IF;

  -- Block if user already has an active membership anywhere
  IF EXISTS (
    SELECT 1 FROM public.organization_memberships
     WHERE user_id    = v_user_id
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User already belongs to an organization' USING ERRCODE = 'P0003';
  END IF;

  -- Validate name
  p_name := trim(p_name);
  IF p_name = '' THEN
    RAISE EXCEPTION 'Organization name cannot be empty' USING ERRCODE = 'P0010';
  END IF;
  IF char_length(p_name) > 50 THEN
    RAISE EXCEPTION 'Organization name cannot exceed 50 characters' USING ERRCODE = 'P0011';
  END IF;

  -- Auto-increment slug: try p_slug, p_slug-2, p_slug-3, … p_slug-11
  LOOP
    EXIT WHEN v_attempt > 10;

    v_slug := CASE
      WHEN v_attempt = 0 THEN trim(p_slug)
      ELSE                    trim(p_slug) || '-' || (v_attempt + 1)::TEXT
    END;

    BEGIN
      INSERT INTO public.organizations (
        name, slug, logo_url, owner_id,
        default_currency, default_payroll_currency,
        timezone, date_format,
        subscription_status, plan, trial_ends_at
      ) VALUES (
        p_name, v_slug, p_logo_url, v_user_id,
        upper(p_default_currency), upper(p_payroll_currency),
        p_timezone, p_date_format,
        'trial', 'starter', now() + INTERVAL '14 days'
      )
      RETURNING * INTO v_org;

      v_inserted := TRUE;
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        v_attempt := v_attempt + 1;
    END;
  END LOOP;

  IF NOT v_inserted THEN
    RAISE EXCEPTION 'Could not generate a unique slug for "%"', trim(p_slug)
      USING ERRCODE = 'P0001';
  END IF;

  -- Create owner membership
  INSERT INTO public.organization_memberships (organization_id, user_id, role)
  VALUES (v_org.id, v_user_id, 'owner');

  -- Point the user's profile at the new org
  UPDATE public.profiles
     SET active_organization_id = v_org.id
   WHERE id = v_user_id;

  RETURN row_to_json(v_org);
END;
$$;

REVOKE ALL     ON FUNCTION public.create_org_self_service(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_org_self_service(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

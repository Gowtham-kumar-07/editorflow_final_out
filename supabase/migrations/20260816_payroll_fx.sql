-- Sprint 16: Multi-Currency Payroll & Member Currency Preferences

-- ─── 1. Add task_currency to tasks ────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_currency TEXT NOT NULL DEFAULT 'USD';

-- ─── 2. Add preferred_currency to profiles ────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT NOT NULL DEFAULT 'USD';

-- ─── 3. Add FX snapshot columns to member_income ──────────────────────────────

ALTER TABLE public.member_income
  ADD COLUMN IF NOT EXISTS original_amount   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS original_currency TEXT,
  ADD COLUMN IF NOT EXISTS member_currency   TEXT,
  ADD COLUMN IF NOT EXISTS fx_rate           NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS fx_rate_source    TEXT,
  ADD COLUMN IF NOT EXISTS fx_snapshot_date  DATE,
  ADD COLUMN IF NOT EXISTS converted_amount  NUMERIC(12,2);

-- ─── 4. Backfill existing member_income with 1:1 same-currency values ─────────
-- Historical guarantee: existing records are not retroactively converted.
-- fx_rate=1.0, fx_rate_source='same_currency' marks them as intentional 1:1.

UPDATE public.member_income
   SET original_amount   = amount,
       original_currency = currency,
       converted_amount  = amount,
       member_currency   = currency,
       fx_rate           = 1.0,
       fx_rate_source    = 'same_currency',
       fx_snapshot_date  = CURRENT_DATE
 WHERE original_amount IS NULL;

-- ─── 5. Update trigger to capture task_currency ────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_income_on_task_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fire only when review → completed AND task has assignee AND amount > 0
  IF OLD.status = 'review'
    AND NEW.status = 'completed'
    AND NEW.assigned_to IS NOT NULL
    AND NEW.amount > 0
  THEN
    INSERT INTO public.member_income (
      organization_id,
      member_id,
      task_id,
      amount,
      currency,
      original_amount,
      original_currency,
      status,
      completed_at
    ) VALUES (
      NEW.organization_id,
      NEW.assigned_to,
      NEW.id,
      NEW.amount,
      NEW.task_currency,
      NEW.amount,
      NEW.task_currency,
      'pending',
      now()
    )
    ON CONFLICT (task_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 6. RPC: update_income_fx_snapshot ────────────────────────────────────────
-- Called by the application layer after getFxRate succeeds.
-- Updates the income record with the FX snapshot and sets amount/currency to
-- the converted values for backward-compatible queries.

CREATE OR REPLACE FUNCTION public.update_income_fx_snapshot(
  p_task_id           UUID,
  p_member_currency   TEXT,
  p_converted_amount  NUMERIC(12,2),
  p_fx_rate           NUMERIC(10,6),
  p_fx_rate_source    TEXT,
  p_fx_snapshot_date  DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role   TEXT;
BEGIN
  SELECT organization_id INTO v_org_id
    FROM public.member_income
   WHERE task_id = p_task_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT role INTO v_role
    FROM public.organization_memberships
   WHERE organization_id = v_org_id
     AND user_id         = auth.uid()
     AND deleted_at      IS NULL;

  IF v_role NOT IN ('owner', 'admin', 'project_manager') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.member_income
     SET member_currency  = p_member_currency,
         converted_amount = p_converted_amount,
         fx_rate          = p_fx_rate,
         fx_rate_source   = p_fx_rate_source,
         fx_snapshot_date = p_fx_snapshot_date,
         -- Update amount/currency to converted values for backward compat
         amount           = p_converted_amount,
         currency         = p_member_currency,
         updated_at       = now()
   WHERE task_id = p_task_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.update_income_fx_snapshot(UUID, TEXT, NUMERIC, NUMERIC, TEXT, DATE) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_income_fx_snapshot(UUID, TEXT, NUMERIC, NUMERIC, TEXT, DATE) TO authenticated;

-- ─── 7. Update update_my_profile to accept preferred_currency ─────────────────

DROP FUNCTION IF EXISTS public.update_my_profile(text);

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name          TEXT,
  p_preferred_currency TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result  json;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Full name cannot be empty' USING ERRCODE = 'P0010';
  END IF;

  IF length(trim(p_full_name)) > 100 THEN
    RAISE EXCEPTION 'Full name is too long (max 100 characters)' USING ERRCODE = 'P0011';
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  SELECT
    v_user_id,
    trim(p_full_name),
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'avatar_url', '')), ''),
    u.email
  FROM auth.users u
  WHERE u.id = v_user_id
  ON CONFLICT (id) DO UPDATE
    SET full_name          = EXCLUDED.full_name,
        preferred_currency = COALESCE(p_preferred_currency, profiles.preferred_currency),
        updated_at         = now();

  SELECT json_build_object(
    'id',                 id,
    'full_name',          full_name,
    'email',              email,
    'avatar_url',         avatar_url,
    'preferred_currency', preferred_currency
  )
  INTO   v_result
  FROM   public.profiles
  WHERE  id = v_user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL     ON FUNCTION public.update_my_profile(text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_my_profile(text, text) TO authenticated;

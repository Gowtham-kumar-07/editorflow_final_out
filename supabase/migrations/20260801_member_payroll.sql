-- Sprint 14C: Task amount field, member_income table, internal payroll system

-- ─── 1. Add amount to tasks ───────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ─── 2. Add default_payroll_currency to organizations ─────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS default_payroll_currency TEXT NOT NULL DEFAULT 'USD';

-- ─── 3. Create member_income table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.member_income (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id               UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  amount                NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'USD',
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  completed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at               TIMESTAMPTZ,
  paid_by               UUID REFERENCES auth.users(id),
  payment_method        TEXT,
  transaction_reference TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id)
);

-- ─── 4. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_member_income_org
  ON public.member_income (organization_id);

CREATE INDEX IF NOT EXISTS idx_member_income_member
  ON public.member_income (member_id);

CREATE INDEX IF NOT EXISTS idx_member_income_task
  ON public.member_income (task_id);

CREATE INDEX IF NOT EXISTS idx_member_income_org_status
  ON public.member_income (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_member_income_org_member
  ON public.member_income (organization_id, member_id);

-- ─── 5. Enable RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.member_income ENABLE ROW LEVEL SECURITY;

-- ─── 6. RLS policies ─────────────────────────────────────────────────────────

-- Members see own records; managers/admins/owners see all records in their org
CREATE POLICY "member_income_select"
  ON public.member_income
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.organization_id = member_income.organization_id
        AND om.user_id = auth.uid()
        AND om.deleted_at IS NULL
        AND (
          om.role IN ('owner', 'admin', 'project_manager')
          OR member_income.member_id = auth.uid()
        )
    )
  );

-- All writes go through SECURITY DEFINER RPCs — no direct DML via RLS

-- ─── 7. Trigger: auto-create income on task completion ────────────────────────

CREATE OR REPLACE FUNCTION public.create_income_on_task_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency TEXT;
BEGIN
  -- Fire only when review → completed AND task has assignee AND amount > 0
  IF OLD.status = 'review'
    AND NEW.status = 'completed'
    AND NEW.assigned_to IS NOT NULL
    AND NEW.amount > 0
  THEN
    SELECT COALESCE(default_payroll_currency, 'USD')
      INTO v_currency
      FROM public.organizations
      WHERE id = NEW.organization_id;

    INSERT INTO public.member_income (
      organization_id,
      member_id,
      task_id,
      amount,
      currency,
      status,
      completed_at
    ) VALUES (
      NEW.organization_id,
      NEW.assigned_to,
      NEW.id,
      NEW.amount,
      v_currency,
      'pending',
      now()
    )
    ON CONFLICT (task_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_income_on_task_completion ON public.tasks;
CREATE TRIGGER trg_create_income_on_task_completion
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_income_on_task_completion();

-- ─── 8. RPC: mark_member_income_paid ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_member_income_paid(
  p_income_id             UUID,
  p_payment_date          DATE,
  p_payment_method        TEXT,
  p_transaction_reference TEXT DEFAULT NULL,
  p_notes                 TEXT DEFAULT NULL
)
RETURNS public.member_income
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role   TEXT;
  v_income public.member_income;
BEGIN
  SELECT * INTO v_income FROM public.member_income WHERE id = p_income_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Income record not found';
  END IF;

  v_org_id := v_income.organization_id;

  SELECT role INTO v_role
    FROM public.organization_memberships
    WHERE organization_id = v_org_id
      AND user_id = auth.uid()
      AND deleted_at IS NULL;

  IF v_role NOT IN ('owner', 'admin', 'project_manager') THEN
    RAISE EXCEPTION 'Permission denied: only managers can mark income as paid';
  END IF;

  IF v_income.status != 'pending' THEN
    RAISE EXCEPTION 'Income record is already paid';
  END IF;

  UPDATE public.member_income
    SET
      status                = 'paid',
      paid_at               = p_payment_date::TIMESTAMPTZ,
      paid_by               = auth.uid(),
      payment_method        = p_payment_method,
      transaction_reference = p_transaction_reference,
      notes                 = p_notes,
      updated_at            = now()
    WHERE id = p_income_id
    RETURNING * INTO v_income;

  RETURN v_income;
END;
$$;

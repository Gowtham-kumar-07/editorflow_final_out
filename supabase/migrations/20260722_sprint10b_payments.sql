-- Sprint 10B: Payments, Balance Tracking, Payment History, and Receipts
--
-- Extends the payments table with org tracking and void support, adds
-- paid_amount/balance_due/paid_at to invoices, replaces the JOIN-based
-- payments RLS policy with a direct org_id policy, and creates the two
-- core payment RPCs: record_invoice_payment (with FOR UPDATE locking to
-- prevent concurrent overpayments) and void_invoice_payment (owner/admin only).

-- ─── 1. Extend payment_status enum ───────────────────────────────────────────
-- PostgreSQL only allows adding enum values, never removing them.
-- Legacy values (pending, paid, failed, refunded) are kept but unused by RPCs.
-- New payments use 'completed'; voided payments use 'voided'.

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'voided';

-- ─── 2. Extend payments table ─────────────────────────────────────────────────

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS organization_id UUID    REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS recorded_by     UUID    REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS voided_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by       UUID    REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS void_reason     TEXT;

-- Backfill organization_id from the parent invoice (safe for existing rows)
UPDATE public.payments p
   SET organization_id = i.organization_id
  FROM public.invoices i
 WHERE p.invoice_id = i.id
   AND p.organization_id IS NULL;

ALTER TABLE public.payments
  ALTER COLUMN organization_id SET NOT NULL;

-- ─── 3. Indexes on payments ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS payments_organization_id_idx ON public.payments (organization_id);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx      ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS payments_status_idx          ON public.payments (status);

-- ─── 4. Extend invoices table ─────────────────────────────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at     TIMESTAMPTZ;

-- Generated column: always reflects (total − paid_amount); never stale.
-- Must be added after paid_amount exists so the expression resolves.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC GENERATED ALWAYS AS (total - paid_amount) STORED;

-- ─── 5. Replace JOIN-based payments RLS with direct org_id policy ─────────────

DROP POLICY IF EXISTS "payments: financial roles can read" ON public.payments;

CREATE POLICY "payments: financial roles can read" ON public.payments
  FOR SELECT
  USING (
    organization_id = ANY(public.get_my_org_ids())
    AND public.get_my_role_in_org(organization_id) IN ('owner', 'admin', 'project_manager')
  );

-- Write access remains RPC-only (no INSERT/UPDATE policies).

-- ─── 6. Update transition_invoice_status: allow partial → cancelled ───────────
-- Sprint 10A blocked partial transitions. Sprint 10B unlocks partial→cancelled
-- so partially-paid invoices can be cancelled if needed.

CREATE OR REPLACE FUNCTION public.transition_invoice_status(
  p_invoice_id UUID,
  p_new_status public.invoice_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_user_role      TEXT;
  v_org_id         UUID;
  v_current_status public.invoice_status;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id, status
    INTO v_org_id, v_current_status
    FROM public.invoices
   WHERE id = p_invoice_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  v_user_role := public.get_my_role_in_org(v_org_id);
  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin', 'project_manager') THEN
    RAISE EXCEPTION 'Insufficient permissions to change invoice status';
  END IF;

  -- paid/partial status is set exclusively by record_invoice_payment RPC
  IF p_new_status IN ('paid', 'partial') THEN
    RAISE EXCEPTION 'Paid status is set automatically when payment is recorded';
  END IF;

  IF NOT (
    (v_current_status = 'draft'   AND p_new_status IN ('sent',      'cancelled')) OR
    (v_current_status = 'sent'    AND p_new_status IN ('overdue',   'cancelled')) OR
    (v_current_status = 'overdue' AND p_new_status IN ('cancelled'))              OR
    (v_current_status = 'partial' AND p_new_status IN ('cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid invoice status transition: % → %', v_current_status, p_new_status;
  END IF;

  UPDATE public.invoices
     SET status     = p_new_status,
         updated_at = now()
   WHERE id = p_invoice_id;

  INSERT INTO public.activity_logs (
    organization_id, user_id,  entity_type, entity_id,
    activity_type,   metadata
  ) VALUES (
    v_org_id, v_user_id, 'invoice', p_invoice_id,
    'updated',
    jsonb_build_object(
      'action', 'status_transition',
      'from',   v_current_status::TEXT,
      'to',     p_new_status::TEXT
    )
  );
END;
$$;

-- ─── 7. record_invoice_payment() ─────────────────────────────────────────────
-- Atomically records a payment, updates invoice paid_amount and status.
-- SELECT … FOR UPDATE on the invoice row prevents concurrent overpayments.
-- Allowed roles: owner, admin, project_manager.

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id      UUID,
  p_amount          NUMERIC,
  p_payment_date    DATE,
  p_payment_method  TEXT,    -- bank_transfer|upi|cash|card|cheque|other
  p_transaction_ref TEXT,    -- nullable
  p_notes           TEXT     -- nullable
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_user_role      TEXT;
  v_org_id         UUID;
  v_current_status public.invoice_status;
  v_total          NUMERIC;
  v_current_paid   NUMERIC;
  v_new_paid       NUMERIC;
  v_new_status     public.invoice_status;
  v_payment_id     UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Row-lock the invoice to prevent concurrent payment races
  SELECT organization_id, status, total, paid_amount
    INTO v_org_id, v_current_status, v_total, v_current_paid
    FROM public.invoices
   WHERE id = p_invoice_id AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  v_user_role := public.get_my_role_in_org(v_org_id);
  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin', 'project_manager') THEN
    RAISE EXCEPTION 'Insufficient permissions to record payments';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  IF v_current_status IN ('draft', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot record payment on a % invoice', v_current_status;
  END IF;

  IF p_payment_method NOT IN ('bank_transfer', 'upi', 'cash', 'card', 'cheque', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

  v_new_paid := v_current_paid + p_amount;

  IF v_new_paid > v_total THEN
    RAISE EXCEPTION 'Payment of % would exceed invoice total of % (already paid: %)',
      p_amount, v_total, v_current_paid;
  END IF;

  -- Fully paid if new_paid reaches total
  IF v_new_paid >= v_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  INSERT INTO public.payments (
    invoice_id, organization_id, recorded_by,
    amount, payment_date, payment_method,
    transaction_reference, notes, status
  ) VALUES (
    p_invoice_id, v_org_id, v_user_id,
    p_amount, p_payment_date, p_payment_method,
    p_transaction_ref, p_notes, 'completed'
  ) RETURNING id INTO v_payment_id;

  UPDATE public.invoices
     SET paid_amount = v_new_paid,
         status      = v_new_status,
         paid_at     = CASE WHEN v_new_status = 'paid' AND paid_at IS NULL THEN now() ELSE paid_at END,
         updated_at  = now()
   WHERE id = p_invoice_id;

  INSERT INTO public.activity_logs (
    organization_id, user_id,  entity_type, entity_id,
    activity_type,   metadata
  ) VALUES (
    v_org_id, v_user_id, 'invoice', p_invoice_id,
    'payment_received',
    jsonb_build_object(
      'payment_id',     v_payment_id,
      'amount',         p_amount,
      'payment_method', p_payment_method,
      'new_status',     v_new_status,
      'total_paid',     v_new_paid,
      'balance_due',    v_total - v_new_paid
    )
  );

  RETURN jsonb_build_object(
    'payment_id',  v_payment_id,
    'new_status',  v_new_status,
    'total_paid',  v_new_paid,
    'balance_due', v_total - v_new_paid
  );
END;
$$;

-- ─── 8. void_invoice_payment() ────────────────────────────────────────────────
-- Marks a payment as voided (record is kept for audit), reverses its amount
-- from invoices.paid_amount, and resets the invoice status accordingly.
-- Allowed roles: owner, admin only.

CREATE OR REPLACE FUNCTION public.void_invoice_payment(
  p_payment_id  UUID,
  p_void_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_user_role      TEXT;
  v_org_id         UUID;
  v_invoice_id     UUID;
  v_amount         NUMERIC;
  v_payment_status public.payment_status;
  v_invoice_status public.invoice_status;
  v_total          NUMERIC;
  v_current_paid   NUMERIC;
  v_new_paid       NUMERIC;
  v_new_status     public.invoice_status;
  v_due_date       DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id, invoice_id, amount, status
    INTO v_org_id, v_invoice_id, v_amount, v_payment_status
    FROM public.payments
   WHERE id = p_payment_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  v_user_role := public.get_my_role_in_org(v_org_id);
  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owners and admins can void payments';
  END IF;

  IF v_payment_status = 'voided' THEN
    RAISE EXCEPTION 'Payment is already voided';
  END IF;

  IF v_payment_status != 'completed' THEN
    RAISE EXCEPTION 'Only completed payments can be voided';
  END IF;

  -- Row-lock the invoice to prevent concurrent races
  SELECT status, total, paid_amount, due_date
    INTO v_invoice_status, v_total, v_current_paid, v_due_date
    FROM public.invoices
   WHERE id = v_invoice_id
   FOR UPDATE;

  v_new_paid := GREATEST(0, v_current_paid - v_amount);

  -- Determine restored invoice status
  IF v_invoice_status IN ('draft', 'cancelled') THEN
    v_new_status := v_invoice_status;
  ELSIF v_new_paid <= 0 THEN
    -- No payments remain — restore to sent or overdue
    IF v_due_date IS NOT NULL AND v_due_date < CURRENT_DATE THEN
      v_new_status := 'overdue';
    ELSE
      v_new_status := 'sent';
    END IF;
  ELSIF v_new_paid < v_total THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'paid';
  END IF;

  UPDATE public.payments
     SET status      = 'voided',
         voided_at   = now(),
         voided_by   = v_user_id,
         void_reason = p_void_reason,
         updated_at  = now()
   WHERE id = p_payment_id;

  UPDATE public.invoices
     SET paid_amount = v_new_paid,
         status      = v_new_status,
         paid_at     = CASE WHEN v_new_status != 'paid' THEN NULL ELSE paid_at END,
         updated_at  = now()
   WHERE id = v_invoice_id;

  INSERT INTO public.activity_logs (
    organization_id, user_id,  entity_type, entity_id,
    activity_type,   metadata
  ) VALUES (
    v_org_id, v_user_id, 'invoice', v_invoice_id,
    'updated',
    jsonb_build_object(
      'action',        'payment_voided',
      'payment_id',    p_payment_id,
      'amount_voided', v_amount,
      'void_reason',   p_void_reason,
      'new_status',    v_new_status
    )
  );
END;
$$;

-- ─── 9. Grant execute to authenticated users ──────────────────────────────────

GRANT EXECUTE ON FUNCTION public.transition_invoice_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment    TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_invoice_payment      TO authenticated;

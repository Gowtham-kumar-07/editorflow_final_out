-- Sprint 10A: Invoice Management Foundation
--
-- Adds missing columns, enables/fixes RLS, creates concurrency-safe invoice
-- number sequences, and implements SECURITY DEFINER RPCs for all invoice
-- mutations (create, update, transition status).
--
-- OVERDUE STATUS DECISION: Derived, not persisted. When status='sent' and
-- due_date < current date, the UI shows "Overdue". The `overdue` enum value
-- exists for optional explicit marking via transition_invoice_status RPC.
-- No background cron job needed.

-- ─── 1. Extend invoices table ─────────────────────────────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS currency       TEXT    NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS tax_rate       NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type  TEXT    NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms  TEXT,
  ADD COLUMN IF NOT EXISTS created_by     UUID    REFERENCES auth.users(id);

-- ─── 2. Extend invoice_items table ───────────────────────────────────────────

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- organization_id is needed for simple RLS without a join
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Backfill organization_id from the parent invoice
UPDATE public.invoice_items ii
   SET organization_id = i.organization_id
  FROM public.invoices i
 WHERE ii.invoice_id = i.id
   AND ii.organization_id IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE public.invoice_items
  ALTER COLUMN organization_id SET NOT NULL;

-- ─── 3. Invoice number sequences (concurrency-safe, year-scoped) ─────────────

CREATE TABLE IF NOT EXISTS public.invoice_number_sequences (
  organization_id UUID    NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year            INTEGER NOT NULL,
  last_number     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, year)
);

-- ─── 4. Enable RLS on tables that lacked it ──────────────────────────────────

ALTER TABLE public.invoice_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_number_sequences ENABLE ROW LEVEL SECURITY;

-- ─── 5. Fix invoice RLS: replace permissive any-member policies ───────────────

DROP POLICY IF EXISTS "invoices: org members can delete" ON public.invoices;
DROP POLICY IF EXISTS "invoices: org members can insert" ON public.invoices;
DROP POLICY IF EXISTS "invoices: org members can read"   ON public.invoices;
DROP POLICY IF EXISTS "invoices: org members can update" ON public.invoices;

-- Only owner/admin/project_manager can see financial invoice data.
-- Members are deliberately excluded from invoice visibility.
CREATE POLICY "invoices: financial roles can read" ON public.invoices
  FOR SELECT
  USING (
    organization_id = ANY(public.get_my_org_ids())
    AND public.get_my_role_in_org(organization_id) IN ('owner', 'admin', 'project_manager')
  );

-- No INSERT / UPDATE / DELETE policies on invoices:
-- All mutations go through SECURITY DEFINER RPCs which bypass RLS.
-- Direct REST manipulation is therefore blocked.

-- ─── 6. invoice_items RLS ────────────────────────────────────────────────────

CREATE POLICY "invoice_items: financial roles can read" ON public.invoice_items
  FOR SELECT
  USING (
    organization_id = ANY(public.get_my_org_ids())
    AND public.get_my_role_in_org(organization_id) IN ('owner', 'admin', 'project_manager')
  );

-- ─── 7. payments RLS (read-only in Sprint 10A; 10B adds write policies) ──────

CREATE POLICY "payments: financial roles can read" ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
       WHERE i.id   = payments.invoice_id
         AND i.organization_id = ANY(public.get_my_org_ids())
         AND public.get_my_role_in_org(i.organization_id) IN ('owner', 'admin', 'project_manager')
    )
  );

-- invoice_number_sequences: no direct access allowed (SECURITY DEFINER only)

-- ─── 8. next_invoice_number(p_org_id) ────────────────────────────────────────
-- Atomically increments the per-org/per-year counter and returns a formatted
-- invoice number such as INV-2026-0001.
-- Uses INSERT … ON CONFLICT DO UPDATE with RETURNING for a single round-trip.

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year     INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_next_num INTEGER;
BEGIN
  INSERT INTO public.invoice_number_sequences (organization_id, year, last_number)
  VALUES (p_org_id, v_year, 1)
  ON CONFLICT (organization_id, year)
  DO UPDATE SET last_number = invoice_number_sequences.last_number + 1
  RETURNING last_number INTO v_next_num;

  RETURN 'INV-' || v_year::TEXT || '-' || LPAD(v_next_num::TEXT, 4, '0');
END;
$$;

-- ─── 9. create_invoice() ─────────────────────────────────────────────────────
-- Atomically inserts invoice header + line items, recomputes all financials
-- server-side (ignores any client-supplied totals), and logs activity.

CREATE OR REPLACE FUNCTION public.create_invoice(
  p_org_id         UUID,
  p_client_id      UUID,
  p_project_id     UUID,       -- NULL = no project
  p_issue_date     DATE,
  p_due_date       DATE,       -- NULL = no due date
  p_currency       TEXT,
  p_discount_type  TEXT,       -- 'fixed' | 'percent'
  p_discount_value NUMERIC,
  p_tax_rate       NUMERIC,    -- percentage, e.g. 18 = 18 %
  p_notes          TEXT,
  p_payment_terms  TEXT,
  p_line_items     JSONB       -- [{description, quantity, unit_price}, …]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID    := auth.uid();
  v_user_role    TEXT;
  v_invoice_id   UUID;
  v_invoice_num  TEXT;
  v_subtotal     NUMERIC := 0;
  v_discount_amt NUMERIC := 0;
  v_taxable      NUMERIC;
  v_tax_amt      NUMERIC;
  v_total        NUMERIC;
  v_item         JSONB;
  v_sort_order   INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_user_role := public.get_my_role_in_org(p_org_id);
  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin', 'project_manager') THEN
    RAISE EXCEPTION 'Insufficient permissions to create invoices';
  END IF;

  -- Validate client belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM public.clients
     WHERE id              = p_client_id
       AND organization_id = p_org_id
       AND deleted_at      IS NULL
  ) THEN
    RAISE EXCEPTION 'Client not found in this organization';
  END IF;

  -- Validate project belongs to client + org
  IF p_project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects
       WHERE id              = p_project_id
         AND organization_id = p_org_id
         AND client_id       = p_client_id
         AND deleted_at      IS NULL
    ) THEN
      RAISE EXCEPTION 'Project not found or does not belong to the selected client';
    END IF;
  END IF;

  -- At least one line item
  IF p_line_items IS NULL OR jsonb_array_length(p_line_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  -- Server-side subtotal computation (browser-supplied amounts are ignored)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    v_subtotal := v_subtotal +
      ROUND((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC, 2);
  END LOOP;

  -- Discount (clamp percentage to 100, clamp fixed to subtotal)
  IF p_discount_type = 'percent' THEN
    v_discount_amt := ROUND(v_subtotal * LEAST(p_discount_value, 100) / 100, 2);
  ELSE
    v_discount_amt := ROUND(LEAST(GREATEST(p_discount_value, 0), v_subtotal), 2);
  END IF;

  v_taxable := v_subtotal - v_discount_amt;
  v_tax_amt := ROUND(v_taxable * LEAST(GREATEST(p_tax_rate, 0), 100) / 100, 2);
  v_total   := v_taxable + v_tax_amt;

  -- Concurrency-safe invoice number
  v_invoice_num := public.next_invoice_number(p_org_id);

  -- Insert header
  INSERT INTO public.invoices (
    organization_id, client_id,    project_id,
    invoice_number,  status,
    issue_date,      due_date,
    currency,        subtotal,
    discount_type,   discount_value, discount,
    tax_rate,        tax,
    total,           notes,          payment_terms,  created_by
  ) VALUES (
    p_org_id,        p_client_id,   p_project_id,
    v_invoice_num,   'draft',
    p_issue_date,    p_due_date,
    p_currency,      v_subtotal,
    p_discount_type, p_discount_value, v_discount_amt,
    p_tax_rate,      v_tax_amt,
    v_total,         p_notes,          p_payment_terms,  v_user_id
  ) RETURNING id INTO v_invoice_id;

  -- Insert line items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id,    organization_id,
      description,   quantity,
      unit_price,    amount,
      sort_order
    ) VALUES (
      v_invoice_id,  p_org_id,
      v_item->>'description',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      ROUND((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC, 2),
      v_sort_order
    );
    v_sort_order := v_sort_order + 1;
  END LOOP;

  -- Activity log (uses 'created' activity_type)
  INSERT INTO public.activity_logs (
    organization_id, user_id,  entity_type, entity_id,
    activity_type,   metadata
  ) VALUES (
    p_org_id,        v_user_id, 'invoice',   v_invoice_id,
    'created',
    jsonb_build_object('invoice_number', v_invoice_num, 'total', v_total)
  );

  RETURN jsonb_build_object('id', v_invoice_id, 'invoice_number', v_invoice_num);
END;
$$;

-- ─── 10. update_invoice() ─────────────────────────────────────────────────────
-- Full replace of all header fields + line items for draft invoices.
-- Recomputes all financials server-side.

CREATE OR REPLACE FUNCTION public.update_invoice(
  p_invoice_id     UUID,
  p_client_id      UUID,
  p_project_id     UUID,       -- NULL = clear project link
  p_issue_date     DATE,
  p_due_date       DATE,       -- NULL = clear due date
  p_currency       TEXT,
  p_discount_type  TEXT,
  p_discount_value NUMERIC,
  p_tax_rate       NUMERIC,
  p_notes          TEXT,       -- NULL = clear notes
  p_payment_terms  TEXT,       -- NULL = clear payment terms
  p_line_items     JSONB
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
  v_subtotal       NUMERIC := 0;
  v_discount_amt   NUMERIC;
  v_taxable        NUMERIC;
  v_tax_amt        NUMERIC;
  v_total          NUMERIC;
  v_item           JSONB;
  v_sort_order     INTEGER := 0;
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
    RAISE EXCEPTION 'Insufficient permissions to edit invoices';
  END IF;

  -- Only draft invoices may be fully edited
  IF v_current_status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be edited (current status: %)', v_current_status;
  END IF;

  -- Validate project belongs to client + org
  IF p_project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects
       WHERE id              = p_project_id
         AND organization_id = v_org_id
         AND client_id       = p_client_id
         AND deleted_at      IS NULL
    ) THEN
      RAISE EXCEPTION 'Project not found or does not belong to the selected client';
    END IF;
  END IF;

  IF p_line_items IS NULL OR jsonb_array_length(p_line_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  -- Server-side recomputation
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    v_subtotal := v_subtotal +
      ROUND((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC, 2);
  END LOOP;

  IF p_discount_type = 'percent' THEN
    v_discount_amt := ROUND(v_subtotal * LEAST(p_discount_value, 100) / 100, 2);
  ELSE
    v_discount_amt := ROUND(LEAST(GREATEST(p_discount_value, 0), v_subtotal), 2);
  END IF;

  v_taxable := v_subtotal - v_discount_amt;
  v_tax_amt := ROUND(v_taxable * LEAST(GREATEST(p_tax_rate, 0), 100) / 100, 2);
  v_total   := v_taxable + v_tax_amt;

  -- Update header
  UPDATE public.invoices SET
    client_id      = p_client_id,
    project_id     = p_project_id,
    issue_date     = p_issue_date,
    due_date       = p_due_date,
    currency       = p_currency,
    discount_type  = p_discount_type,
    discount_value = p_discount_value,
    discount       = v_discount_amt,
    tax_rate       = p_tax_rate,
    tax            = v_tax_amt,
    subtotal       = v_subtotal,
    total          = v_total,
    notes          = p_notes,
    payment_terms  = p_payment_terms,
    updated_at     = now()
  WHERE id = p_invoice_id;

  -- Replace all line items atomically
  DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id,  organization_id,
      description, quantity,
      unit_price,  amount,
      sort_order
    ) VALUES (
      p_invoice_id, v_org_id,
      v_item->>'description',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      ROUND((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC, 2),
      v_sort_order
    );
    v_sort_order := v_sort_order + 1;
  END LOOP;

  INSERT INTO public.activity_logs (
    organization_id, user_id,  entity_type, entity_id,
    activity_type,   metadata
  ) VALUES (
    v_org_id,        v_user_id, 'invoice',   p_invoice_id,
    'updated',
    jsonb_build_object('total', v_total)
  );

  RETURN jsonb_build_object('id', p_invoice_id, 'total', v_total);
END;
$$;

-- ─── 11. transition_invoice_status() ─────────────────────────────────────────
-- Validated, role-gated status transitions.
-- Paid/partial transitions are blocked in Sprint 10A (reserved for Sprint 10B
-- payment recording logic).

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

  -- Sprint 10A: paid/partial transitions come from payment logic (Sprint 10B)
  IF p_new_status IN ('paid', 'partial') THEN
    RAISE EXCEPTION 'Paid status is set automatically when payment is recorded (Sprint 10B)';
  END IF;

  -- Allowed transitions for Sprint 10A
  IF NOT (
    (v_current_status = 'draft'   AND p_new_status IN ('sent',      'cancelled')) OR
    (v_current_status = 'sent'    AND p_new_status IN ('overdue',   'cancelled')) OR
    (v_current_status = 'overdue' AND p_new_status IN ('cancelled'))
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
    v_org_id,        v_user_id, 'invoice',   p_invoice_id,
    'updated',
    jsonb_build_object(
      'action', 'status_transition',
      'from',   v_current_status::TEXT,
      'to',     p_new_status::TEXT
    )
  );
END;
$$;

-- ─── 12. Grant execute to authenticated users ─────────────────────────────────
-- (SECURITY DEFINER functions are already callable; GRANTs affect the
--  PostgREST RPC endpoint visibility)

GRANT EXECUTE ON FUNCTION public.create_invoice            TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice            TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_invoice_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number       TO authenticated;

-- Sprint 12C: FX Snapshots for Multi-Currency Payments
--
-- Adds permanent FX snapshot columns to the payments table so that
-- historical revenue is always reported in the org's base currency
-- at the rate that was live at the time of payment.
-- Existing payments are backfilled with fx_rate = 1 and
-- fx_rate_source = 'fallback_1' (same-currency assumption).
-- Updates record_invoice_payment() to accept server-computed FX params.

-- ─── 1. Add FX snapshot columns ───────────────────────────────────────────────

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS transaction_currency TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS base_currency        TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fx_rate              NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_amount          NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fx_rate_source       TEXT    NOT NULL DEFAULT 'fallback_1'
    CONSTRAINT payments_fx_rate_source_check CHECK (fx_rate_source IN ('live', 'manual', 'fallback_1')),
  ADD COLUMN IF NOT EXISTS fx_rate_date         DATE;

-- ─── 2. Backfill existing payments ────────────────────────────────────────────
-- Joins to invoices and organizations to pull invoice currency and org base
-- currency.  Uses fx_rate = 1 and base_amount = amount (fallback_1 assumption)
-- because we have no historical exchange rates for existing payments.

UPDATE public.payments p
   SET transaction_currency = COALESCE(NULLIF(i.currency, ''), 'USD'),
       base_currency        = COALESCE(NULLIF(o.default_currency, ''), 'USD'),
       fx_rate              = 1,
       base_amount          = p.amount,
       fx_rate_source       = 'fallback_1',
       fx_rate_date         = p.payment_date
  FROM public.invoices      i
  JOIN public.organizations o ON o.id = i.organization_id
 WHERE p.invoice_id          = i.id
   AND p.transaction_currency = '';

-- ─── 3. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS payments_base_currency_idx ON public.payments (organization_id, base_currency);

-- ─── 4. Update record_invoice_payment() to store FX params ───────────────────
-- New optional params (with defaults) are backward-compatible: callers that
-- omit them get fx_rate = 1 / base_amount = p_amount / source = 'fallback_1'.
--
-- Drop the old 6-param overload first so CREATE OR REPLACE actually replaces
-- rather than creating a second overload (which would make the bare-name GRANT
-- ambiguous and fail).

DROP FUNCTION IF EXISTS public.record_invoice_payment(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id           UUID,
  p_amount               NUMERIC,
  p_payment_date         DATE,
  p_payment_method       TEXT,
  p_transaction_ref      TEXT,
  p_notes                TEXT,
  p_transaction_currency TEXT    DEFAULT NULL,
  p_base_currency        TEXT    DEFAULT NULL,
  p_fx_rate              NUMERIC DEFAULT 1,
  p_base_amount          NUMERIC DEFAULT NULL,
  p_fx_rate_source       TEXT    DEFAULT 'fallback_1',
  p_fx_rate_date         DATE    DEFAULT NULL
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
  v_inv_currency   TEXT;
  v_org_base_cur   TEXT;
  v_current_status public.invoice_status;
  v_total          NUMERIC;
  v_current_paid   NUMERIC;
  v_new_paid       NUMERIC;
  v_new_status     public.invoice_status;
  v_payment_id     UUID;
  v_eff_tx_cur     TEXT;
  v_eff_base_cur   TEXT;
  v_eff_base_amt   NUMERIC;
  v_eff_fx_date    DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Row-lock the invoice to prevent concurrent payment races
  SELECT i.organization_id, i.status, i.total, i.paid_amount, i.currency,
         o.default_currency
    INTO v_org_id, v_current_status, v_total, v_current_paid, v_inv_currency,
         v_org_base_cur
    FROM public.invoices i
    JOIN public.organizations o ON o.id = i.organization_id
   WHERE i.id = p_invoice_id AND i.deleted_at IS NULL
   FOR UPDATE OF i;

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

  IF v_new_paid >= v_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Resolve effective FX values: prefer caller-supplied, fall back to 1:1
  v_eff_tx_cur  := COALESCE(NULLIF(p_transaction_currency, ''), v_inv_currency, 'USD');
  v_eff_base_cur := COALESCE(NULLIF(p_base_currency, ''), v_org_base_cur, 'USD');
  v_eff_base_amt := COALESCE(p_base_amount, p_amount);
  v_eff_fx_date  := COALESCE(p_fx_rate_date, p_payment_date);

  INSERT INTO public.payments (
    invoice_id, organization_id, recorded_by,
    amount, payment_date, payment_method,
    transaction_reference, notes, status,
    transaction_currency, base_currency, fx_rate,
    base_amount, fx_rate_source, fx_rate_date
  ) VALUES (
    p_invoice_id, v_org_id, v_user_id,
    p_amount, p_payment_date, p_payment_method,
    p_transaction_ref, p_notes, 'completed',
    v_eff_tx_cur, v_eff_base_cur, p_fx_rate,
    v_eff_base_amt, p_fx_rate_source, v_eff_fx_date
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
      'payment_id',          v_payment_id,
      'amount',              p_amount,
      'transaction_currency', v_eff_tx_cur,
      'base_currency',       v_eff_base_cur,
      'base_amount',         v_eff_base_amt,
      'fx_rate',             p_fx_rate,
      'payment_method',      p_payment_method,
      'new_status',          v_new_status,
      'total_paid',          v_new_paid,
      'balance_due',         v_total - v_new_paid
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

GRANT EXECUTE ON FUNCTION public.record_invoice_payment(
  UUID, NUMERIC, DATE, TEXT, TEXT, TEXT,
  TEXT, TEXT, NUMERIC, NUMERIC, TEXT, DATE
) TO authenticated;

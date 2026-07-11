-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 12D · Complete Notification Integration
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Sprint 12B built the full notification foundation. Sprint 12C rewrote
-- record_invoice_payment to add FX snapshot columns but accidentally dropped
-- the payment notification loop. This migration:
--
--   1.  Extends notifications_type_check with five missing types
--   2.  Restores payment_received notification in record_invoice_payment
--       (the 12-param FX-aware version from Sprint 12C, with notification)
--   3.  Adds payment_voided notification to void_invoice_payment
--   4.  Adds member_role_changed notification to update_member_role
--   5.  Adds member_specialization_changed notification to update_member_specialization
--   6.  Adds member_reactivated notification to reactivate_member
--   7.  Fixes generate_overdue_invoice_notifications to use invoice_overdue type
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. Extend notifications_type_check ───────────────────────────────────────
--
-- Adding values to a text CHECK constraint requires DROP + ADD (unlike enum ALTER).
-- We preserve all existing values and append five new ones.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      -- existing Sprint 12B types
      'general',
      'task_assigned',
      'task_submitted_for_review',
      'task_revision_requested',
      'task_approved',
      'task_reopened',
      'project_assigned',
      'project_status_changed',
      'invoice_sent',
      'payment_received',
      'team_invitation_accepted',
      -- Sprint 12D additions
      'payment_voided',
      'member_role_changed',
      'member_specialization_changed',
      'member_reactivated',
      'invoice_overdue'
    )
  );


-- ─── 2. Restore payment_received notification in record_invoice_payment ────────
--
-- Sprint 12C (20260727_fx_snapshots.sql) rewrote this function to add FX snapshot
-- columns but inadvertently dropped the notification FOR LOOP that Sprint 12B had
-- added. This restores it with the full 12-param FX signature intact.

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
  v_invoice_number TEXT;
  v_eff_tx_cur     TEXT;
  v_eff_base_cur   TEXT;
  v_eff_base_amt   NUMERIC;
  v_eff_fx_date    DATE;
  v_recipient      RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Row-lock the invoice to prevent concurrent payment races
  SELECT i.organization_id, i.status, i.total, i.paid_amount, i.currency,
         i.invoice_number, o.default_currency
    INTO v_org_id, v_current_status, v_total, v_current_paid, v_inv_currency,
         v_invoice_number, v_org_base_cur
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
  v_eff_tx_cur   := COALESCE(NULLIF(p_transaction_currency, ''), v_inv_currency, 'USD');
  v_eff_base_cur := COALESCE(NULLIF(p_base_currency,        ''), v_org_base_cur, 'USD');
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
         paid_at     = CASE
                         WHEN v_new_status = 'paid' AND paid_at IS NULL THEN now()
                         ELSE paid_at
                       END,
         updated_at  = now()
   WHERE id = p_invoice_id;

  INSERT INTO public.activity_logs (
    organization_id, user_id,  entity_type, entity_id,
    activity_type,   metadata
  ) VALUES (
    v_org_id, v_user_id, 'invoice', p_invoice_id,
    'payment_received',
    jsonb_build_object(
      'payment_id',           v_payment_id,
      'amount',               p_amount,
      'transaction_currency', v_eff_tx_cur,
      'base_currency',        v_eff_base_cur,
      'base_amount',          v_eff_base_amt,
      'fx_rate',              p_fx_rate,
      'payment_method',       p_payment_method,
      'new_status',           v_new_status,
      'total_paid',           v_new_paid,
      'balance_due',          v_total - v_new_paid
    )
  );

  -- Notify financial roles about the payment (actor excluded by create_notification)
  FOR v_recipient IN
    SELECT m.user_id
      FROM public.organization_memberships m
     WHERE m.organization_id = v_org_id
       AND m.role IN ('owner', 'admin', 'project_manager')
       AND m.deleted_at IS NULL
  LOOP
    PERFORM public.create_notification(
      v_org_id,
      v_recipient.user_id,
      v_user_id,
      'payment_received',
      'Payment received',
      'Payment of ' || p_amount::text || ' ' || UPPER(v_eff_tx_cur) ||
        ' received for ' || v_invoice_number,
      'invoice', p_invoice_id,
      '/invoices/' || p_invoice_id::text
    );
  END LOOP;

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


-- ─── 3. Add payment_voided notification to void_invoice_payment ───────────────

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
  v_invoice_number TEXT;
  v_total          NUMERIC;
  v_current_paid   NUMERIC;
  v_new_paid       NUMERIC;
  v_new_status     public.invoice_status;
  v_due_date       DATE;
  v_recipient      RECORD;
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

  -- Row-lock the invoice and fetch invoice_number in one query
  SELECT status, total, paid_amount, due_date, invoice_number
    INTO v_invoice_status, v_total, v_current_paid, v_due_date, v_invoice_number
    FROM public.invoices
   WHERE id = v_invoice_id
   FOR UPDATE;

  v_new_paid := GREATEST(0, v_current_paid - v_amount);

  -- Determine restored invoice status
  IF v_invoice_status IN ('draft', 'cancelled') THEN
    v_new_status := v_invoice_status;
  ELSIF v_new_paid <= 0 THEN
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

  -- Notify financial roles about the voided payment (actor excluded by create_notification)
  FOR v_recipient IN
    SELECT m.user_id
      FROM public.organization_memberships m
     WHERE m.organization_id = v_org_id
       AND m.role IN ('owner', 'admin', 'project_manager')
       AND m.deleted_at IS NULL
  LOOP
    PERFORM public.create_notification(
      v_org_id,
      v_recipient.user_id,
      v_user_id,
      'payment_voided',
      'Payment voided',
      'A payment of ' || v_amount::text || ' on ' || v_invoice_number || ' was voided',
      'invoice', v_invoice_id,
      '/invoices/' || v_invoice_id::text
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_invoice_payment(uuid, text) TO authenticated;


-- ─── 4. Add member_role_changed notification to update_member_role ────────────

CREATE OR REPLACE FUNCTION public.update_member_role(
  p_org_id    uuid,
  p_target_id uuid,
  p_new_role  public.org_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id    uuid := auth.uid();
  v_caller_role  text;
  v_target_role  text;
  v_role_label   text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller_id = p_target_id THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  -- Ownership transfer not supported
  IF p_new_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot assign the owner role';
  END IF;

  v_caller_role := public.get_my_role_in_org(p_org_id);

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owner or admin can change member roles';
  END IF;

  SELECT role::text INTO v_target_role
    FROM public.organization_memberships
   WHERE organization_id = p_org_id
     AND user_id         = p_target_id
     AND deleted_at      IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target member not found in this organization';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot change the role of an owner';
  END IF;

  IF v_caller_role = 'admin' THEN
    IF v_target_role = 'admin' THEN
      RAISE EXCEPTION 'Admins cannot change the role of other admins';
    END IF;
    IF p_new_role NOT IN ('member', 'project_manager') THEN
      RAISE EXCEPTION 'Admins can only assign member or project_manager roles';
    END IF;
  END IF;

  UPDATE public.organization_memberships
     SET role       = p_new_role,
         updated_at = now()
   WHERE organization_id = p_org_id
     AND user_id         = p_target_id
     AND deleted_at      IS NULL;

  -- Human-readable role label for notification body
  v_role_label := CASE p_new_role::text
    WHEN 'project_manager' THEN 'Project Manager'
    WHEN 'admin'           THEN 'Admin'
    ELSE                        'Member'
  END;

  -- Notify the affected member about their role change
  PERFORM public.create_notification(
    p_org_id,
    p_target_id,
    v_caller_id,
    'member_role_changed',
    'Role updated',
    'Your role was changed to ' || v_role_label,
    'team', NULL,
    '/team'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, public.org_role) TO authenticated;


-- ─── 5. Add member_specialization_changed notification to update_member_specialization

CREATE OR REPLACE FUNCTION public.update_member_specialization(
  p_org_id         uuid,
  p_target_id      uuid,
  p_specialization text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_caller_role text;
  v_body        text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_caller_role := public.get_my_role_in_org(p_org_id);

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Self-update allowed for any role; otherwise requires owner/admin
  IF v_caller_id != p_target_id AND v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owner or admin can change another member''s specialization';
  END IF;

  IF p_specialization IS NOT NULL
     AND p_specialization NOT IN ('editor', 'designer', 'photographer', 'videographer', 'other') THEN
    RAISE EXCEPTION 'Invalid specialization value: %', p_specialization;
  END IF;

  UPDATE public.organization_memberships
     SET specialization = p_specialization,
         updated_at     = now()
   WHERE organization_id = p_org_id
     AND user_id         = p_target_id
     AND deleted_at      IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found in this organization';
  END IF;

  -- Only notify when someone else changed the specialization (self-updates are silent)
  IF v_caller_id != p_target_id THEN
    v_body := CASE
      WHEN p_specialization IS NULL THEN 'Your specialization was cleared'
      ELSE 'Your specialization was updated to ' || p_specialization
    END;

    PERFORM public.create_notification(
      p_org_id,
      p_target_id,
      v_caller_id,
      'member_specialization_changed',
      'Specialization updated',
      v_body,
      'team', NULL,
      '/team'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_member_specialization(uuid, uuid, text) TO authenticated;


-- ─── 6. Add member_reactivated notification to reactivate_member ──────────────
--
-- We do NOT notify on deactivate_member: the deactivated user loses org access
-- immediately and would never see the notification.

CREATE OR REPLACE FUNCTION public.reactivate_member(
  p_org_id    uuid,
  p_target_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_caller_role text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_caller_role := public.get_my_role_in_org(p_org_id);

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owner or admin can reactivate members';
  END IF;

  UPDATE public.organization_memberships
     SET deleted_at = NULL,
         updated_at = now()
   WHERE organization_id = p_org_id
     AND user_id         = p_target_id
     AND deleted_at      IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found or already active';
  END IF;

  -- Notify the reactivated member — they now have org access again
  PERFORM public.create_notification(
    p_org_id,
    p_target_id,
    v_caller_id,
    'member_reactivated',
    'Account reactivated',
    'Your account has been reactivated. Welcome back!',
    'team', NULL,
    '/dashboard'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivate_member(uuid, uuid) TO authenticated;


-- ─── 7. Fix generate_overdue_invoice_notifications to use invoice_overdue type ─
--
-- Sprint 12B used 'payment_received' as the type for overdue notifications
-- because 'invoice_overdue' did not yet exist in the constraint. Now it does.

CREATE OR REPLACE FUNCTION public.generate_overdue_invoice_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv       RECORD;
  v_recipient RECORD;
  v_count     integer := 0;
BEGIN
  FOR v_inv IN
    SELECT i.id, i.organization_id, i.invoice_number
      FROM public.invoices i
     WHERE i.status      IN ('sent', 'partial', 'overdue')
       AND i.due_date     < CURRENT_DATE
       AND i.balance_due  > 0
       AND i.deleted_at   IS NULL
  LOOP
    FOR v_recipient IN
      SELECT m.user_id
        FROM public.organization_memberships m
       WHERE m.organization_id = v_inv.organization_id
         AND m.role IN ('owner', 'admin', 'project_manager')
         AND m.deleted_at IS NULL
    LOOP
      PERFORM public.create_notification(
        v_inv.organization_id,
        v_recipient.user_id,
        NULL,                   -- system-generated; no actor
        'invoice_overdue',
        'Invoice overdue',
        'Invoice ' || v_inv.invoice_number || ' is overdue — payment is outstanding',
        'invoice', v_inv.id,
        '/invoices/' || v_inv.id::text,
        'invoice-overdue:' || v_inv.id::text || ':' || v_recipient.user_id::text
      );
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL  ON FUNCTION public.generate_overdue_invoice_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_overdue_invoice_notifications() TO authenticated;

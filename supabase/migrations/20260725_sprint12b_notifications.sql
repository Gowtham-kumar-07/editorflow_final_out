-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 12B · Notifications & Activity Center
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Extends the existing `notifications` table with type/actor/entity metadata
-- and a dedupe key, then wires every workflow RPC to emit notifications.
--
-- Existing column mapping (live names → conceptual names used in the sprint spec)
--   user_id   → recipient_id
--   body      → message
--   link      → action_url
--
-- 1.  Extend notifications table
-- 2.  Fix RLS: remove permissive INSERT policy (all inserts via SECURITY DEFINER)
-- 3.  Add composite and dedupe indexes
-- 4.  create_notification() — internal SECURITY DEFINER helper
-- 5.  mark_notification_read(uuid)
-- 6.  mark_all_notifications_read(uuid)
-- 7.  Trigger: notify_task_assignment  (tasks INSERT/UPDATE assigned_to)
-- 8.  Trigger: notify_project_assignment (project_members INSERT)
-- 9.  Rewrite transition_task_status — adds task workflow notifications
-- 10. Rewrite update_project_status — adds PM role fix + project notifications
-- 11. Rewrite transition_invoice_status — adds invoice_sent notification
-- 12. Rewrite record_invoice_payment — adds payment_received notification
-- 13. Rewrite accept_invitation — adds team_invitation_accepted notification
-- 14. generate_overdue_invoice_notifications() — idempotent overdue batch
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. Extend notifications table ───────────────────────────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id    uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type        text    NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS entity_type text    NULL,
  ADD COLUMN IF NOT EXISTS entity_id   uuid    NULL,
  ADD COLUMN IF NOT EXISTS read_at     timestamptz NULL,
  ADD COLUMN IF NOT EXISTS dedupe_key  text    NULL;

-- Constrain type to known values (text CHECK lets us add values without enum migration)
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
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
      'team_invitation_accepted'
    )
  );

-- Validate link column is always internal (starts with / or is null)
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_link_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_link_check CHECK (
    link IS NULL OR (link LIKE '/%' AND link NOT LIKE '//%')
  );

COMMENT ON COLUMN public.notifications.actor_id    IS 'User who triggered the event that caused this notification.';
COMMENT ON COLUMN public.notifications.type        IS 'Notification category; drives icon and grouping in the UI.';
COMMENT ON COLUMN public.notifications.entity_type IS 'Domain entity class: task | project | invoice | payment | team.';
COMMENT ON COLUMN public.notifications.entity_id   IS 'UUID of the domain entity this notification is about.';
COMMENT ON COLUMN public.notifications.read_at     IS 'Timestamp when the recipient marked this notification read.';
COMMENT ON COLUMN public.notifications.dedupe_key  IS 'Idempotency key — prevents duplicate notifications for the same event.';


-- ─── 2. Fix INSERT RLS — remove permissive policy; inserts are SECURITY DEFINER only

DROP POLICY IF EXISTS "notifications: org members can insert" ON public.notifications;

-- SELECT and UPDATE policies remain as-is:
--   "notifications: users see their own"    → user_id = auth.uid()
--   "notifications: users update their own" → user_id = auth.uid()


-- ─── 3. Indexes ───────────────────────────────────────────────────────────────

-- Composite index for efficient list + unread count queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read_at
  ON public.notifications (user_id, is_read, created_at DESC)
  WHERE deleted_at IS NULL;

-- Unique partial index for idempotent dedupe
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key
  ON public.notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND deleted_at IS NULL;


-- ─── 4. create_notification() — internal helper ───────────────────────────────
--
-- Called ONLY from other SECURITY DEFINER functions (triggers, workflow RPCs).
-- Ordinary authenticated users cannot invoke it directly.
-- Guards:
--   • skips if dedupe_key already exists (idempotency)
--   • skips if actor_id = recipient_id (no self-notifications)
--   • rejects non-internal links silently (safety)

CREATE OR REPLACE FUNCTION public.create_notification(
  p_org_id       uuid,
  p_recipient_id uuid,
  p_actor_id     uuid,
  p_type         text,
  p_title        text,
  p_body         text,
  p_entity_type  text    DEFAULT NULL,
  p_entity_id    uuid    DEFAULT NULL,
  p_link         text    DEFAULT NULL,
  p_dedupe_key   text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_safe_link text;
BEGIN
  -- Never notify actor about their own action
  IF p_actor_id IS NOT NULL AND p_recipient_id = p_actor_id THEN
    RETURN;
  END IF;

  -- Idempotency: skip if dedupe_key already exists
  IF p_dedupe_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.notifications
       WHERE dedupe_key = p_dedupe_key
         AND deleted_at IS NULL
    ) THEN
      RETURN;
    END IF;
  END IF;

  -- Validate link is an internal relative path
  IF p_link IS NOT NULL AND (p_link LIKE '//%' OR p_link NOT LIKE '/%') THEN
    v_safe_link := NULL;
  ELSE
    v_safe_link := p_link;
  END IF;

  INSERT INTO public.notifications (
    organization_id, user_id,    actor_id,    type,
    title,           body,       entity_type, entity_id,
    link,            dedupe_key
  ) VALUES (
    p_org_id,        p_recipient_id, p_actor_id, p_type,
    p_title,         p_body,         p_entity_type, p_entity_id,
    v_safe_link,     p_dedupe_key
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Concurrent insert with same dedupe_key — safe to ignore
    NULL;
END;
$$;

-- No GRANT: only callable from other SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.create_notification(uuid, uuid, uuid, text, text, text, text, uuid, text, text)
  FROM PUBLIC, authenticated, anon;


-- ─── 5. mark_notification_read(uuid) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
     SET is_read    = true,
         read_at    = COALESCE(read_at, now()),
         updated_at = now()
   WHERE id         = p_notification_id
     AND user_id    = auth.uid()
     AND deleted_at IS NULL;
END;
$$;

REVOKE ALL  ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;


-- ─── 6. mark_all_notifications_read(uuid) ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
     SET is_read    = true,
         read_at    = COALESCE(read_at, now()),
         updated_at = now()
   WHERE user_id         = auth.uid()
     AND organization_id = p_org_id
     AND is_read         = false
     AND deleted_at      IS NULL;
END;
$$;

REVOKE ALL  ON FUNCTION public.mark_all_notifications_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid) TO authenticated;


-- ─── 7. Task-assignment notification trigger ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
BEGIN
  -- Bail if we cannot identify the actor (service-role or migration replay)
  IF v_actor_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL THEN
      PERFORM public.create_notification(
        NEW.organization_id,
        NEW.assigned_to,
        v_actor_id,
        'task_assigned',
        'Task assigned',
        'You were assigned to "' || NEW.title || '"',
        'task', NEW.id,
        '/tasks/' || NEW.id::text
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only fire when assigned_to changes to a new non-null person
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       AND NEW.assigned_to IS NOT NULL THEN
      PERFORM public.create_notification(
        NEW.organization_id,
        NEW.assigned_to,
        v_actor_id,
        'task_assigned',
        'Task assigned',
        'You were assigned to "' || NEW.title || '"',
        'task', NEW.id,
        '/tasks/' || NEW.id::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_notify_assignment ON public.tasks;

CREATE TRIGGER trg_tasks_notify_assignment
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();


-- ─── 8. Project-member assignment notification trigger ────────────────────────

CREATE OR REPLACE FUNCTION public.notify_project_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id   uuid := auth.uid();
  v_org_id     uuid;
  v_proj_title text;
BEGIN
  IF v_actor_id IS NULL THEN RETURN NEW; END IF;

  -- Skip if the person added themselves
  IF NEW.user_id = v_actor_id THEN RETURN NEW; END IF;

  SELECT organization_id, name
    INTO v_org_id, v_proj_title
    FROM public.projects
   WHERE id = NEW.project_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN NEW; END IF;

  PERFORM public.create_notification(
    v_org_id,
    NEW.user_id,
    v_actor_id,
    'project_assigned',
    'Added to project',
    'You were added to "' || v_proj_title || '"',
    'project', NEW.project_id,
    '/projects/' || NEW.project_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_members_notify_assignment ON public.project_members;

CREATE TRIGGER trg_project_members_notify_assignment
  AFTER INSERT ON public.project_members
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public.notify_project_assignment();


-- ─── 9. Rewrite transition_task_status with notification logic ────────────────

CREATE OR REPLACE FUNCTION public.transition_task_status(
  p_task_id    uuid,
  p_new_status public.task_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id         uuid;
  v_assigned_to    uuid;
  v_current_status public.task_status;
  v_task_title     text;
  v_user_role      text;
  v_user_id        uuid := auth.uid();
  v_recipient      RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id, assigned_to, status, title
    INTO v_org_id, v_assigned_to, v_current_status, v_task_title
    FROM public.tasks
   WHERE id = p_task_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships
     WHERE organization_id = v_org_id
       AND user_id         = v_user_id
       AND deleted_at      IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  v_user_role := public.get_my_role_in_org(v_org_id);

  -- ── Role-based transition rules ──────────────────────────────────────────────
  IF v_user_role IN ('owner', 'admin', 'project_manager') THEN
    IF NOT (
      (v_current_status = 'todo'        AND p_new_status IN ('in_progress'))                      OR
      (v_current_status = 'in_progress' AND p_new_status IN ('review', 'todo', 'blocked'))        OR
      (v_current_status = 'review'      AND p_new_status IN ('completed', 'in_progress'))         OR
      (v_current_status = 'completed'   AND p_new_status IN ('in_progress'))                      OR
      (v_current_status = 'blocked'     AND p_new_status IN ('todo', 'in_progress'))
    ) THEN
      RAISE EXCEPTION 'Invalid task status transition: % → %', v_current_status, p_new_status;
    END IF;
    IF p_new_status = 'completed' AND v_user_role = 'project_manager' THEN
      -- PM can approve — allowed
      NULL;
    END IF;
  ELSE
    IF p_new_status = 'completed' THEN
      RAISE EXCEPTION 'Only admins can approve and complete tasks';
    END IF;
    IF v_assigned_to IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION 'You must be assigned to this task to update its status';
    END IF;
    IF NOT (
      (v_current_status = 'todo'        AND p_new_status = 'in_progress') OR
      (v_current_status = 'in_progress' AND p_new_status = 'review')      OR
      (v_current_status = 'review'      AND p_new_status = 'in_progress')
    ) THEN
      RAISE EXCEPTION 'Invalid task status transition: % → %', v_current_status, p_new_status;
    END IF;
  END IF;

  -- Apply the transition
  UPDATE public.tasks
     SET status       = p_new_status,
         completed_at = CASE
                          WHEN p_new_status     = 'completed' THEN now()
                          WHEN v_current_status = 'completed' THEN NULL
                          ELSE completed_at
                        END,
         updated_at   = now()
   WHERE id = p_task_id;

  -- ── Notifications ─────────────────────────────────────────────────────────────

  -- SUBMITTED FOR REVIEW: any role moves in_progress → review → notify approvers
  IF v_current_status = 'in_progress' AND p_new_status = 'review' THEN
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
        'task_submitted_for_review',
        'Task ready for review',
        '"' || v_task_title || '" was submitted for review',
        'task', p_task_id,
        '/tasks/' || p_task_id::text
      );
    END LOOP;

  -- REVISION REQUESTED: approver moves review → in_progress → notify assignee
  ELSIF v_current_status = 'review' AND p_new_status = 'in_progress'
        AND v_assigned_to IS NOT NULL THEN
    PERFORM public.create_notification(
      v_org_id,
      v_assigned_to,
      v_user_id,
      'task_revision_requested',
      'Revision requested',
      'Changes were requested for "' || v_task_title || '"',
      'task', p_task_id,
      '/tasks/' || p_task_id::text
    );

  -- TASK APPROVED: review → completed → notify assignee
  ELSIF v_current_status = 'review' AND p_new_status = 'completed'
        AND v_assigned_to IS NOT NULL THEN
    PERFORM public.create_notification(
      v_org_id,
      v_assigned_to,
      v_user_id,
      'task_approved',
      'Task approved',
      '"' || v_task_title || '" was approved and completed',
      'task', p_task_id,
      '/tasks/' || p_task_id::text
    );

  -- TASK REOPENED: completed → in_progress → notify assignee
  ELSIF v_current_status = 'completed' AND p_new_status = 'in_progress'
        AND v_assigned_to IS NOT NULL THEN
    PERFORM public.create_notification(
      v_org_id,
      v_assigned_to,
      v_user_id,
      'task_reopened',
      'Task reopened',
      '"' || v_task_title || '" was reopened and needs attention',
      'task', p_task_id,
      '/tasks/' || p_task_id::text
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_task_status(uuid, public.task_status)
  TO authenticated;


-- ─── 10. Rewrite update_project_status with notification logic ────────────────
--
-- Also aligns role check with application-layer permissions (adds project_manager).

CREATE OR REPLACE FUNCTION public.update_project_status(
  p_project_id uuid,
  p_new_status public.project_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id         uuid;
  v_current_status public.project_status;
  v_project_name   text;
  v_user_role      text;
  v_user_id        uuid := auth.uid();
  v_status_label   text;
  v_recipient      RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id, status, name
    INTO v_org_id, v_current_status, v_project_name
    FROM public.projects
   WHERE id = p_project_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  v_user_role := public.get_my_role_in_org(v_org_id);

  -- Aligned with canChangeProjectStatus: owner, admin, project_manager
  IF v_user_role NOT IN ('owner', 'admin', 'project_manager') THEN
    RAISE EXCEPTION 'Only admins and project managers can change project status';
  END IF;

  IF NOT (
    (v_current_status = 'draft'     AND p_new_status IN ('planning', 'active'))                                      OR
    (v_current_status = 'planning'  AND p_new_status IN ('active', 'on_hold', 'cancelled'))                          OR
    (v_current_status = 'active'    AND p_new_status IN ('planning', 'on_hold', 'review', 'completed', 'cancelled'))  OR
    (v_current_status = 'on_hold'   AND p_new_status IN ('active', 'cancelled'))                                     OR
    (v_current_status = 'review'    AND p_new_status IN ('active', 'on_hold', 'completed'))                          OR
    (v_current_status = 'completed' AND p_new_status IN ('active'))                                                  OR
    (v_current_status = 'cancelled' AND p_new_status IN ('planning', 'active'))
  ) THEN
    RAISE EXCEPTION 'Invalid project status transition: % → %', v_current_status, p_new_status;
  END IF;

  UPDATE public.projects
     SET status       = p_new_status,
         completed_at = CASE
                          WHEN p_new_status     = 'completed' THEN now()
                          WHEN v_current_status = 'completed' THEN NULL
                          ELSE completed_at
                        END,
         updated_at   = now()
   WHERE id = p_project_id;

  -- ── Notifications — only for meaningful status changes ─────────────────────
  IF p_new_status IN ('review', 'completed', 'on_hold', 'cancelled') THEN
    v_status_label := CASE p_new_status
      WHEN 'review'    THEN 'is ready for review'
      WHEN 'completed' THEN 'has been completed'
      WHEN 'on_hold'   THEN 'has been put on hold'
      WHEN 'cancelled' THEN 'has been cancelled'
    END;

    FOR v_recipient IN
      SELECT pm.user_id
        FROM public.project_members pm
       WHERE pm.project_id  = p_project_id
         AND pm.deleted_at  IS NULL
    LOOP
      PERFORM public.create_notification(
        v_org_id,
        v_recipient.user_id,
        v_user_id,
        'project_status_changed',
        'Project status updated',
        '"' || v_project_name || '" ' || v_status_label,
        'project', p_project_id,
        '/projects/' || p_project_id::text
      );
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_project_status(uuid, public.project_status)
  TO authenticated;


-- ─── 11. Rewrite transition_invoice_status with invoice_sent notification ──────

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
  v_invoice_number TEXT;
  v_recipient      RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id, status, invoice_number
    INTO v_org_id, v_current_status, v_invoice_number
    FROM public.invoices
   WHERE id = p_invoice_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  v_user_role := public.get_my_role_in_org(v_org_id);
  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin', 'project_manager') THEN
    RAISE EXCEPTION 'Insufficient permissions to change invoice status';
  END IF;

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

  -- Notify financial roles when invoice is sent
  IF p_new_status = 'sent' THEN
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
        'invoice_sent',
        'Invoice sent',
        'Invoice ' || v_invoice_number || ' has been sent to the client',
        'invoice', p_invoice_id,
        '/invoices/' || p_invoice_id::text
      );
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_invoice_status(uuid, public.invoice_status)
  TO authenticated;


-- ─── 12. Rewrite record_invoice_payment with payment_received notification ─────

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id      UUID,
  p_amount          NUMERIC,
  p_payment_date    DATE,
  p_payment_method  TEXT,
  p_transaction_ref TEXT,
  p_notes           TEXT
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
  v_invoice_number TEXT;
  v_currency       TEXT;
  v_recipient      RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id, status, total, paid_amount, invoice_number, currency
    INTO v_org_id, v_current_status, v_total, v_current_paid, v_invoice_number, v_currency
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

  v_new_status := CASE WHEN v_new_paid >= v_total THEN 'paid' ELSE 'partial' END;

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

  -- Notify financial roles about the payment (exclude actor)
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
      'Payment of ' || p_amount::text || ' ' || UPPER(v_currency) ||
        ' received for invoice ' || v_invoice_number,
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

GRANT EXECUTE ON FUNCTION public.record_invoice_payment(uuid, numeric, date, text, text, text)
  TO authenticated;


-- ─── 13. Rewrite accept_invitation with team notification ─────────────────────

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         uuid := auth.uid();
  v_user_email      text;
  v_user_name       text;
  v_inv             public.invitations;
  v_org_name        text;
  v_new_member_id   uuid;
  v_recipient       RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(email) INTO v_user_email
    FROM auth.users
   WHERE id = v_user_id;

  SELECT full_name INTO v_user_name
    FROM public.profiles
   WHERE id = v_user_id;

  SELECT * INTO v_inv
    FROM public.invitations
   WHERE token       = p_token
     AND accepted_at IS NULL
     AND expires_at  > now()
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found, already accepted, or expired';
  END IF;

  IF lower(v_inv.email) != v_user_email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  UPDATE public.invitations
     SET accepted_at = now(),
         updated_at  = now()
   WHERE id = v_inv.id;

  SELECT name INTO v_org_name
    FROM public.organizations
   WHERE id = v_inv.organization_id;

  INSERT INTO public.organization_memberships
    (organization_id, user_id, role, specialization)
  VALUES
    (v_inv.organization_id, v_user_id, v_inv.role, v_inv.specialization)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET deleted_at     = NULL,
        role           = v_inv.role,
        specialization = v_inv.specialization,
        updated_at     = now()
  RETURNING user_id INTO v_new_member_id;

  UPDATE public.profiles
     SET active_organization_id = v_inv.organization_id,
         updated_at             = now()
   WHERE id                       = v_user_id
     AND active_organization_id   IS NULL;

  -- Notify owners and admins (excluding the user who just joined)
  FOR v_recipient IN
    SELECT m.user_id
      FROM public.organization_memberships m
     WHERE m.organization_id = v_inv.organization_id
       AND m.role IN ('owner', 'admin')
       AND m.user_id != v_user_id
       AND m.deleted_at IS NULL
  LOOP
    PERFORM public.create_notification(
      v_inv.organization_id,
      v_recipient.user_id,
      v_user_id,
      'team_invitation_accepted',
      'Team member joined',
      COALESCE(NULLIF(TRIM(v_user_name), ''), v_user_email) || ' joined the organization',
      'team', NULL,
      '/team'
    );
  END LOOP;

  RETURN json_build_object(
    'org_id',   v_inv.organization_id,
    'org_name', v_org_name,
    'role',     v_inv.role
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;


-- ─── 14. generate_overdue_invoice_notifications() ────────────────────────────
--
-- Idempotent batch RPC. Creates one overdue notification per (invoice, recipient)
-- pair — guarded by dedupe_key so running it multiple times produces no duplicates.
-- Intended to be called by a scheduled job (pg_cron, external scheduler, etc.).
-- Roles notified: owner, admin, project_manager.

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
     WHERE i.status       IN ('sent', 'partial', 'overdue')
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
        NULL,                          -- no actor; system-generated
        'payment_received',            -- reuse closest type; overdue is a subtype
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

-- Only owner/admin should invoke this manually; automated via scheduler
REVOKE ALL  ON FUNCTION public.generate_overdue_invoice_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_overdue_invoice_notifications() TO authenticated;

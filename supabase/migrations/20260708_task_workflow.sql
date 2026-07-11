-- ─── Sprint 8D: Task Workflow + Project Quick Status ──────────────────────────
--
-- 1. Add completed_at to tasks (tracks when an admin approves the task)
-- 2. SECURITY DEFINER RPC: transition_task_status
--    Enforces workflow rules at the DB layer — closes the broad UPDATE RLS gap.
-- 3. SECURITY DEFINER RPC: update_project_status
--    Restricts project status changes to owner/admin at the DB layer.

-- ─── 1. tasks.completed_at ────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL;

COMMENT ON COLUMN public.tasks.completed_at IS
  'Set when an admin/owner approves the task (review → completed). Cleared on reopen.';

-- ─── 2. transition_task_status ───────────────────────────────────────────────

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
  v_user_role      text;
  v_user_id        uuid := auth.uid();
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Load task
  SELECT organization_id, assigned_to, status
    INTO v_org_id, v_assigned_to, v_current_status
    FROM public.tasks
   WHERE id = p_task_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  -- Verify active org membership
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships
     WHERE organization_id = v_org_id
       AND user_id         = v_user_id
       AND deleted_at      IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Determine role
  v_user_role := public.get_my_role_in_org(v_org_id);

  -- ── Role-based transition rules ──────────────────────────────────────────────
  IF v_user_role IN ('owner', 'admin') THEN
    -- Admin / owner: broad control, no nonsensical jumps
    IF NOT (
      (v_current_status = 'todo'        AND p_new_status IN ('in_progress'))                      OR
      (v_current_status = 'in_progress' AND p_new_status IN ('review', 'todo', 'blocked'))        OR
      (v_current_status = 'review'      AND p_new_status IN ('completed', 'in_progress'))         OR
      (v_current_status = 'completed'   AND p_new_status IN ('in_progress'))                      OR
      (v_current_status = 'blocked'     AND p_new_status IN ('todo', 'in_progress'))
    ) THEN
      RAISE EXCEPTION 'Invalid task status transition: % → %', v_current_status, p_new_status;
    END IF;

  ELSE
    -- Member: cannot complete; must be the assignee
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_task_status(uuid, public.task_status)
  TO authenticated;

-- ─── 3. update_project_status ─────────────────────────────────────────────────

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
  v_user_role      text;
  v_user_id        uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id, status
    INTO v_org_id, v_current_status
    FROM public.projects
   WHERE id = p_project_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  v_user_role := public.get_my_role_in_org(v_org_id);

  IF v_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only admins can change project status';
  END IF;

  -- Sensible transitions only
  IF NOT (
    (v_current_status = 'draft'     AND p_new_status IN ('planning', 'active'))                                    OR
    (v_current_status = 'planning'  AND p_new_status IN ('active', 'on_hold', 'cancelled'))                        OR
    (v_current_status = 'active'    AND p_new_status IN ('planning', 'on_hold', 'review', 'completed', 'cancelled')) OR
    (v_current_status = 'on_hold'   AND p_new_status IN ('active', 'cancelled'))                                   OR
    (v_current_status = 'review'    AND p_new_status IN ('active', 'on_hold', 'completed'))                        OR
    (v_current_status = 'completed' AND p_new_status IN ('active'))                                                OR
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_project_status(uuid, public.project_status)
  TO authenticated;

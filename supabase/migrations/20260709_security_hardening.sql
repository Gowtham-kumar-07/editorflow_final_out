-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 8E · Workflow Authorization Hardening
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Closes the REST API bypass gap: authenticated members could directly PATCH
-- tasks.status, tasks.completed_at, and projects.status, skipping the RPC
-- workflow rules. Enforcement is at the database layer only.
--
-- Changes:
--   1. Column-level REVOKE on workflow fields (tasks + projects)
--   2. Tighten RPC EXECUTE grants (remove PUBLIC / anon)
--   3. Fix get_my_role_in_org to exclude soft-deleted memberships
--   4. Fix NULL-role bypass in update_project_status
--   5. New archive_project SECURITY DEFINER RPC (replaces direct .update)
--   6. Extend update_project_status with archived → active (restore path)
--   7. check_task_assignee_org trigger (cross-org assignment guard)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. Lock workflow columns ─────────────────────────────────────────────────
--
-- After this, any REST PATCH that touches status / completed_at from an
-- authenticated client will receive a permission error.
-- SECURITY DEFINER functions run as postgres and are unaffected.

REVOKE UPDATE(status, completed_at) ON public.tasks    FROM authenticated, anon;
REVOKE UPDATE(status)               ON public.projects FROM authenticated, anon;


-- ─── 2. Tighten RPC EXECUTE grants ───────────────────────────────────────────
--
-- Supabase grants EXECUTE to PUBLIC on all functions by default.
-- Restrict workflow RPCs to authenticated users only; the internal auth.uid()
-- check remains as defense-in-depth.

REVOKE EXECUTE ON FUNCTION public.transition_task_status(uuid, public.task_status)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.transition_task_status(uuid, public.task_status)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_project_status(uuid, public.project_status)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_project_status(uuid, public.project_status)
  TO authenticated;


-- ─── 3. Fix get_my_role_in_org ───────────────────────────────────────────────
--
-- Previous version did not filter deleted_at IS NULL, meaning soft-deleted
-- members could still receive a role and pass permission checks.

CREATE OR REPLACE FUNCTION public.get_my_role_in_org(org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM   public.organization_memberships
  WHERE  organization_id = org_id
    AND  user_id         = auth.uid()
    AND  deleted_at      IS NULL
  LIMIT 1;
$$;


-- ─── 4. Fix update_project_status ────────────────────────────────────────────
--
-- Previous version used `v_user_role NOT IN ('owner','admin')` which evaluates
-- to NULL (not TRUE) when get_my_role_in_org returns NULL for non-members,
-- allowing a non-member to bypass the role check.
--
-- Also adds the archived → active transition for the restore path, so
-- dbRestoreProject can go through the RPC instead of a direct .update().

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

  -- Explicit NULL check: non-members get NULL from get_my_role_in_org;
  -- NULL NOT IN (...) evaluates to NULL (falsy), not TRUE — so we must
  -- guard NULL separately to avoid a bypass.
  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only admins can change project status';
  END IF;

  IF NOT (
    (v_current_status = 'draft'     AND p_new_status IN ('planning', 'active'))                                     OR
    (v_current_status = 'planning'  AND p_new_status IN ('active', 'on_hold', 'cancelled'))                         OR
    (v_current_status = 'active'    AND p_new_status IN ('planning', 'on_hold', 'review', 'completed', 'cancelled')) OR
    (v_current_status = 'on_hold'   AND p_new_status IN ('active', 'cancelled'))                                    OR
    (v_current_status = 'review'    AND p_new_status IN ('active', 'on_hold', 'completed'))                         OR
    (v_current_status = 'completed' AND p_new_status IN ('active'))                                                  OR
    (v_current_status = 'cancelled' AND p_new_status IN ('planning', 'active'))                                      OR
    (v_current_status = 'archived'  AND p_new_status IN ('active'))
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

REVOKE EXECUTE ON FUNCTION public.update_project_status(uuid, public.project_status)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_project_status(uuid, public.project_status)
  TO authenticated;


-- ─── 5. archive_project SECURITY DEFINER RPC ─────────────────────────────────
--
-- Replaces dbArchiveProject's direct .update({ status: 'archived' }), which
-- would fail after the column-level REVOKE on projects.status.
-- Only owners and admins may archive; non-members are explicitly rejected.

CREATE OR REPLACE FUNCTION public.archive_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    uuid;
  v_user_role text;
  v_user_id   uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id
    INTO v_org_id
    FROM public.projects
   WHERE id = p_project_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  v_user_role := public.get_my_role_in_org(v_org_id);

  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only admins can archive projects';
  END IF;

  UPDATE public.projects
     SET status     = 'archived',
         updated_at = now()
   WHERE id = p_project_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_project(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.archive_project(uuid) TO authenticated;


-- ─── 6. Cross-org task assignment guard ──────────────────────────────────────
--
-- Prevents setting tasks.assigned_to to a user who is not an active member of
-- the task's organization. Fires on UPDATE OF assigned_to only (INSERT is
-- guarded by the application layer via org-member dropdowns and RLS).

CREATE OR REPLACE FUNCTION public.check_task_assignee_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_memberships
       WHERE organization_id = NEW.organization_id
         AND user_id         = NEW.assigned_to
         AND deleted_at      IS NULL
    ) THEN
      RAISE EXCEPTION 'Assignee is not a member of this organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_assignee_org ON public.tasks;
CREATE TRIGGER trg_task_assignee_org
  BEFORE UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_task_assignee_org();

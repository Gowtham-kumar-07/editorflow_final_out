-- ============================================================================
-- Sprint 9B: Permission Hardening
-- Restricts task and project INSERT/UPDATE to managers (owner, admin, project_manager).
-- Adds cancel_invitation RPC.
-- ============================================================================

-- ─── Tasks: restrict INSERT to managers ──────────────────────────────────────

DROP POLICY IF EXISTS "tasks: org members can insert" ON public.tasks;
CREATE POLICY "tasks: managers can insert"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = ANY(public.get_my_org_ids())
    AND public.get_my_role_in_org(organization_id) IN ('owner', 'admin', 'project_manager')
  );

-- ─── Tasks: restrict UPDATE to managers ──────────────────────────────────────
-- Members transition task status exclusively via the transition_task_status()
-- SECURITY DEFINER RPC (runs as postgres, bypasses RLS). They need no direct
-- UPDATE access to the tasks table.

DROP POLICY IF EXISTS "tasks: org members can update" ON public.tasks;
CREATE POLICY "tasks: managers can update"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    organization_id = ANY(public.get_my_org_ids())
    AND public.get_my_role_in_org(organization_id) IN ('owner', 'admin', 'project_manager')
  );

-- ─── Projects: restrict INSERT to managers ───────────────────────────────────

DROP POLICY IF EXISTS "projects: members can create" ON public.projects;
CREATE POLICY "projects: managers can create"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = ANY(public.get_my_org_ids())
    AND public.get_my_role_in_org(organization_id) IN ('owner', 'admin', 'project_manager')
    AND created_by = auth.uid()
  );

-- ─── Projects: restrict UPDATE to managers ───────────────────────────────────

DROP POLICY IF EXISTS "projects: members can update" ON public.projects;
CREATE POLICY "projects: managers can update"
  ON public.projects FOR UPDATE TO authenticated
  USING (
    organization_id = ANY(public.get_my_org_ids())
    AND public.get_my_role_in_org(organization_id) IN ('owner', 'admin', 'project_manager')
  );

-- ─── Cancel invitation RPC ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   text;
  v_org_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM invitations
  WHERE id = p_invitation_id
    AND accepted_at IS NULL;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or already accepted';
  END IF;

  v_role := get_my_role_in_org(v_org_id);
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied: only owners and admins can cancel invitations';
  END IF;

  -- Expire immediately so it is filtered out of the pending list
  UPDATE invitations
  SET expires_at = now() - interval '1 second',
      updated_at = now()
  WHERE id = p_invitation_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_invitation(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_invitation(uuid) TO authenticated;

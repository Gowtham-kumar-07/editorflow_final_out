-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 9A · Team Foundation
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1. Add project_manager to org_role enum
-- 2. Add specialization to organization_memberships
-- 3. Add email to profiles; backfill; fix handle_new_user
-- 4. Fix get_my_org_ids to filter deleted_at IS NULL (defense-in-depth)
-- 5. Add profiles SELECT policy for org-member team views
-- 6. Update transition_task_status for project_manager authority
-- 7. Update update_project_status for project_manager authority
-- 8. Update archive_project for project_manager authority
-- 9. New update_member_role SECURITY DEFINER RPC
-- 10. New update_member_specialization SECURITY DEFINER RPC
-- 11. New deactivate_member SECURITY DEFINER RPC
-- 12. New reactivate_member SECURITY DEFINER RPC
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. Add project_manager to org_role enum ─────────────────────────────────

ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'project_manager' AFTER 'admin';


-- ─── 2. specialization on organization_memberships ───────────────────────────

ALTER TABLE public.organization_memberships
  ADD COLUMN IF NOT EXISTS specialization text NULL;

COMMENT ON COLUMN public.organization_memberships.specialization IS
  'Kind of work this member does: editor, designer, photographer, videographer, other';


-- ─── 3. email on profiles ────────────────────────────────────────────────────
--
-- Profiles are created by handle_new_user() which previously did not store
-- email. We add the column, backfill from auth.users, and update the trigger
-- so new signups populate it automatically.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text NULL;

COMMENT ON COLUMN public.profiles.email IS
  'User email copied from auth.users at signup. Used for team display.';

-- Backfill existing profiles
UPDATE public.profiles p
   SET email = u.email
  FROM auth.users u
 WHERE p.id = u.id
   AND p.email IS NULL;

-- Update trigger to populate email on new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        updated_at = now();
  RETURN new;
END;
$$;


-- ─── 4. get_my_org_ids: ensure deleted_at IS NULL filter ─────────────────────
--
-- Defense-in-depth: the schema.sql version already has this filter; this
-- CREATE OR REPLACE is a no-op if the live DB is already correct, but fixes
-- any environment where an old version without the filter is running.

CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT coalesce(array_agg(organization_id), '{}'::uuid[])
  FROM   public.organization_memberships
  WHERE  user_id    = auth.uid()
    AND  deleted_at IS NULL;
$$;


-- ─── 5. Profiles SELECT policy for team views ────────────────────────────────
--
-- The existing "profiles: users can read own" policy only allows a user to
-- read their own profile row.  The team page needs to read profiles of all
-- active members within the same org(s).
--
-- This PERMISSIVE policy adds that access: both policies are checked and
-- either one passing is sufficient, so self-reads continue to work.

DROP POLICY IF EXISTS "profiles: org members can view team profiles" ON public.profiles;

CREATE POLICY "profiles: org members can view team profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.organization_memberships viewer
      WHERE  viewer.user_id      = auth.uid()
        AND  viewer.deleted_at   IS NULL
        AND  viewer.organization_id IN (
               SELECT m2.organization_id
               FROM   public.organization_memberships m2
               WHERE  m2.user_id    = profiles.id
                 AND  m2.deleted_at IS NULL
             )
    )
  );


-- ─── 6. transition_task_status: add project_manager ──────────────────────────

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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id, assigned_to, status
    INTO v_org_id, v_assigned_to, v_current_status
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

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- owner / admin / project_manager: broad workflow control
  IF v_user_role IN ('owner', 'admin', 'project_manager') THEN
    IF NOT (
      (v_current_status = 'todo'        AND p_new_status IN ('in_progress'))               OR
      (v_current_status = 'in_progress' AND p_new_status IN ('review', 'todo', 'blocked')) OR
      (v_current_status = 'review'      AND p_new_status IN ('completed', 'in_progress'))  OR
      (v_current_status = 'completed'   AND p_new_status IN ('in_progress'))               OR
      (v_current_status = 'blocked'     AND p_new_status IN ('todo', 'in_progress'))
    ) THEN
      RAISE EXCEPTION 'Invalid task status transition: % → %', v_current_status, p_new_status;
    END IF;
  ELSE
    -- member: cannot complete; must be the assignee
    IF p_new_status = 'completed' THEN
      RAISE EXCEPTION 'Only admins and project managers can approve and complete tasks';
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


-- ─── 7. update_project_status: add project_manager ───────────────────────────

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

  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin', 'project_manager') THEN
    RAISE EXCEPTION 'Only admins and project managers can change project status';
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


-- ─── 8. archive_project: add project_manager ─────────────────────────────────

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

  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin', 'project_manager') THEN
    RAISE EXCEPTION 'Only admins and project managers can archive projects';
  END IF;

  UPDATE public.projects
     SET status     = 'archived',
         updated_at = now()
   WHERE id = p_project_id;
END;
$$;


-- ─── 9. update_member_role RPC ───────────────────────────────────────────────
--
-- Role change hierarchy:
--   owner → can change any member's role except other owners; cannot assign 'owner'
--   admin → can change member/project_manager only; cannot touch admins or owners
--   Cannot change own role.

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
  v_caller_id   uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
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

  -- Nobody can change an owner's role
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot change the role of an owner';
  END IF;

  -- Admin can only manage member / project_manager (not other admins)
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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, public.org_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, public.org_role) TO authenticated;


-- ─── 10. update_member_specialization RPC ────────────────────────────────────
--
-- Members may update their own specialization; owner/admin can update anyone's.

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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_member_specialization(uuid, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_member_specialization(uuid, uuid, text) TO authenticated;


-- ─── 11. deactivate_member RPC ───────────────────────────────────────────────
--
-- Sets deleted_at on the membership row (soft-delete).
-- Security invariants:
--   • Cannot deactivate the only owner.
--   • Cannot self-deactivate.
--   • Admin cannot deactivate other admins or owners.

CREATE OR REPLACE FUNCTION public.deactivate_member(
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
  v_target_role text;
  v_owner_count int;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller_id = p_target_id THEN
    RAISE EXCEPTION 'Cannot deactivate yourself';
  END IF;

  v_caller_role := public.get_my_role_in_org(p_org_id);

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owner or admin can deactivate members';
  END IF;

  SELECT role::text INTO v_target_role
    FROM public.organization_memberships
   WHERE organization_id = p_org_id
     AND user_id         = p_target_id
     AND deleted_at      IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found or already inactive';
  END IF;

  -- Admin cannot deactivate other admins or owners
  IF v_caller_role = 'admin' AND v_target_role IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Admins cannot deactivate owners or other admins';
  END IF;

  -- Protect last owner
  IF v_target_role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
      FROM public.organization_memberships
     WHERE organization_id = p_org_id
       AND role            = 'owner'
       AND deleted_at      IS NULL;

    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot deactivate the only owner of an organization';
    END IF;
  END IF;

  UPDATE public.organization_memberships
     SET deleted_at = now(),
         updated_at = now()
   WHERE organization_id = p_org_id
     AND user_id         = p_target_id
     AND deleted_at      IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deactivate_member(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.deactivate_member(uuid, uuid) TO authenticated;


-- ─── 12. reactivate_member RPC ───────────────────────────────────────────────

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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reactivate_member(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reactivate_member(uuid, uuid) TO authenticated;

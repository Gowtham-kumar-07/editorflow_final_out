-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 12C · Profile Backfill & update_my_profile RPC
-- ─────────────────────────────────────────────────────────────────────────────
-- Root cause: auth users whose profile row was never created by handle_new_user
-- (trigger failure, pre-trigger account creation, or similar) have no
-- public.profiles row.  Symptoms:
--   • Settings → Personal Profile shows empty name/email
--   • Team page owner row shows "—" for name
--   • Profile saves succeed (204) but persist nothing (UPDATE matches 0 rows)
--
-- Steps:
--   1. Backfill missing profiles rows from auth.users
--   2. Back-fill active_organization_id where still NULL
--   3. Fix handle_new_user: use NULL instead of email as full_name fallback
--   4. Add update_my_profile SECURITY DEFINER RPC (UPSERT — handles both
--      "row exists" and "row missing" cases)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Backfill missing profile rows ─────────────────────────────────────────
-- Idempotent: ON CONFLICT DO NOTHING is a safety net for concurrent runs.
-- full_name is NULL for users without it in metadata (do not use email as name).

INSERT INTO public.profiles (id, full_name, email, avatar_url)
SELECT
  u.id,
  NULLIF(trim(COALESCE(u.raw_user_meta_data->>'full_name', '')), ''),
  u.email,
  NULLIF(trim(COALESCE(u.raw_user_meta_data->>'avatar_url', '')), '')
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;


-- ─── 2. Back-fill active_organization_id ──────────────────────────────────────
-- create_organization sets this on INSERT but silently matched 0 rows when the
-- profile row was missing.  Use the earliest active membership as the default.

UPDATE public.profiles p
   SET active_organization_id = (
         SELECT m.organization_id
         FROM   public.organization_memberships m
         WHERE  m.user_id    = p.id
           AND  m.deleted_at IS NULL
         ORDER  BY m.created_at ASC
         LIMIT  1
       )
 WHERE p.active_organization_id IS NULL;


-- ─── 3. Fix handle_new_user ────────────────────────────────────────────────────
-- Old: coalesce(full_name_meta, email) → new users get their email stored as
-- their display name, which confuses Team page.
-- New: NULLIF(trim(...), '') → NULL when not provided; users set it via profile.

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
    NULLIF(trim(COALESCE(new.raw_user_meta_data->>'full_name', '')), ''),
    NULLIF(trim(COALESCE(new.raw_user_meta_data->>'avatar_url', '')), ''),
    new.email
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        updated_at = now();
  RETURN new;
END;
$$;


-- ─── 4. update_my_profile SECURITY DEFINER RPC ─────────────────────────────────
-- UPSERT-based profile update that works regardless of whether a profile row
-- already exists.  Target user is always derived from auth.uid() — the browser
-- never supplies a user ID.
--
-- INSERT path (no existing row):
--   Creates the profile row, pulling email and avatar_url from auth.users.
-- UPDATE path (row already exists):
--   Only updates full_name and updated_at; leaves email and avatar_url intact.
--
-- Returns json { id, full_name, email, avatar_url } for immediate UI display.

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result  json;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Full name cannot be empty' USING ERRCODE = 'P0010';
  END IF;

  IF length(trim(p_full_name)) > 100 THEN
    RAISE EXCEPTION 'Full name is too long (max 100 characters)' USING ERRCODE = 'P0011';
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  SELECT
    v_user_id,
    trim(p_full_name),
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'avatar_url', '')), ''),
    u.email
  FROM auth.users u
  WHERE u.id = v_user_id
  ON CONFLICT (id) DO UPDATE
    SET full_name  = EXCLUDED.full_name,
        updated_at = now();

  SELECT json_build_object(
    'id',         id,
    'full_name',  full_name,
    'email',      email,
    'avatar_url', avatar_url
  )
  INTO   v_result
  FROM   public.profiles
  WHERE  id = v_user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL     ON FUNCTION public.update_my_profile(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_my_profile(text) TO authenticated;

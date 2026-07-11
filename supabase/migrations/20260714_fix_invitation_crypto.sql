-- ============================================================================
-- Sprint 9B fix: schema-qualify gen_random_bytes in create_invitation
--
-- Root cause:
--   create_invitation uses SET search_path = public (required for SECURITY
--   DEFINER hardening). pgcrypto is installed by Supabase Cloud into the
--   'extensions' schema, not 'public'. With a restricted search_path the
--   unqualified call gen_random_bytes(32) is invisible, producing:
--     "function gen_random_bytes(integer) does not exist"
--
-- Fix:
--   Replace gen_random_bytes(32) with extensions.gen_random_bytes(32).
--   The search_path stays as SET search_path = public — we only
--   schema-qualify the one external function reference.
--
-- All other invitation logic (expiry, role validation, member-check,
-- token format, SECURITY DEFINER, grants) is unchanged.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_invitation(
  p_org_id         uuid,
  p_email          text,
  p_role           public.org_role DEFAULT 'member',
  p_specialization text           DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_caller_role text;
  v_token       text;
  v_inv_id      uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_caller_role := public.get_my_role_in_org(p_org_id);

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owner or admin can invite members';
  END IF;

  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot invite someone directly as owner';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF p_specialization IS NOT NULL
     AND p_specialization NOT IN ('editor', 'designer', 'photographer', 'videographer', 'other') THEN
    RAISE EXCEPTION 'Invalid specialization value: %', p_specialization;
  END IF;

  -- Check if already an active member (match on email stored in profiles)
  IF EXISTS (
    SELECT 1
    FROM   public.organization_memberships m
    JOIN   public.profiles pr ON pr.id = m.user_id
    WHERE  m.organization_id = p_org_id
      AND  lower(pr.email)   = lower(trim(p_email))
      AND  m.deleted_at      IS NULL
  ) THEN
    RAISE EXCEPTION 'This email is already an active member of the organization';
  END IF;

  -- Expire any pending invitations for the same email+org
  UPDATE public.invitations
     SET expires_at = now() - interval '1 second',
         updated_at = now()
   WHERE organization_id = p_org_id
     AND lower(email)    = lower(trim(p_email))
     AND accepted_at     IS NULL
     AND expires_at      > now();

  -- Generate 256-bit random token via pgcrypto (schema-qualified to work
  -- within the restricted SET search_path = public context)
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.invitations
    (organization_id, email, role, specialization, token, invited_by, expires_at)
  VALUES
    (p_org_id, lower(trim(p_email)), p_role, p_specialization, v_token, v_caller_id, now() + interval '7 days')
  RETURNING id INTO v_inv_id;

  RETURN json_build_object('token', v_token, 'invitation_id', v_inv_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invitation(uuid, text, public.org_role, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_invitation(uuid, text, public.org_role, text) TO authenticated;

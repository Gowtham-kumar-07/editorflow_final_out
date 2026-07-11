-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 9A · Invitation System
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Creates the invitations table and three SECURITY DEFINER RPCs:
--   create_invitation  — owner/admin creates an invitation, gets back the token
--   accept_invitation  — user redeems a token to join the org
--   get_invitation_by_token — public read of invitation details (for acceptance UI)
--
-- Token security:
--   Tokens are 32-byte random values encoded as 64-char hex (256 bits entropy).
--   They are single-use (marked accepted_at on redemption) and expire after 7 days.
--   Stored directly (not hashed) for this sprint — they are short-lived secrets
--   revealed once to the inviting admin and never reused.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── invitations table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invitations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           text        NOT NULL,
  role            public.org_role NOT NULL DEFAULT 'member',
  specialization  text        NULL,
  token           text        NOT NULL UNIQUE,
  invited_by      uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at      timestamptz NOT NULL,
  accepted_at     timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_invitation_email    CHECK (char_length(email) BETWEEN 3 AND 320),
  CONSTRAINT chk_invitation_role     CHECK (role != 'owner'),
  CONSTRAINT chk_invitation_expires  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_invitations_org_email
  ON public.invitations (organization_id, email);

CREATE INDEX IF NOT EXISTS idx_invitations_token
  ON public.invitations (token);

CREATE TRIGGER trg_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Owner/admin can list invitations for their org
CREATE POLICY "invitations: owner/admin can view"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (
    organization_id = ANY (public.get_my_org_ids())
    AND public.get_my_role_in_org(organization_id) IN ('owner', 'admin')
  );

-- All writes go through SECURITY DEFINER RPCs; deny direct REST mutations
CREATE POLICY "invitations: no direct insert"
  ON public.invitations FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "invitations: no direct update"
  ON public.invitations FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "invitations: no direct delete"
  ON public.invitations FOR DELETE
  TO authenticated
  USING (false);


-- ─── create_invitation RPC ────────────────────────────────────────────────────
--
-- Returns JSON: { "token": "<hex>", "invitation_id": "<uuid>" }
-- The token is returned once; the caller must store/display it to share.
-- Any previously pending invitation for the same (org, email) pair is expired.

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

  -- Generate 256-bit random token
  v_token := encode(gen_random_bytes(32), 'hex');

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


-- ─── accept_invitation RPC ────────────────────────────────────────────────────
--
-- Redeems a token for the currently authenticated user.
-- Validates: token is valid, not expired, not already accepted, email matches.
-- Creates or reactivates the user's membership with the invited role.
-- Returns JSON: { "org_id": "...", "org_name": "...", "role": "..." }

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_user_email text;
  v_inv        public.invitations;
  v_org_name   text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the accepting user's email from the authoritative source
  SELECT lower(email) INTO v_user_email
    FROM auth.users
   WHERE id = v_user_id;

  -- Find and validate the invitation
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

  -- Mark accepted
  UPDATE public.invitations
     SET accepted_at = now(),
         updated_at  = now()
   WHERE id = v_inv.id;

  -- Get org name for redirect
  SELECT name INTO v_org_name
    FROM public.organizations
   WHERE id = v_inv.organization_id;

  -- Create or reactivate membership
  INSERT INTO public.organization_memberships
    (organization_id, user_id, role, specialization)
  VALUES
    (v_inv.organization_id, v_user_id, v_inv.role, v_inv.specialization)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET deleted_at     = NULL,
        role           = v_inv.role,
        specialization = v_inv.specialization,
        updated_at     = now();

  -- Set as active org if user has no active org yet
  UPDATE public.profiles
     SET active_organization_id = v_inv.organization_id,
         updated_at             = now()
   WHERE id                       = v_user_id
     AND active_organization_id   IS NULL;

  RETURN json_build_object(
    'org_id',   v_inv.organization_id,
    'org_name', v_org_name,
    'role',     v_inv.role
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;


-- ─── get_invitation_by_token RPC ─────────────────────────────────────────────
--
-- Returns public-safe invitation details for the acceptance UI.
-- Does not require org membership (caller may be a new user).
-- Returns NULL for expired or already-accepted tokens.

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invitations;
BEGIN
  SELECT * INTO v_inv
    FROM public.invitations
   WHERE token       = p_token
     AND accepted_at IS NULL
     AND expires_at  > now()
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id',              v_inv.id,
    'email',           v_inv.email,
    'role',            v_inv.role,
    'specialization',  v_inv.specialization,
    'expires_at',      v_inv.expires_at,
    'org_name',        (SELECT name       FROM public.organizations WHERE id = v_inv.organization_id),
    'invited_by_name', (SELECT full_name  FROM public.profiles      WHERE id = v_inv.invited_by)
  );
END;
$$;

-- Callable by any authenticated user (they need to look up the invitation)
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO authenticated;

-- =============================================================================
-- Migration 001 — Organization Bootstrap RPC
--
-- WHEN TO RUN THIS FILE
-- ─────────────────────
--   Fresh database (no tables yet): run supabase/schema.sql INSTEAD.
--     schema.sql already includes everything in this migration.
--
--   Existing database (tables already created from a prior schema.sql run):
--     run THIS file to add active_organization_id and the create_organization RPC.
-- =============================================================================

-- Guard: abort with a clear message if the base schema hasn't been applied.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    raise exception
      'Base schema not found. Run supabase/schema.sql first, then re-run this migration.';
  end if;
end $$;

--
-- WHY THIS MIGRATION EXISTS
-- ─────────────────────────
-- The original onboarding flow made three sequential PostgREST requests from
-- the browser:
--   1. INSERT into organizations
--   2. INSERT into organization_memberships
--   3. UPDATE profiles (active_organization_id — column did not yet exist)
--
-- Two bugs compounded to break step 1:
--
--   a) Schema partially applied — The original get_my_org_ids() used
--      "returns setof uuid", which Postgres rejects in policy expressions.
--      Supabase SQL Editor aborts at that error, so every RLS policy defined
--      after it (including the organizations INSERT policy) was never created.
--      With RLS enabled and no INSERT policy, all inserts are blocked by the
--      deny-all default, producing: "new row violates row-level security
--      policy for table 'organizations'".
--
--   b) Cookie timing race — Even with correct policies, proxy.ts can refresh
--      session tokens server-side before the browser's cookie jar is updated.
--      This causes auth.uid() to resolve as NULL on a subsequent PostgREST
--      request, making the authenticated INSERT policy inapplicable.
--
-- FIX: One SECURITY DEFINER function wraps all three inserts in a single
-- PostgreSQL transaction. auth.uid() is always authoritative inside the
-- database, and the client makes exactly one request via supabase.rpc().
-- =============================================================================

-- ─── 1. Add active_organization_id to profiles ────────────────────────────────

alter table public.profiles
  add column if not exists active_organization_id uuid
    references public.organizations (id) on delete set null;

comment on column public.profiles.active_organization_id
  is 'The org the user is currently working in. Set on first org creation; switchable later.';

-- ─── 2. Atomic bootstrap RPC ──────────────────────────────────────────────────
--
-- Error codes returned to the client:
--   P0001 — slug already taken (unique_violation re-raised)
--   P0002 — caller is not authenticated (auth.uid() is null)
-- ──────────────────────────────────────────────────────────────────────────────

create or replace function public.create_organization(
  p_name     text,
  p_slug     text,
  p_logo_url text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org     public.organizations;
begin
  -- Reject unauthenticated callers before touching any data.
  -- auth.uid() is always reliable inside a database function — unlike the
  -- equivalent check via PostgREST which depends on JWT propagation.
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated'
      using errcode = 'P0002';
  end if;

  -- Insert the organization. Re-raise the unique_violation that fires on slug
  -- conflicts as a stable error code the service layer can discriminate.
  begin
    insert into public.organizations (name, slug, logo_url, owner_id)
    values (p_name, p_slug, p_logo_url, v_user_id)
    returning * into v_org;
  exception
    when unique_violation then
      raise exception 'Slug "%" is already taken', p_slug
        using errcode = 'P0001';
  end;

  -- Assign the creator as owner in the same transaction.
  -- No RLS check needed here — the function runs as the definer (postgres role).
  insert into public.organization_memberships (organization_id, user_id, role)
  values (v_org.id, v_user_id, 'owner');

  -- Point the user's profile at the new organization so the dashboard layout
  -- can read their active org without a separate memberships lookup.
  update public.profiles
  set active_organization_id = v_org.id
  where id = v_user_id;

  -- Return the full org row so the client can use it directly without a
  -- follow-up SELECT.
  return row_to_json(v_org);
end;
$$;

-- Grant only to authenticated users; revoke the default PUBLIC grant.
revoke all     on function public.create_organization(text, text, text) from public;
grant  execute on function public.create_organization(text, text, text) to authenticated;

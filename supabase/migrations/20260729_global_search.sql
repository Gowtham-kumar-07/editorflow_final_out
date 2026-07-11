-- ============================================================
-- Sprint 13A: Global Search
-- Migration: 20260729_global_search.sql
-- ============================================================

-- ─── 1. Enable pg_trgm for efficient substring search ─────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── 2. GIN trigram indexes on high-value search columns ──────────────────────
-- These turn ILIKE '%query%' into an index scan instead of a full-table scan.
-- Only added to columns that are actually searched in global_search().

CREATE INDEX IF NOT EXISTS idx_gin_clients_company_name
  ON public.clients USING gin (company_name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gin_projects_name
  ON public.projects USING gin (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gin_tasks_title
  ON public.tasks USING gin (title gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gin_profiles_full_name
  ON public.profiles USING gin (full_name gin_trgm_ops);

-- invoice_number is short and the unique B-tree index already supports
-- prefix/substring scans efficiently for typical agency datasets.
-- A trigram index is not added here to avoid over-indexing.

-- ─── 3. global_search() SECURITY DEFINER function ─────────────────────────────
--
-- Security model:
--   • auth.uid() derived internally — browser cannot spoof it
--   • active org derived from profiles.active_organization_id
--   • role derived from organization_memberships (deleted_at IS NULL guard)
--   • Members excluded from invoices/payments (financial data)
--   • Members restricted to their own assigned tasks (product permission)
--   • Deleted entities excluded
--   • Result cap: 5 per entity type, ~30 total
--   • No dynamic SQL — p_query is used only as a LIKE pattern
--   • search_path locked to public to prevent schema injection

DROP FUNCTION IF EXISTS public.global_search(TEXT);

CREATE OR REPLACE FUNCTION public.global_search(p_query TEXT)
RETURNS TABLE (
  id         UUID,
  type       TEXT,
  title      TEXT,
  subtitle   TEXT,
  status     TEXT,
  action_url TEXT,
  relevance  INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id  UUID;
  v_role    TEXT;
  v_q       TEXT;  -- ILIKE pattern  ('%…%')
  v_qt      TEXT;  -- trimmed query (for exact/prefix comparison)
BEGIN
  -- ── Auth ──
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ── Active org ──
  SELECT active_organization_id
    INTO v_org_id
    FROM public.profiles
   WHERE id = v_user_id;

  IF v_org_id IS NULL THEN RETURN; END IF;

  -- ── Role (must be an active member) ──
  SELECT role::TEXT
    INTO v_role
    FROM public.organization_memberships
   WHERE organization_id = v_org_id
     AND user_id         = v_user_id
     AND deleted_at      IS NULL;

  IF v_role IS NULL THEN RETURN; END IF;

  -- ── Normalize query ──
  v_qt := TRIM(p_query);
  v_q  := '%' || LOWER(v_qt) || '%';

  -- ── CLIENTS (all roles) ────────────────────────────────────────────────────
  RETURN QUERY
  SELECT
    c.id,
    'client'::TEXT,
    c.company_name::TEXT,
    COALESCE(c.contact_name, c.email)::TEXT,
    c.status::TEXT,
    ('/clients/' || c.id)::TEXT,
    (CASE
       WHEN LOWER(c.company_name) = LOWER(v_qt)                             THEN 100
       WHEN LOWER(c.company_name) LIKE (LOWER(v_qt) || '%')                 THEN 80
       WHEN LOWER(COALESCE(c.contact_name, '')) = LOWER(v_qt)               THEN 75
       ELSE 50
     END)::INT
  FROM public.clients c
  WHERE c.organization_id = v_org_id
    AND c.deleted_at      IS NULL
    AND (
          LOWER(c.company_name)                   LIKE v_q
       OR LOWER(COALESCE(c.contact_name, ''))     LIKE v_q
       OR LOWER(COALESCE(c.email, ''))            LIKE v_q
        )
  ORDER BY 7 DESC, c.updated_at DESC
  LIMIT 5;

  -- ── PROJECTS (all roles) ───────────────────────────────────────────────────
  RETURN QUERY
  SELECT
    p.id,
    'project'::TEXT,
    p.name::TEXT,
    (COALESCE(c.company_name, '') || ' · ' || p.status::TEXT)::TEXT,
    p.status::TEXT,
    ('/projects/' || p.id)::TEXT,
    (CASE
       WHEN LOWER(p.name) = LOWER(v_qt)            THEN 100
       WHEN LOWER(p.name) LIKE (LOWER(v_qt) || '%') THEN 80
       ELSE 50
     END)::INT
  FROM public.projects p
  LEFT JOIN public.clients c ON c.id = p.client_id
  WHERE p.organization_id = v_org_id
    AND p.deleted_at      IS NULL
    AND LOWER(p.name)     LIKE v_q
  ORDER BY 7 DESC, p.updated_at DESC
  LIMIT 5;

  -- ── TASKS (members: assigned-only; others: all) ────────────────────────────
  RETURN QUERY
  SELECT
    t.id,
    'task'::TEXT,
    t.title::TEXT,
    (COALESCE(pr.name, '') || ' · ' || t.status::TEXT)::TEXT,
    t.status::TEXT,
    ('/tasks/' || t.id)::TEXT,
    (CASE
       WHEN LOWER(t.title) = LOWER(v_qt)             THEN 100
       WHEN LOWER(t.title) LIKE (LOWER(v_qt) || '%') THEN 80
       ELSE 50
     END)::INT
  FROM public.tasks t
  LEFT JOIN public.projects pr ON pr.id = t.project_id
  WHERE t.organization_id = v_org_id
    AND t.deleted_at      IS NULL
    AND LOWER(t.title)    LIKE v_q
    AND (v_role != 'member' OR t.assigned_to = v_user_id)
  ORDER BY 7 DESC, t.updated_at DESC
  LIMIT 5;

  -- ── INVOICES (owner / admin / project_manager only) ───────────────────────
  IF v_role IN ('owner', 'admin', 'project_manager') THEN
    RETURN QUERY
    SELECT
      i.id,
      'invoice'::TEXT,
      i.invoice_number::TEXT,
      (COALESCE(c.company_name, '') || ' · ' || i.status::TEXT)::TEXT,
      i.status::TEXT,
      ('/invoices/' || i.id)::TEXT,
      (CASE
         WHEN LOWER(i.invoice_number) = LOWER(v_qt)             THEN 100
         WHEN LOWER(i.invoice_number) LIKE (LOWER(v_qt) || '%') THEN 80
         ELSE 50
       END)::INT
    FROM public.invoices i
    LEFT JOIN public.clients c ON c.id = i.client_id
    WHERE i.organization_id = v_org_id
      AND i.deleted_at      IS NULL
      AND (
            LOWER(i.invoice_number)              LIKE v_q
         OR LOWER(COALESCE(c.company_name, '')) LIKE v_q
          )
    ORDER BY 7 DESC, i.updated_at DESC
    LIMIT 5;
  END IF;

  -- ── PAYMENTS (owner / admin / project_manager only) ───────────────────────
  IF v_role IN ('owner', 'admin', 'project_manager') THEN
    RETURN QUERY
    SELECT
      p2.id,
      'payment'::TEXT,
      COALESCE(p2.transaction_reference, i.invoice_number, 'Payment')::TEXT,
      (p2.payment_method::TEXT || ' · ' || p2.status::TEXT)::TEXT,
      p2.status::TEXT,
      '/payments'::TEXT,
      (CASE
         WHEN LOWER(COALESCE(p2.transaction_reference, '')) = LOWER(v_qt)              THEN 100
         WHEN LOWER(COALESCE(p2.transaction_reference, '')) LIKE (LOWER(v_qt) || '%')  THEN 80
         ELSE 50
       END)::INT
    FROM public.payments p2
    LEFT JOIN public.invoices i ON i.id = p2.invoice_id
    WHERE p2.organization_id = v_org_id
      AND p2.deleted_at      IS NULL
      AND (
            LOWER(COALESCE(p2.transaction_reference, '')) LIKE v_q
         OR LOWER(COALESCE(i.invoice_number, ''))         LIKE v_q
          )
    ORDER BY 7 DESC, p2.updated_at DESC
    LIMIT 5;
  END IF;

  -- ── TEAM MEMBERS (all roles) ───────────────────────────────────────────────
  RETURN QUERY
  SELECT
    pf.id,
    'team_member'::TEXT,
    pf.full_name::TEXT,
    (om.role::TEXT || COALESCE(' · ' || om.specialization, ''))::TEXT,
    om.role::TEXT,
    ('/team/' || pf.id)::TEXT,
    (CASE
       WHEN LOWER(pf.full_name) = LOWER(v_qt)             THEN 100
       WHEN LOWER(pf.full_name) LIKE (LOWER(v_qt) || '%') THEN 80
       ELSE 50
     END)::INT
  FROM public.profiles pf
  JOIN public.organization_memberships om
    ON om.user_id         = pf.id
   AND om.organization_id = v_org_id
   AND om.deleted_at      IS NULL
  WHERE (
      LOWER(pf.full_name)                  LIKE v_q
   OR LOWER(COALESCE(pf.email, ''))       LIKE v_q
   OR LOWER(COALESCE(om.specialization, '')) LIKE v_q
  )
  ORDER BY 7 DESC, pf.full_name ASC
  LIMIT 5;

END;
$$;

REVOKE EXECUTE ON FUNCTION public.global_search(TEXT) FROM public;
GRANT  EXECUTE ON FUNCTION public.global_search(TEXT) TO authenticated;

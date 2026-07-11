-- Multi-Project Invoice Support
--
-- Extends Sprint 10A by replacing the single invoices.project_id link
-- with an invoice_projects junction table, adding project_id to invoice_items
-- for traceability, and re-implementing create_invoice / update_invoice RPCs
-- to accept an array of project IDs.
--
-- BACKWARD COMPATIBILITY:
--   invoices.project_id is kept (nullable) for historical rows.
--   New invoices written by the updated RPCs will have project_id = NULL;
--   all project relationships live in invoice_projects.
--   Existing single-project invoices are backfilled into invoice_projects.

-- ─── 1. Add project_id to invoice_items ──────────────────────────────────────

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_project_id
  ON public.invoice_items (project_id)
  WHERE project_id IS NOT NULL;

-- ─── 2. Create invoice_projects junction table ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_projects (
  invoice_id      UUID        NOT NULL REFERENCES public.invoices(id)       ON DELETE CASCADE,
  project_id      UUID        NOT NULL REFERENCES public.projects(id)       ON DELETE RESTRICT,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (invoice_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_projects_invoice_id ON public.invoice_projects (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_projects_project_id ON public.invoice_projects (project_id);
CREATE INDEX IF NOT EXISTS idx_invoice_projects_org_id     ON public.invoice_projects (organization_id);

-- ─── 3. RLS on invoice_projects ──────────────────────────────────────────────
-- Only owner / admin / project_manager can see invoice–project relationships.
-- Members are deliberately excluded (same rule as invoices).

ALTER TABLE public.invoice_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_projects: financial roles can read" ON public.invoice_projects
  FOR SELECT
  USING (
    organization_id = ANY(public.get_my_org_ids())
    AND public.get_my_role_in_org(organization_id) IN ('owner', 'admin', 'project_manager')
  );

-- ─── 4. Backfill existing single-project invoices ────────────────────────────

INSERT INTO public.invoice_projects (invoice_id, project_id, organization_id, created_at)
SELECT i.id, i.project_id, i.organization_id, COALESCE(i.created_at, now())
  FROM public.invoices i
 WHERE i.project_id IS NOT NULL
   AND i.deleted_at IS NULL
ON CONFLICT (invoice_id, project_id) DO NOTHING;

-- ─── 5. Drop old RPCs (signature change requires drop + recreate) ─────────────

DROP FUNCTION IF EXISTS public.create_invoice(UUID, UUID, UUID, DATE, DATE, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.update_invoice(UUID, UUID, UUID, DATE, DATE, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, JSONB);

-- ─── 6. create_invoice() — multi-project version ─────────────────────────────
-- p_project_ids is a JSONB array of UUID strings, e.g. '["uuid1","uuid2"]'.
-- Pass '[]' or NULL for invoices with no project.
-- p_line_items items may include an optional "project_id" string field.
-- All financial totals are recomputed server-side; browser values are ignored.

CREATE OR REPLACE FUNCTION public.create_invoice(
  p_org_id         UUID,
  p_client_id      UUID,
  p_project_ids    JSONB,
  p_issue_date     DATE,
  p_due_date       DATE,
  p_currency       TEXT,
  p_discount_type  TEXT,
  p_discount_value NUMERIC,
  p_tax_rate       NUMERIC,
  p_notes          TEXT,
  p_payment_terms  TEXT,
  p_line_items     JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID    := auth.uid();
  v_user_role    TEXT;
  v_invoice_id   UUID;
  v_invoice_num  TEXT;
  v_subtotal     NUMERIC := 0;
  v_discount_amt NUMERIC := 0;
  v_taxable      NUMERIC;
  v_tax_amt      NUMERIC;
  v_total        NUMERIC;
  v_item         JSONB;
  v_sort_order   INTEGER := 0;
  v_proj_id      UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_user_role := public.get_my_role_in_org(p_org_id);
  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin', 'project_manager') THEN
    RAISE EXCEPTION 'Insufficient permissions to create invoices';
  END IF;

  -- Validate client belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM public.clients
     WHERE id              = p_client_id
       AND organization_id = p_org_id
       AND deleted_at      IS NULL
  ) THEN
    RAISE EXCEPTION 'Client not found in this organization';
  END IF;

  -- Validate every selected project belongs to the client and org (no cross-client links)
  IF p_project_ids IS NOT NULL AND jsonb_array_length(p_project_ids) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_project_ids)
    LOOP
      v_proj_id := (v_item #>> '{}')::UUID;
      IF NOT EXISTS (
        SELECT 1 FROM public.projects
         WHERE id              = v_proj_id
           AND organization_id = p_org_id
           AND client_id       = p_client_id
           AND deleted_at      IS NULL
      ) THEN
        RAISE EXCEPTION 'Project % not found or does not belong to the selected client', v_proj_id;
      END IF;
    END LOOP;
  END IF;

  -- At least one line item required
  IF p_line_items IS NULL OR jsonb_array_length(p_line_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  -- Server-side subtotal + validate that line-item project_id references a selected project
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    IF v_item ->> 'project_id' IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(p_project_ids, '[]'::JSONB)) pid
         WHERE pid = v_item ->> 'project_id'
      ) THEN
        RAISE EXCEPTION 'Line item references project % which is not in the selected project list',
          v_item ->> 'project_id';
      END IF;
    END IF;
    v_subtotal := v_subtotal +
      ROUND((v_item ->> 'quantity')::NUMERIC * (v_item ->> 'unit_price')::NUMERIC, 2);
  END LOOP;

  -- Discount
  IF p_discount_type = 'percent' THEN
    v_discount_amt := ROUND(v_subtotal * LEAST(p_discount_value, 100) / 100, 2);
  ELSE
    v_discount_amt := ROUND(LEAST(GREATEST(p_discount_value, 0), v_subtotal), 2);
  END IF;

  v_taxable := v_subtotal - v_discount_amt;
  v_tax_amt := ROUND(v_taxable * LEAST(GREATEST(p_tax_rate, 0), 100) / 100, 2);
  v_total   := v_taxable + v_tax_amt;

  -- Concurrency-safe invoice number
  v_invoice_num := public.next_invoice_number(p_org_id);

  -- Insert invoice header (project_id intentionally left NULL; use invoice_projects)
  INSERT INTO public.invoices (
    organization_id, client_id,
    invoice_number,  status,
    issue_date,      due_date,
    currency,        subtotal,
    discount_type,   discount_value, discount,
    tax_rate,        tax,
    total,           notes,          payment_terms,  created_by
  ) VALUES (
    p_org_id,        p_client_id,
    v_invoice_num,   'draft',
    p_issue_date,    p_due_date,
    p_currency,      v_subtotal,
    p_discount_type, p_discount_value, v_discount_amt,
    p_tax_rate,      v_tax_amt,
    v_total,         p_notes,          p_payment_terms,  v_user_id
  ) RETURNING id INTO v_invoice_id;

  -- Insert invoice_projects links
  IF p_project_ids IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_project_ids)
    LOOP
      v_proj_id := (v_item #>> '{}')::UUID;
      INSERT INTO public.invoice_projects (invoice_id, project_id, organization_id)
      VALUES (v_invoice_id, v_proj_id, p_org_id)
      ON CONFLICT (invoice_id, project_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Insert line items (snapshot pricing: unit_price from form, not recalculated from projects)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id,    organization_id,
      description,   quantity,
      unit_price,    amount,
      sort_order,    project_id
    ) VALUES (
      v_invoice_id,  p_org_id,
      v_item ->> 'description',
      (v_item ->> 'quantity')::NUMERIC,
      (v_item ->> 'unit_price')::NUMERIC,
      ROUND((v_item ->> 'quantity')::NUMERIC * (v_item ->> 'unit_price')::NUMERIC, 2),
      v_sort_order,
      CASE WHEN v_item ->> 'project_id' IS NOT NULL
           THEN (v_item ->> 'project_id')::UUID
           ELSE NULL
      END
    );
    v_sort_order := v_sort_order + 1;
  END LOOP;

  -- Activity log
  INSERT INTO public.activity_logs (
    organization_id, user_id,  entity_type, entity_id,
    activity_type,   metadata
  ) VALUES (
    p_org_id,        v_user_id, 'invoice',   v_invoice_id,
    'created',
    jsonb_build_object('invoice_number', v_invoice_num, 'total', v_total)
  );

  RETURN jsonb_build_object('id', v_invoice_id, 'invoice_number', v_invoice_num);
END;
$$;

-- ─── 7. update_invoice() — multi-project version ─────────────────────────────

CREATE OR REPLACE FUNCTION public.update_invoice(
  p_invoice_id     UUID,
  p_client_id      UUID,
  p_project_ids    JSONB,
  p_issue_date     DATE,
  p_due_date       DATE,
  p_currency       TEXT,
  p_discount_type  TEXT,
  p_discount_value NUMERIC,
  p_tax_rate       NUMERIC,
  p_notes          TEXT,
  p_payment_terms  TEXT,
  p_line_items     JSONB
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
  v_subtotal       NUMERIC := 0;
  v_discount_amt   NUMERIC;
  v_taxable        NUMERIC;
  v_tax_amt        NUMERIC;
  v_total          NUMERIC;
  v_item           JSONB;
  v_sort_order     INTEGER := 0;
  v_proj_id        UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id, status
    INTO v_org_id, v_current_status
    FROM public.invoices
   WHERE id = p_invoice_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  v_user_role := public.get_my_role_in_org(v_org_id);
  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin', 'project_manager') THEN
    RAISE EXCEPTION 'Insufficient permissions to edit invoices';
  END IF;

  IF v_current_status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be edited (current status: %)', v_current_status;
  END IF;

  -- Validate every selected project belongs to the client and org
  IF p_project_ids IS NOT NULL AND jsonb_array_length(p_project_ids) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_project_ids)
    LOOP
      v_proj_id := (v_item #>> '{}')::UUID;
      IF NOT EXISTS (
        SELECT 1 FROM public.projects
         WHERE id              = v_proj_id
           AND organization_id = v_org_id
           AND client_id       = p_client_id
           AND deleted_at      IS NULL
      ) THEN
        RAISE EXCEPTION 'Project % not found or does not belong to the selected client', v_proj_id;
      END IF;
    END LOOP;
  END IF;

  IF p_line_items IS NULL OR jsonb_array_length(p_line_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  -- Server-side recomputation + validate line-item project references
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    IF v_item ->> 'project_id' IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(p_project_ids, '[]'::JSONB)) pid
         WHERE pid = v_item ->> 'project_id'
      ) THEN
        RAISE EXCEPTION 'Line item references project % which is not in the selected project list',
          v_item ->> 'project_id';
      END IF;
    END IF;
    v_subtotal := v_subtotal +
      ROUND((v_item ->> 'quantity')::NUMERIC * (v_item ->> 'unit_price')::NUMERIC, 2);
  END LOOP;

  IF p_discount_type = 'percent' THEN
    v_discount_amt := ROUND(v_subtotal * LEAST(p_discount_value, 100) / 100, 2);
  ELSE
    v_discount_amt := ROUND(LEAST(GREATEST(p_discount_value, 0), v_subtotal), 2);
  END IF;

  v_taxable := v_subtotal - v_discount_amt;
  v_tax_amt := ROUND(v_taxable * LEAST(GREATEST(p_tax_rate, 0), 100) / 100, 2);
  v_total   := v_taxable + v_tax_amt;

  -- Update header
  UPDATE public.invoices SET
    client_id      = p_client_id,
    issue_date     = p_issue_date,
    due_date       = p_due_date,
    currency       = p_currency,
    discount_type  = p_discount_type,
    discount_value = p_discount_value,
    discount       = v_discount_amt,
    tax_rate       = p_tax_rate,
    tax            = v_tax_amt,
    subtotal       = v_subtotal,
    total          = v_total,
    notes          = p_notes,
    payment_terms  = p_payment_terms,
    updated_at     = now()
  WHERE id = p_invoice_id;

  -- Replace invoice_projects links atomically
  DELETE FROM public.invoice_projects WHERE invoice_id = p_invoice_id;
  IF p_project_ids IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_project_ids)
    LOOP
      v_proj_id := (v_item #>> '{}')::UUID;
      INSERT INTO public.invoice_projects (invoice_id, project_id, organization_id)
      VALUES (p_invoice_id, v_proj_id, v_org_id)
      ON CONFLICT (invoice_id, project_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Replace all line items atomically
  DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id,   organization_id,
      description,  quantity,
      unit_price,   amount,
      sort_order,   project_id
    ) VALUES (
      p_invoice_id, v_org_id,
      v_item ->> 'description',
      (v_item ->> 'quantity')::NUMERIC,
      (v_item ->> 'unit_price')::NUMERIC,
      ROUND((v_item ->> 'quantity')::NUMERIC * (v_item ->> 'unit_price')::NUMERIC, 2),
      v_sort_order,
      CASE WHEN v_item ->> 'project_id' IS NOT NULL
           THEN (v_item ->> 'project_id')::UUID
           ELSE NULL
      END
    );
    v_sort_order := v_sort_order + 1;
  END LOOP;

  INSERT INTO public.activity_logs (
    organization_id, user_id,  entity_type, entity_id,
    activity_type,   metadata
  ) VALUES (
    v_org_id,        v_user_id, 'invoice',   p_invoice_id,
    'updated',
    jsonb_build_object('total', v_total)
  );

  RETURN jsonb_build_object('id', p_invoice_id, 'total', v_total);
END;
$$;

-- ─── 8. Grants ────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.create_invoice TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice TO authenticated;

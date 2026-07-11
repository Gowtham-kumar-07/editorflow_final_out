-- Sprint 6B: Enable RLS on workspace tables
-- These tables were created without RLS. All queries already filter by
-- organization_id / project_id at the application layer, but enabling RLS
-- enforces multi-tenant isolation at the database layer as well.

-- ─── tasks ────────────────────────────────────────────────────────────────────

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks: org members can read"
  ON tasks FOR SELECT
  USING (organization_id = ANY (get_my_org_ids()));

CREATE POLICY "tasks: org members can insert"
  ON tasks FOR INSERT
  WITH CHECK (organization_id = ANY (get_my_org_ids()));

CREATE POLICY "tasks: org members can update"
  ON tasks FOR UPDATE
  USING (organization_id = ANY (get_my_org_ids()));

CREATE POLICY "tasks: org members can delete"
  ON tasks FOR DELETE
  USING (organization_id = ANY (get_my_org_ids()));

-- ─── project_members ──────────────────────────────────────────────────────────
-- project_members has no organization_id — scope by project membership instead.
-- Only org members who can see the parent project can see its members list.

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_members: readable by org members of the project"
  ON project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.organization_id = ANY (get_my_org_ids())
    )
  );

CREATE POLICY "project_members: org members can insert"
  ON project_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.organization_id = ANY (get_my_org_ids())
    )
  );

CREATE POLICY "project_members: org members can update"
  ON project_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.organization_id = ANY (get_my_org_ids())
    )
  );

CREATE POLICY "project_members: org members can delete"
  ON project_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
        AND p.organization_id = ANY (get_my_org_ids())
    )
  );

-- ─── activity_logs ────────────────────────────────────────────────────────────

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs: org members can read"
  ON activity_logs FOR SELECT
  USING (organization_id = ANY (get_my_org_ids()));

CREATE POLICY "activity_logs: org members can insert"
  ON activity_logs FOR INSERT
  WITH CHECK (organization_id = ANY (get_my_org_ids()));

-- ─── assets ───────────────────────────────────────────────────────────────────

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets: org members can read"
  ON assets FOR SELECT
  USING (organization_id = ANY (get_my_org_ids()));

CREATE POLICY "assets: org members can insert"
  ON assets FOR INSERT
  WITH CHECK (organization_id = ANY (get_my_org_ids()));

CREATE POLICY "assets: org members can update"
  ON assets FOR UPDATE
  USING (organization_id = ANY (get_my_org_ids()));

CREATE POLICY "assets: org members can delete"
  ON assets FOR DELETE
  USING (organization_id = ANY (get_my_org_ids()));

-- ─── invoices ─────────────────────────────────────────────────────────────────

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices: org members can read"
  ON invoices FOR SELECT
  USING (organization_id = ANY (get_my_org_ids()));

CREATE POLICY "invoices: org members can insert"
  ON invoices FOR INSERT
  WITH CHECK (organization_id = ANY (get_my_org_ids()));

CREATE POLICY "invoices: org members can update"
  ON invoices FOR UPDATE
  USING (organization_id = ANY (get_my_org_ids()));

CREATE POLICY "invoices: org members can delete"
  ON invoices FOR DELETE
  USING (organization_id = ANY (get_my_org_ids()));

-- ─── notifications ────────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: users see their own"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications: org members can insert"
  ON notifications FOR INSERT
  WITH CHECK (organization_id = ANY (get_my_org_ids()));

CREATE POLICY "notifications: users update their own"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

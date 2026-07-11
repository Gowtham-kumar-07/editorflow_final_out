-- Sprint 7B: Enable RLS on task_comments
-- task_comments has no organization_id column, so policies join through tasks.

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Users can read comments on tasks that belong to their organization
CREATE POLICY "task_comments: read via task org"
  ON task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
        AND t.organization_id = ANY (get_my_org_ids())
        AND t.deleted_at IS NULL
    )
  );

-- Users can insert comments on tasks in their organization; user_id must match caller
CREATE POLICY "task_comments: insert via task org"
  ON task_comments FOR INSERT
  WITH CHECK (
    (user_id = auth.uid() OR user_id IS NULL)
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
        AND t.organization_id = ANY (get_my_org_ids())
        AND t.deleted_at IS NULL
    )
  );

-- Users can edit their own comments
CREATE POLICY "task_comments: users update own"
  ON task_comments FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "task_comments: users delete own"
  ON task_comments FOR DELETE
  USING (user_id = auth.uid());

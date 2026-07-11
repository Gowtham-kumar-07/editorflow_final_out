-- Sprint 14B Performance Indexes
-- Adds composite partial indexes for the query patterns confirmed as missing by the audit.

-- tasks: org-wide status filter (PM dashboard task counts, bottleneck report)
CREATE INDEX IF NOT EXISTS idx_tasks_org_status
  ON public.tasks (organization_id, status)
  WHERE deleted_at IS NULL;

-- tasks: member-assigned tasks by status (member dashboard, team workload)
CREATE INDEX IF NOT EXISTS idx_tasks_org_assigned_status
  ON public.tasks (organization_id, assigned_to, status)
  WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;

-- tasks: due-date range queries (upcoming deadlines, overdue detection)
CREATE INDEX IF NOT EXISTS idx_tasks_org_due_date
  ON public.tasks (organization_id, due_date)
  WHERE deleted_at IS NULL AND due_date IS NOT NULL;

-- payments: org + status + date range (revenue trend, payment summary)
-- Covers the 6-month lookback query added to the admin dashboard in this sprint.
CREATE INDEX IF NOT EXISTS idx_payments_org_status_date
  ON public.payments (organization_id, status, payment_date)
  WHERE deleted_at IS NULL;

-- invoices: org + status + due date (overdue detection, receivables aging)
CREATE INDEX IF NOT EXISTS idx_invoices_org_status_due
  ON public.invoices (organization_id, status, due_date)
  WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 8E · Workflow Field Guards (BEFORE UPDATE triggers)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Why triggers, not column-level REVOKE:
--   In PostgreSQL, REVOKE UPDATE(col) has no effect when a table-level UPDATE
--   grant already exists — column-level revocation cannot override a table-level
--   grant. The only way to restrict specific columns without reworking all table
--   grants is a BEFORE UPDATE trigger.
--
-- How these triggers distinguish legitimate writes from REST bypasses:
--   SECURITY DEFINER functions (transition_task_status, update_project_status,
--   archive_project) run as 'postgres'. SECURITY INVOKER triggers inherit the
--   current_user of their calling context, so:
--     • direct REST call:                current_user = 'authenticated'  → blocked
--     • call from SECURITY DEFINER RPC:  current_user = 'postgres'       → allowed
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── tasks: guard status and completed_at ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_task_workflow_fields()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY INVOKER (default) — must NOT be SECURITY DEFINER so that
-- current_user reflects the caller, not this function's owner.
AS $$
BEGIN
  IF current_user = 'postgres' THEN
    -- Originated from a SECURITY DEFINER RPC; allow the write.
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION
      'tasks.status is workflow-controlled; use transition_task_status()';
  END IF;

  IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    RAISE EXCEPTION
      'tasks.completed_at is workflow-controlled; use transition_task_status()';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_workflow ON public.tasks;
CREATE TRIGGER trg_guard_task_workflow
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_task_workflow_fields();


-- ─── projects: guard status ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_project_status_field()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY INVOKER (default) — same reasoning as above.
AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION
      'projects.status is workflow-controlled; use update_project_status() or archive_project()';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_project_status ON public.projects;
CREATE TRIGGER trg_guard_project_status
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_project_status_field();

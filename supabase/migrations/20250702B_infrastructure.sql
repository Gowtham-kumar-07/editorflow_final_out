-- =============================================================================
-- EditorFlow — Sprint 4B: Database Infrastructure
-- Helper functions · RLS policies · Audit function · Views · Search · Storage
--
-- Runs AFTER 20250702_business_schema.sql (all 14 business tables exist).
-- Safe to re-run: functions use CREATE OR REPLACE; policies use DROP IF EXISTS
-- before CREATE to ensure idempotency.
-- =============================================================================

-- =============================================================================
-- PART 1 — HELPER FUNCTIONS
-- All SECURITY DEFINER so they can read memberships without recursion.
-- All STABLE so the planner can cache the result within a query.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- is_org_member(org_id)
-- Returns true when the current user holds any active membership in the org.
-- Use as the baseline SELECT / INSERT guard on every org-scoped table.
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from   public.organization_memberships
    where  organization_id = org_id
      and  user_id         = auth.uid()
      and  deleted_at      is null
  );
$$;

comment on function public.is_org_member(uuid) is
  'True when auth.uid() holds any active membership in org_id. '
  'Use as the baseline RLS predicate for every org-scoped table.';

-- ---------------------------------------------------------------------------
-- is_org_admin(org_id)
-- Returns true when the current user is owner OR admin in the org.
-- Use for elevated write / delete operations.
-- ---------------------------------------------------------------------------
create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from   public.organization_memberships
    where  organization_id = org_id
      and  user_id         = auth.uid()
      and  role            in ('owner', 'admin')
      and  deleted_at      is null
  );
$$;

comment on function public.is_org_admin(uuid) is
  'True when auth.uid() is owner or admin in org_id. '
  'Use for elevated write/delete operations.';

-- ---------------------------------------------------------------------------
-- is_org_owner(org_id)
-- Returns true only for owners (not admins).
-- Use for destructive org-level operations (delete org, transfer ownership).
-- ---------------------------------------------------------------------------
create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from   public.organization_memberships
    where  organization_id = org_id
      and  user_id         = auth.uid()
      and  role            = 'owner'
      and  deleted_at      is null
  );
$$;

comment on function public.is_org_owner(uuid) is
  'True only when auth.uid() is owner (not admin) in org_id.';

-- ---------------------------------------------------------------------------
-- current_org_id()
-- Returns the user's currently active organization from their profile.
-- Useful for policies / helpers that need a default org context.
-- May return NULL for users who have not completed onboarding.
-- ---------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select active_organization_id
  from   public.profiles
  where  id = auth.uid();
$$;

comment on function public.current_org_id() is
  'Returns profiles.active_organization_id for auth.uid(). '
  'NULL when the user has no active organization set.';

-- ---------------------------------------------------------------------------
-- current_user_role(org_id)
-- Returns the authenticated user's role text in a given org, or NULL if they
-- are not a member.  Complements is_org_member/admin for UI permission checks.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role(org_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role::text
  from   public.organization_memberships
  where  organization_id = org_id
    and  user_id         = auth.uid()
    and  deleted_at      is null
  limit 1;
$$;

comment on function public.current_user_role(uuid) is
  'Returns the role text (owner|admin|member) of auth.uid() in org_id, '
  'or NULL if not a member.  Intended for application-level permission checks.';

-- Grant all helpers to the authenticated role so PostgREST can call them.
grant execute on function public.is_org_member(uuid)       to authenticated;
grant execute on function public.is_org_admin(uuid)        to authenticated;
grant execute on function public.is_org_owner(uuid)        to authenticated;
grant execute on function public.current_org_id()          to authenticated;
grant execute on function public.current_user_role(uuid)   to authenticated;

-- =============================================================================
-- PART 2 — RLS POLICIES
--
-- Convention:
--   SELECT  → any org member can read active rows
--   INSERT  → org member (standard) or org admin (sensitive: invoices/payments)
--   UPDATE  → org member (own rows) or org admin (any row)
--   DELETE  → org admin only (editors soft-delete via UPDATE deleted_at)
--
-- Tables without a direct organization_id column (invoice_items, payments,
-- task_comments, task_tags) use EXISTS subqueries through their parent table.
--
-- Existing policies for clients and projects are replaced here to use the
-- new helper functions for consistency.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- clients  (replaces schema.sql policies with helper-based equivalents)
-- ---------------------------------------------------------------------------

drop policy if exists "clients: members can read"             on public.clients;
drop policy if exists "clients: members can create"           on public.clients;
drop policy if exists "clients: members can update"           on public.clients;
drop policy if exists "clients: owners and admins can delete" on public.clients;
drop policy if exists "clients: admins can delete"            on public.clients;

create policy "clients: members can read"
  on public.clients for select to authenticated
  using  (public.is_org_member(organization_id));

create policy "clients: members can create"
  on public.clients for insert to authenticated
  with check (public.is_org_member(organization_id));

create policy "clients: members can update"
  on public.clients for update to authenticated
  using     (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "clients: admins can delete"
  on public.clients for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- projects  (replaces schema.sql policies with helper-based equivalents)
-- ---------------------------------------------------------------------------

drop policy if exists "projects: members can read"             on public.projects;
drop policy if exists "projects: members can create"           on public.projects;
drop policy if exists "projects: members can update"           on public.projects;
drop policy if exists "projects: owners and admins can delete" on public.projects;
drop policy if exists "projects: admins can delete"            on public.projects;

create policy "projects: members can read"
  on public.projects for select to authenticated
  using  (public.is_org_member(organization_id));

create policy "projects: members can create"
  on public.projects for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and created_by = auth.uid()
  );

create policy "projects: members can update"
  on public.projects for update to authenticated
  using     (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "projects: admins can delete"
  on public.projects for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- project_members
-- Any org member can see project membership.
-- Only org admins can manage membership (add, change role, remove).
-- ---------------------------------------------------------------------------

drop policy if exists "project_members: members can read"         on public.project_members;
drop policy if exists "project_members: admins can create"        on public.project_members;
drop policy if exists "project_members: admins can update"        on public.project_members;
drop policy if exists "project_members: admins can delete"        on public.project_members;

create policy "project_members: members can read"
  on public.project_members for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where  p.id = project_id
        and  public.is_org_member(p.organization_id)
    )
  );

create policy "project_members: admins can create"
  on public.project_members for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where  p.id = project_id
        and  public.is_org_admin(p.organization_id)
    )
  );

create policy "project_members: admins can update"
  on public.project_members for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where  p.id = project_id
        and  public.is_org_admin(p.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where  p.id = project_id
        and  public.is_org_admin(p.organization_id)
    )
  );

create policy "project_members: admins can delete"
  on public.project_members for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where  p.id = project_id
        and  public.is_org_admin(p.organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- tasks
-- All org members can read and write tasks.
-- Hard-delete requires admin; soft-delete (set deleted_at) is an UPDATE.
-- ---------------------------------------------------------------------------

drop policy if exists "tasks: members can read"   on public.tasks;
drop policy if exists "tasks: members can create" on public.tasks;
drop policy if exists "tasks: members can update" on public.tasks;
drop policy if exists "tasks: admins can delete"  on public.tasks;

create policy "tasks: members can read"
  on public.tasks for select to authenticated
  using  (public.is_org_member(organization_id));

create policy "tasks: members can create"
  on public.tasks for insert to authenticated
  with check (public.is_org_member(organization_id));

create policy "tasks: members can update"
  on public.tasks for update to authenticated
  using     (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "tasks: admins can delete"
  on public.tasks for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- task_comments
-- Any org member can read and create comments.
-- Authors can edit/delete their own; admins can edit/delete any.
-- Note: user_id is nullable (SET NULL on user delete) — compare carefully.
-- ---------------------------------------------------------------------------

drop policy if exists "task_comments: members can read"          on public.task_comments;
drop policy if exists "task_comments: members can create"        on public.task_comments;
drop policy if exists "task_comments: authors and admins update" on public.task_comments;
drop policy if exists "task_comments: authors and admins delete" on public.task_comments;

create policy "task_comments: members can read"
  on public.task_comments for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where  t.id = task_id
        and  public.is_org_member(t.organization_id)
    )
  );

create policy "task_comments: members can create"
  on public.task_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where  t.id = task_id
        and  public.is_org_member(t.organization_id)
    )
  );

create policy "task_comments: authors and admins update"
  on public.task_comments for update to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.tasks t
      where  t.id = task_id
        and  public.is_org_admin(t.organization_id)
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.tasks t
      where  t.id = task_id
        and  public.is_org_admin(t.organization_id)
    )
  );

create policy "task_comments: authors and admins delete"
  on public.task_comments for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.tasks t
      where  t.id = task_id
        and  public.is_org_admin(t.organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- folders
-- All org members can read and write folders.
-- Hard-delete requires admin.
-- ---------------------------------------------------------------------------

drop policy if exists "folders: members can read"   on public.folders;
drop policy if exists "folders: members can create" on public.folders;
drop policy if exists "folders: members can update" on public.folders;
drop policy if exists "folders: admins can delete"  on public.folders;

create policy "folders: members can read"
  on public.folders for select to authenticated
  using  (public.is_org_member(organization_id));

create policy "folders: members can create"
  on public.folders for insert to authenticated
  with check (public.is_org_member(organization_id));

create policy "folders: members can update"
  on public.folders for update to authenticated
  using     (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "folders: admins can delete"
  on public.folders for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- assets
-- Any org member can read and upload assets.
-- Only the uploader or an org admin may update an asset's metadata.
-- Hard-delete requires admin.
-- ---------------------------------------------------------------------------

drop policy if exists "assets: members can read"              on public.assets;
drop policy if exists "assets: members can upload"            on public.assets;
drop policy if exists "assets: uploader or admin can update"  on public.assets;
drop policy if exists "assets: admins can delete"             on public.assets;

create policy "assets: members can read"
  on public.assets for select to authenticated
  using  (public.is_org_member(organization_id));

create policy "assets: members can upload"
  on public.assets for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and uploaded_by = auth.uid()
  );

create policy "assets: uploader or admin can update"
  on public.assets for update to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_org_admin(organization_id)
  )
  with check (
    uploaded_by = auth.uid()
    or public.is_org_admin(organization_id)
  );

create policy "assets: admins can delete"
  on public.assets for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- invoices
-- Invoices are financial records — admin-only write access.
-- All members may read (visibility is org-wide; finance view is a future gate).
-- ---------------------------------------------------------------------------

drop policy if exists "invoices: members can read"   on public.invoices;
drop policy if exists "invoices: admins can create"  on public.invoices;
drop policy if exists "invoices: admins can update"  on public.invoices;
drop policy if exists "invoices: admins can delete"  on public.invoices;

create policy "invoices: members can read"
  on public.invoices for select to authenticated
  using  (public.is_org_member(organization_id));

create policy "invoices: admins can create"
  on public.invoices for insert to authenticated
  with check (public.is_org_admin(organization_id));

create policy "invoices: admins can update"
  on public.invoices for update to authenticated
  using     (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "invoices: admins can delete"
  on public.invoices for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- invoice_items
-- No direct organization_id — access is derived through the parent invoice.
-- ---------------------------------------------------------------------------

drop policy if exists "invoice_items: members can read"  on public.invoice_items;
drop policy if exists "invoice_items: admins can create" on public.invoice_items;
drop policy if exists "invoice_items: admins can update" on public.invoice_items;
drop policy if exists "invoice_items: admins can delete" on public.invoice_items;

create policy "invoice_items: members can read"
  on public.invoice_items for select to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where  i.id = invoice_id
        and  public.is_org_member(i.organization_id)
    )
  );

create policy "invoice_items: admins can create"
  on public.invoice_items for insert to authenticated
  with check (
    exists (
      select 1 from public.invoices i
      where  i.id = invoice_id
        and  public.is_org_admin(i.organization_id)
    )
  );

create policy "invoice_items: admins can update"
  on public.invoice_items for update to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where  i.id = invoice_id
        and  public.is_org_admin(i.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where  i.id = invoice_id
        and  public.is_org_admin(i.organization_id)
    )
  );

create policy "invoice_items: admins can delete"
  on public.invoice_items for delete to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where  i.id = invoice_id
        and  public.is_org_admin(i.organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- payments
-- Financial records — admin-only write; members can read.
-- No direct organization_id — derived through the parent invoice.
-- ---------------------------------------------------------------------------

drop policy if exists "payments: members can read"  on public.payments;
drop policy if exists "payments: admins can create" on public.payments;
drop policy if exists "payments: admins can update" on public.payments;
drop policy if exists "payments: admins can delete" on public.payments;

create policy "payments: members can read"
  on public.payments for select to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where  i.id = invoice_id
        and  public.is_org_member(i.organization_id)
    )
  );

create policy "payments: admins can create"
  on public.payments for insert to authenticated
  with check (
    exists (
      select 1 from public.invoices i
      where  i.id = invoice_id
        and  public.is_org_admin(i.organization_id)
    )
  );

create policy "payments: admins can update"
  on public.payments for update to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where  i.id = invoice_id
        and  public.is_org_admin(i.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where  i.id = invoice_id
        and  public.is_org_admin(i.organization_id)
    )
  );

create policy "payments: admins can delete"
  on public.payments for delete to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where  i.id = invoice_id
        and  public.is_org_admin(i.organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- tags
-- Members can read and create tags (tags are lightweight collaborative tools).
-- Only admins can rename or delete tags (affects all tasks using that tag).
-- ---------------------------------------------------------------------------

drop policy if exists "tags: members can read"   on public.tags;
drop policy if exists "tags: members can create" on public.tags;
drop policy if exists "tags: admins can update"  on public.tags;
drop policy if exists "tags: admins can delete"  on public.tags;

create policy "tags: members can read"
  on public.tags for select to authenticated
  using  (public.is_org_member(organization_id));

create policy "tags: members can create"
  on public.tags for insert to authenticated
  with check (public.is_org_member(organization_id));

create policy "tags: admins can update"
  on public.tags for update to authenticated
  using     (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "tags: admins can delete"
  on public.tags for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- task_tags
-- Any org member can read, apply, and remove tags from tasks.
-- No direct organization_id — derived through the parent task.
-- ---------------------------------------------------------------------------

drop policy if exists "task_tags: members can read"   on public.task_tags;
drop policy if exists "task_tags: members can create" on public.task_tags;
drop policy if exists "task_tags: members can delete" on public.task_tags;

create policy "task_tags: members can read"
  on public.task_tags for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where  t.id = task_id
        and  public.is_org_member(t.organization_id)
    )
  );

create policy "task_tags: members can create"
  on public.task_tags for insert to authenticated
  with check (
    exists (
      select 1 from public.tasks t
      where  t.id = task_id
        and  public.is_org_member(t.organization_id)
    )
  );

create policy "task_tags: members can delete"
  on public.task_tags for delete to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where  t.id = task_id
        and  public.is_org_member(t.organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- activity_logs
-- Members can read their org's activity feed.
-- No RLS INSERT/UPDATE/DELETE: writes go through the service role or the
-- log_activity() SECURITY DEFINER function (Part 3).  Audit logs are
-- immutable once written.
-- ---------------------------------------------------------------------------

drop policy if exists "activity_logs: members can read" on public.activity_logs;

create policy "activity_logs: members can read"
  on public.activity_logs for select to authenticated
  using  (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- notifications
-- Users can only see, update, and delete their own notifications.
-- Inserts are performed server-side via service role (no RLS INSERT policy).
-- ---------------------------------------------------------------------------

drop policy if exists "notifications: users can read own"    on public.notifications;
drop policy if exists "notifications: users can mark read"   on public.notifications;
drop policy if exists "notifications: users can delete own"  on public.notifications;

create policy "notifications: users can read own"
  on public.notifications for select to authenticated
  using  (user_id = auth.uid());

create policy "notifications: users can mark read"
  on public.notifications for update to authenticated
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications: users can delete own"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- PART 3 — AUDIT FUNCTION
-- log_activity() is a reusable SECURITY DEFINER function.
-- No triggers are attached in this sprint — call it explicitly from server
-- actions or attach triggers in a future sprint.
-- =============================================================================

create or replace function public.log_activity(
  p_organization_id  uuid,
  p_entity_type      text,
  p_entity_id        uuid,
  p_activity_type    public.activity_type,
  p_metadata         jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_logs (
    organization_id,
    user_id,
    entity_type,
    entity_id,
    activity_type,
    metadata
  ) values (
    p_organization_id,
    auth.uid(),          -- NULL when called from service role or background job
    p_entity_type,
    p_entity_id,
    p_activity_type,
    p_metadata
  );
end;
$$;

comment on function public.log_activity(uuid, text, uuid, public.activity_type, jsonb) is
  'Inserts one row into activity_logs. SECURITY DEFINER bypasses RLS so it '
  'works from any call site (server action, trigger, background job). '
  'No triggers are attached in Sprint 4B — call explicitly.';

revoke all     on function public.log_activity(uuid, text, uuid, public.activity_type, jsonb) from public;
grant  execute on function public.log_activity(uuid, text, uuid, public.activity_type, jsonb) to authenticated;
grant  execute on function public.log_activity(uuid, text, uuid, public.activity_type, jsonb) to service_role;

-- =============================================================================
-- PART 4 — DATABASE VIEWS
-- security_invoker = on ensures the caller's RLS context applies to the
-- underlying tables, so these views never leak cross-tenant data.
-- Grant SELECT to authenticated so PostgREST can expose them.
-- =============================================================================

-- active_clients — clients that have not been soft-deleted
create or replace view public.active_clients
  with (security_invoker = on)
as
  select * from public.clients where deleted_at is null;

comment on view public.active_clients is
  'Clients with deleted_at IS NULL. Respects RLS on the underlying table.';

-- active_projects — projects that have not been soft-deleted
create or replace view public.active_projects
  with (security_invoker = on)
as
  select * from public.projects where deleted_at is null;

comment on view public.active_projects is
  'Projects with deleted_at IS NULL. Respects RLS on the underlying table.';

-- active_tasks — tasks that have not been soft-deleted
create or replace view public.active_tasks
  with (security_invoker = on)
as
  select * from public.tasks where deleted_at is null;

comment on view public.active_tasks is
  'Tasks with deleted_at IS NULL. Respects RLS on the underlying table.';

-- active_assets — assets that have not been soft-deleted
create or replace view public.active_assets
  with (security_invoker = on)
as
  select * from public.assets where deleted_at is null;

comment on view public.active_assets is
  'Assets with deleted_at IS NULL. Respects RLS on the underlying table.';

-- Grant read access to authenticated users
grant select on public.active_clients  to authenticated;
grant select on public.active_projects to authenticated;
grant select on public.active_tasks    to authenticated;
grant select on public.active_assets   to authenticated;

-- =============================================================================
-- PART 5 — FULL-TEXT SEARCH INDEXES (GIN)
-- tsvector expressions concatenate the most-searched text columns.
-- NULL values are coalesced to '' so the vector is never null.
-- These indexes support future global search via to_tsquery() / websearch_to_tsquery().
-- =============================================================================

-- clients: company name, contact, email, notes
create index if not exists idx_clients_fts
  on public.clients
  using gin (
    to_tsvector('english',
      coalesce(company_name, '') || ' ' ||
      coalesce(contact_name,  '') || ' ' ||
      coalesce(email,         '') || ' ' ||
      coalesce(notes,         '')
    )
  );

-- projects: name, description
create index if not exists idx_projects_fts
  on public.projects
  using gin (
    to_tsvector('english',
      coalesce(name,        '') || ' ' ||
      coalesce(description, '')
    )
  );

-- tasks: title, description
create index if not exists idx_tasks_fts
  on public.tasks
  using gin (
    to_tsvector('english',
      coalesce(title,       '') || ' ' ||
      coalesce(description, '')
    )
  );

comment on index public.idx_clients_fts  is 'GIN full-text index on clients (company_name, contact_name, email, notes).';
comment on index public.idx_projects_fts is 'GIN full-text index on projects (name, description).';
comment on index public.idx_tasks_fts    is 'GIN full-text index on tasks (title, description).';

-- =============================================================================
-- PART 6 — STORAGE PATH HELPERS
-- Pure deterministic functions (IMMUTABLE) that produce canonical Storage
-- object paths.  Call these everywhere file paths are generated so the
-- naming convention is defined in exactly one place.
-- =============================================================================

-- organization_logo_path(slug, ext) → 'organization-logos/<slug>/logo.<ext>'
create or replace function public.organization_logo_path(
  p_org_slug  text,
  p_ext       text default 'png'
)
returns text
language sql
immutable
set search_path = public
as $$
  select 'organization-logos/' || p_org_slug || '/logo.' || lower(p_ext);
$$;

comment on function public.organization_logo_path(text, text) is
  'Canonical Supabase Storage path for an organisation logo. '
  'Bucket: organization-logos (public). '
  'Example: organization_logo_path(''acme'', ''png'') → ''organization-logos/acme/logo.png''';

-- project_asset_path(org_id, project_id, file_name) → 'project-assets/<org>/<project>/<file>'
create or replace function public.project_asset_path(
  p_org_id     uuid,
  p_project_id uuid,
  p_file_name  text
)
returns text
language sql
immutable
set search_path = public
as $$
  select 'project-assets/'
      || p_org_id::text     || '/'
      || p_project_id::text || '/'
      || p_file_name;
$$;

comment on function public.project_asset_path(uuid, uuid, text) is
  'Canonical Supabase Storage path for a project asset. '
  'Bucket: project-assets (private, signed URLs). '
  'Example: project_asset_path(org_id, proj_id, ''brief.pdf'')';

-- thumbnail_path(org_id, asset_id, ext) → 'project-thumbnails/<org>/<asset>.<ext>'
create or replace function public.thumbnail_path(
  p_org_id   uuid,
  p_asset_id uuid,
  p_ext      text default 'webp'
)
returns text
language sql
immutable
set search_path = public
as $$
  select 'project-thumbnails/'
      || p_org_id::text   || '/'
      || p_asset_id::text || '.'
      || lower(p_ext);
$$;

comment on function public.thumbnail_path(uuid, uuid, text) is
  'Canonical Supabase Storage path for an asset thumbnail. '
  'Bucket: project-thumbnails (public). '
  'Example: thumbnail_path(org_id, asset_id) → ''project-thumbnails/<org>/<asset>.webp''';

-- Grant to authenticated so server components can call these via RPC
grant execute on function public.organization_logo_path(text, text)   to authenticated;
grant execute on function public.project_asset_path(uuid, uuid, text) to authenticated;
grant execute on function public.thumbnail_path(uuid, uuid, text)     to authenticated;

-- =============================================================================
-- EditorFlow — Business Schema Migration
-- Applies on top of the existing organizations / clients / projects schema.
-- Safe to re-run: all object creations use IF NOT EXISTS / idempotent guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. New Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.task_status as enum (
    'todo', 'in_progress', 'review', 'completed', 'blocked'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum (
    'draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'pending', 'paid', 'failed', 'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.asset_type as enum (
    'video', 'image', 'audio', 'document', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.activity_type as enum (
    'created', 'updated', 'deleted', 'commented',
    'assigned', 'uploaded', 'completed', 'payment_received'
  );
exception when duplicate_object then null; end $$;

-- 'draft' is new; existing values ('planning', 'active', etc.) are unchanged.
-- project_priority ('low', 'medium', 'high', 'urgent') is reused for tasks.
alter type public.project_status add value if not exists 'draft' before 'planning';

-- ---------------------------------------------------------------------------
-- 2. Alter existing tables
--    Add soft-delete support and missing columns to tables from prior sprints.
-- ---------------------------------------------------------------------------

-- organizations
alter table public.organizations
  add column if not exists deleted_at timestamptz;

-- organization_memberships
alter table public.organization_memberships
  add column if not exists deleted_at timestamptz;

-- client_status enum (absent in databases initialised before the current schema.sql)
do $$ begin
  create type public.client_status as enum ('active', 'inactive', 'archived');
exception when duplicate_object then null; end $$;

-- clients: rename contact_person → contact_name (idempotent wrapper)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where  table_schema = 'public'
      and  table_name   = 'clients'
      and  column_name  = 'contact_person'
  ) then
    alter table public.clients rename column contact_person to contact_name;
  end if;
end $$;

alter table public.clients
  add column if not exists deleted_at   timestamptz,
  add column if not exists contact_name text,
  add column if not exists industry     text,
  add column if not exists gst_tax_id   text,
  add column if not exists status       public.client_status not null default 'active';

-- Back-fill status from is_active for databases created with the old boolean column
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where  table_schema = 'public'
      and  table_name   = 'clients'
      and  column_name  = 'is_active'
  ) then
    update public.clients
       set status = case when is_active
                         then 'active'::public.client_status
                         else 'inactive'::public.client_status
                    end;
  end if;
end $$;

-- Length constraints (drop-then-add so the migration is re-runnable)
alter table public.clients
  drop constraint if exists chk_clients_industry,
  add  constraint           chk_clients_industry
    check (industry is null or char_length(industry) <= 100);
alter table public.clients
  drop constraint if exists chk_clients_gst,
  add  constraint           chk_clients_gst
    check (gst_tax_id is null or char_length(gst_tax_id) <= 50);

-- projects: add soft-delete + completion tracking
alter table public.projects
  add column if not exists completed_at  timestamptz,
  add column if not exists thumbnail_url text,
  add column if not exists deleted_at    timestamptz;

-- Partial indexes optimise the common "active rows" query path.
create index if not exists idx_organizations_deleted_at         on public.organizations         (id)              where deleted_at is null;
create index if not exists idx_org_memberships_deleted_at       on public.organization_memberships (organization_id) where deleted_at is null;
create index if not exists idx_clients_deleted_at               on public.clients               (organization_id) where deleted_at is null;
create index if not exists idx_projects_deleted_at              on public.projects              (organization_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. project_members
-- ---------------------------------------------------------------------------

create table if not exists public.project_members (
  id          uuid  primary key default gen_random_uuid(),
  project_id  uuid  not null references public.projects (id) on delete cascade,
  user_id     uuid  not null references auth.users      (id) on delete cascade,
  role        text  not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint  uq_project_member       unique (project_id, user_id),
  constraint  chk_project_member_role check  (role in ('manager', 'editor', 'viewer'))
);

comment on table  public.project_members      is 'Per-project role assignments for organization members.';
comment on column public.project_members.role is 'manager | editor | viewer (distinct from org-level org_role).';

create index if not exists idx_project_members_project    on public.project_members (project_id);
create index if not exists idx_project_members_user       on public.project_members (user_id);
create index if not exists idx_project_members_deleted_at on public.project_members (project_id) where deleted_at is null;

drop trigger if exists trg_project_members_updated_at on public.project_members;
create trigger trg_project_members_updated_at
  before update on public.project_members
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 4. tasks
-- ---------------------------------------------------------------------------

create table if not exists public.tasks (
  id               uuid                    primary key default gen_random_uuid(),
  organization_id  uuid                    not null references public.organizations (id) on delete cascade,
  project_id       uuid                    not null references public.projects       (id) on delete cascade,
  parent_task_id   uuid                    references public.tasks                  (id) on delete cascade,
  title            text                    not null,
  description      text,
  status           public.task_status      not null default 'todo',
  -- Reuses project_priority enum: 'low' | 'medium' | 'high' | 'urgent'
  priority         public.project_priority not null default 'medium',
  assigned_to      uuid                    references auth.users (id) on delete set null,
  due_date         date,
  estimated_hours  numeric(8, 2),
  actual_hours     numeric(8, 2),
  position         integer                 not null default 0,
  created_at       timestamptz             not null default now(),
  updated_at       timestamptz             not null default now(),
  deleted_at       timestamptz,
  constraint chk_tasks_title_length       check (char_length(title) between 1 and 500),
  constraint chk_tasks_no_self_parent     check (parent_task_id is distinct from id),
  constraint chk_tasks_position_non_neg   check (position >= 0),
  constraint chk_tasks_estimated_positive check (estimated_hours is null or estimated_hours > 0),
  constraint chk_tasks_actual_non_neg     check (actual_hours    is null or actual_hours >= 0)
);

comment on table  public.tasks                    is 'Work items belonging to a project. Supports subtasks via parent_task_id.';
comment on column public.tasks.parent_task_id     is 'Self-reference for subtask nesting. NULL = top-level task.';
comment on column public.tasks.position           is 'Ordering weight within the same status column (0-based).';
comment on column public.tasks.priority           is 'Uses project_priority enum: low | medium | high | urgent.';

create index if not exists idx_tasks_org         on public.tasks (organization_id);
create index if not exists idx_tasks_project     on public.tasks (project_id);
create index if not exists idx_tasks_parent      on public.tasks (parent_task_id) where parent_task_id is not null;
create index if not exists idx_tasks_assigned_to on public.tasks (assigned_to)    where assigned_to   is not null;
create index if not exists idx_tasks_status      on public.tasks (project_id, status);
create index if not exists idx_tasks_deleted_at  on public.tasks (organization_id) where deleted_at is null;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 5. task_comments
-- ---------------------------------------------------------------------------

create table if not exists public.task_comments (
  id          uuid    primary key default gen_random_uuid(),
  task_id     uuid    not null references public.tasks (id) on delete cascade,
  user_id     uuid    references auth.users            (id) on delete set null,
  comment     text    not null,
  edited_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint  chk_task_comments_length check (char_length(comment) between 1 and 10000)
);

comment on column public.task_comments.user_id   is 'NULL when the author has been deleted; comment body is preserved.';
comment on column public.task_comments.edited_at is 'Set by application when the comment body is changed.';

create index if not exists idx_task_comments_task       on public.task_comments (task_id);
create index if not exists idx_task_comments_user       on public.task_comments (user_id) where user_id is not null;
create index if not exists idx_task_comments_deleted_at on public.task_comments (task_id) where deleted_at is null;

drop trigger if exists trg_task_comments_updated_at on public.task_comments;
create trigger trg_task_comments_updated_at
  before update on public.task_comments
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 6. folders
-- ---------------------------------------------------------------------------

create table if not exists public.folders (
  id                uuid  primary key default gen_random_uuid(),
  organization_id   uuid  not null references public.organizations (id) on delete cascade,
  project_id        uuid  references public.projects               (id) on delete cascade,
  parent_folder_id  uuid  references public.folders                (id) on delete cascade,
  name              text  not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint  chk_folders_name_length    check (char_length(name) between 1 and 255),
  constraint  chk_folders_no_self_parent check (parent_folder_id is distinct from id)
);

comment on column public.folders.project_id       is 'NULL = organisation-level folder not tied to a project.';
comment on column public.folders.parent_folder_id is 'Self-reference for nested folders. NULL = root-level folder.';

create index if not exists idx_folders_org        on public.folders (organization_id);
create index if not exists idx_folders_project    on public.folders (project_id)        where project_id       is not null;
create index if not exists idx_folders_parent     on public.folders (parent_folder_id)  where parent_folder_id is not null;
create index if not exists idx_folders_deleted_at on public.folders (organization_id)   where deleted_at       is null;

drop trigger if exists trg_folders_updated_at on public.folders;
create trigger trg_folders_updated_at
  before update on public.folders
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 7. assets
-- ---------------------------------------------------------------------------

create table if not exists public.assets (
  id               uuid               primary key default gen_random_uuid(),
  organization_id  uuid               not null references public.organizations (id) on delete cascade,
  project_id       uuid               references public.projects               (id) on delete set null,
  folder_id        uuid               references public.folders                (id) on delete set null,
  uploaded_by      uuid               references auth.users                   (id) on delete set null,
  file_name        text               not null,
  original_name    text               not null,
  file_size        bigint             not null,
  mime_type        text               not null,
  storage_path     text               not null,
  thumbnail_url    text,
  asset_type       public.asset_type  not null default 'other',
  version          smallint           not null default 1,
  created_at       timestamptz        not null default now(),
  updated_at       timestamptz        not null default now(),
  deleted_at       timestamptz,
  constraint  uq_assets_storage_path   unique (storage_path),
  constraint  chk_assets_file_size     check (file_size > 0),
  constraint  chk_assets_version       check (version >= 1),
  constraint  chk_assets_file_name     check (char_length(file_name)     between 1 and 500),
  constraint  chk_assets_original_name check (char_length(original_name) between 1 and 500),
  constraint  chk_assets_mime_type     check (char_length(mime_type)     between 3 and 255)
);

comment on column public.assets.file_name     is 'Sanitised name used in storage; may differ from original_name.';
comment on column public.assets.original_name is 'Client-supplied filename as uploaded.';
comment on column public.assets.storage_path  is 'Supabase Storage object path; globally unique.';
comment on column public.assets.version       is 'Monotonically increasing version number; starts at 1.';

create index if not exists idx_assets_org         on public.assets (organization_id);
create index if not exists idx_assets_project     on public.assets (project_id)  where project_id  is not null;
create index if not exists idx_assets_folder      on public.assets (folder_id)   where folder_id   is not null;
create index if not exists idx_assets_uploaded_by on public.assets (uploaded_by) where uploaded_by  is not null;
create index if not exists idx_assets_type        on public.assets (organization_id, asset_type);
create index if not exists idx_assets_deleted_at  on public.assets (organization_id) where deleted_at is null;

drop trigger if exists trg_assets_updated_at on public.assets;
create trigger trg_assets_updated_at
  before update on public.assets
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 8. invoices
-- ---------------------------------------------------------------------------

create table if not exists public.invoices (
  id               uuid                   primary key default gen_random_uuid(),
  organization_id  uuid                   not null references public.organizations (id) on delete cascade,
  client_id        uuid                   not null references public.clients        (id) on delete restrict,
  project_id       uuid                   references public.projects                (id) on delete set null,
  invoice_number   text                   not null,
  status           public.invoice_status  not null default 'draft',
  issue_date       date                   not null default current_date,
  due_date         date,
  subtotal         numeric(12, 2)         not null default 0,
  tax              numeric(12, 2)         not null default 0,
  discount         numeric(12, 2)         not null default 0,
  total            numeric(12, 2)         not null default 0,
  notes            text,
  created_at       timestamptz            not null default now(),
  updated_at       timestamptz            not null default now(),
  deleted_at       timestamptz,
  constraint  uq_invoices_number       unique (organization_id, invoice_number),
  constraint  chk_invoices_subtotal    check (subtotal  >= 0),
  constraint  chk_invoices_tax         check (tax       >= 0),
  constraint  chk_invoices_discount    check (discount  >= 0),
  constraint  chk_invoices_total       check (total     >= 0),
  constraint  chk_invoices_date_order  check (due_date is null or due_date >= issue_date)
);

comment on column public.invoices.client_id      is 'ON DELETE RESTRICT — a client with invoices cannot be hard-deleted.';
comment on column public.invoices.invoice_number is 'Unique per organisation (e.g. "INV-0042"). Application generates this.';
comment on column public.invoices.total          is 'Denormalised total = subtotal - discount + tax. Maintained by application.';

create index if not exists idx_invoices_org        on public.invoices (organization_id);
create index if not exists idx_invoices_client     on public.invoices (client_id);
create index if not exists idx_invoices_project    on public.invoices (project_id)  where project_id is not null;
create index if not exists idx_invoices_status     on public.invoices (organization_id, status);
create index if not exists idx_invoices_deleted_at on public.invoices (organization_id) where deleted_at is null;

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 9. invoice_items
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_items (
  id           uuid           primary key default gen_random_uuid(),
  invoice_id   uuid           not null references public.invoices (id) on delete cascade,
  description  text           not null,
  quantity     numeric(10, 2) not null default 1,
  unit_price   numeric(12, 2) not null default 0,
  amount       numeric(12, 2) not null default 0,
  created_at   timestamptz    not null default now(),
  updated_at   timestamptz    not null default now(),
  deleted_at   timestamptz,
  constraint  chk_invoice_items_quantity   check (quantity   > 0),
  constraint  chk_invoice_items_unit_price check (unit_price >= 0),
  constraint  chk_invoice_items_amount     check (amount     >= 0)
);

comment on column public.invoice_items.amount is 'Denormalised = quantity * unit_price. Maintained by application.';

create index if not exists idx_invoice_items_invoice    on public.invoice_items (invoice_id);
create index if not exists idx_invoice_items_deleted_at on public.invoice_items (invoice_id) where deleted_at is null;

drop trigger if exists trg_invoice_items_updated_at on public.invoice_items;
create trigger trg_invoice_items_updated_at
  before update on public.invoice_items
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 10. payments
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id                    uuid                  primary key default gen_random_uuid(),
  invoice_id            uuid                  not null references public.invoices (id) on delete restrict,
  amount                numeric(12, 2)        not null,
  payment_date          date                  not null default current_date,
  payment_method        text,
  transaction_reference text,
  status                public.payment_status not null default 'pending',
  notes                 text,
  created_at            timestamptz           not null default now(),
  updated_at            timestamptz           not null default now(),
  deleted_at            timestamptz,
  constraint  chk_payments_amount check (amount > 0)
);

comment on column public.payments.invoice_id is 'ON DELETE RESTRICT — invoices with payments cannot be hard-deleted.';

create index if not exists idx_payments_invoice    on public.payments (invoice_id);
create index if not exists idx_payments_status     on public.payments (status);
create index if not exists idx_payments_deleted_at on public.payments (invoice_id) where deleted_at is null;

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 11. tags
-- ---------------------------------------------------------------------------

create table if not exists public.tags (
  id               uuid  primary key default gen_random_uuid(),
  organization_id  uuid  not null references public.organizations (id) on delete cascade,
  name             text  not null,
  color            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint  uq_tags_org_name      unique (organization_id, name),
  constraint  chk_tags_name_length  check (char_length(name) between 1 and 50),
  constraint  chk_tags_color_format check (color is null or color ~ '^#[0-9a-fA-F]{6}$')
);

comment on column public.tags.color is 'CSS hex colour string: #rrggbb. NULL = use application default.';

create index if not exists idx_tags_org        on public.tags (organization_id);
create index if not exists idx_tags_deleted_at on public.tags (organization_id) where deleted_at is null;

drop trigger if exists trg_tags_updated_at on public.tags;
create trigger trg_tags_updated_at
  before update on public.tags
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 12. task_tags
-- ---------------------------------------------------------------------------

create table if not exists public.task_tags (
  id          uuid  primary key default gen_random_uuid(),
  task_id     uuid  not null references public.tasks (id) on delete cascade,
  tag_id      uuid  not null references public.tags  (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint  uq_task_tag unique (task_id, tag_id)
);

create index if not exists idx_task_tags_task       on public.task_tags (task_id);
create index if not exists idx_task_tags_tag        on public.task_tags (tag_id);
create index if not exists idx_task_tags_deleted_at on public.task_tags (task_id) where deleted_at is null;

drop trigger if exists trg_task_tags_updated_at on public.task_tags;
create trigger trg_task_tags_updated_at
  before update on public.task_tags
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 13. activity_logs
-- Append-only audit trail. No activity-logging triggers yet (deferred).
-- ---------------------------------------------------------------------------

create table if not exists public.activity_logs (
  id               uuid                 primary key default gen_random_uuid(),
  organization_id  uuid                 not null references public.organizations (id) on delete cascade,
  user_id          uuid                 references auth.users                   (id) on delete set null,
  entity_type      text                 not null,
  entity_id        uuid                 not null,
  activity_type    public.activity_type not null,
  metadata         jsonb,
  created_at       timestamptz          not null default now(),
  updated_at       timestamptz          not null default now(),
  deleted_at       timestamptz,
  constraint  chk_activity_logs_entity_type check (char_length(entity_type) between 1 and 100)
);

comment on table  public.activity_logs             is 'Append-only audit log. Rows are written once and never updated in normal operation.';
comment on column public.activity_logs.entity_type is 'Table name of the affected entity (e.g. "projects", "tasks").';
comment on column public.activity_logs.entity_id   is 'UUID of the affected row.';
comment on column public.activity_logs.metadata    is 'Arbitrary JSON context (old/new values, diff, related IDs).';

create index if not exists idx_activity_logs_org        on public.activity_logs (organization_id);
create index if not exists idx_activity_logs_user       on public.activity_logs (user_id) where user_id is not null;
create index if not exists idx_activity_logs_entity     on public.activity_logs (entity_type, entity_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs (organization_id, created_at desc);

drop trigger if exists trg_activity_logs_updated_at on public.activity_logs;
create trigger trg_activity_logs_updated_at
  before update on public.activity_logs
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 14. notifications
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id               uuid    primary key default gen_random_uuid(),
  organization_id  uuid    not null references public.organizations (id) on delete cascade,
  user_id          uuid    not null references auth.users            (id) on delete cascade,
  title            text    not null,
  body             text    not null,
  is_read          boolean not null default false,
  link             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint  chk_notifications_title check (char_length(title) between 1 and 255),
  constraint  chk_notifications_body  check (char_length(body)  between 1 and 2000)
);

create index if not exists idx_notifications_org        on public.notifications (organization_id);
create index if not exists idx_notifications_user       on public.notifications (user_id);
create index if not exists idx_notifications_unread     on public.notifications (user_id) where is_read = false;
create index if not exists idx_notifications_deleted_at on public.notifications (user_id) where deleted_at is null;

drop trigger if exists trg_notifications_updated_at on public.notifications;
create trigger trg_notifications_updated_at
  before update on public.notifications
  for each row execute procedure public.handle_updated_at();

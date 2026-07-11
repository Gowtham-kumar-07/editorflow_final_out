-- =============================================================================
-- EditorFlow — Complete Database Schema
-- PostgreSQL 15 / Supabase
-- Paste into Supabase SQL Editor and run top-to-bottom on a fresh project.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared utility: updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.org_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_status as enum ('active', 'inactive', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum (
    'draft', 'planning', 'active', 'on_hold', 'review',
    'completed', 'cancelled', 'archived'
  );
exception when duplicate_object then null; end $$;

-- Shared priority enum for both projects and tasks.
do $$ begin
  create type public.project_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

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

-- ---------------------------------------------------------------------------
-- Table: roles (reference / lookup)
-- ---------------------------------------------------------------------------

create table if not exists public.roles (
  id          smallint    primary key generated always as identity,
  name        text        not null unique,
  description text        not null,
  created_at  timestamptz not null default now()
);

insert into public.roles (name, description) values
  ('owner',   'Full control over the organization and all its resources'),
  ('admin',   'Can manage members and most organization settings'),
  ('manager', 'Can manage projects and clients; cannot change organization settings'),
  ('editor',  'Can create and edit content but cannot manage members'),
  ('viewer',  'Read-only access across the organization')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Table: profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id                      uuid        primary key references auth.users (id) on delete cascade,
  full_name               text,
  avatar_url              text,
  active_organization_id  uuid,        -- FK added after organizations
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger trg_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Table: organizations
-- ---------------------------------------------------------------------------

create table if not exists public.organizations (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,
  logo_url    text,
  owner_id    uuid        not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint  chk_organizations_name_length check (char_length(name) between 2 and 50),
  constraint  chk_organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- Complete the deferred FK from profiles → organizations
alter table public.profiles
  add column if not exists active_organization_id uuid
    references public.organizations (id) on delete set null;

create index if not exists idx_organizations_slug       on public.organizations (slug);
create index if not exists idx_organizations_owner      on public.organizations (owner_id);
create index if not exists idx_organizations_deleted_at on public.organizations (id) where deleted_at is null;

create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: organization_memberships
-- ---------------------------------------------------------------------------

create table if not exists public.organization_memberships (
  id               uuid             primary key default gen_random_uuid(),
  organization_id  uuid             not null references public.organizations (id) on delete cascade,
  user_id          uuid             not null references auth.users           (id) on delete cascade,
  role             public.org_role  not null default 'member',
  created_at       timestamptz      not null default now(),
  updated_at       timestamptz      not null default now(),
  deleted_at       timestamptz,
  constraint       uq_org_membership unique (organization_id, user_id)
);

create index if not exists idx_org_memberships_user       on public.organization_memberships (user_id);
create index if not exists idx_org_memberships_org        on public.organization_memberships (organization_id);
create index if not exists idx_org_memberships_deleted_at on public.organization_memberships (organization_id) where deleted_at is null;

create trigger trg_organization_memberships_updated_at
  before update on public.organization_memberships
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: clients
-- ---------------------------------------------------------------------------

create table if not exists public.clients (
  id               uuid                 primary key default gen_random_uuid(),
  organization_id  uuid                 not null references public.organizations (id) on delete cascade,
  company_name     text                 not null,
  contact_name     text,
  email            text,
  phone            text,
  website          text,
  industry         text,
  address          text,
  gst_tax_id       text,
  notes            text,
  status           public.client_status not null default 'active',
  created_at       timestamptz          not null default now(),
  updated_at       timestamptz          not null default now(),
  deleted_at       timestamptz,
  constraint  chk_clients_company_name  check (char_length(company_name) <= 200),
  constraint  chk_clients_contact       check (contact_name is null or char_length(contact_name) <= 100),
  constraint  chk_clients_phone         check (phone        is null or char_length(phone) <= 50),
  constraint  chk_clients_website       check (website      is null or char_length(website) <= 500),
  constraint  chk_clients_industry      check (industry     is null or char_length(industry) <= 100),
  constraint  chk_clients_address       check (address      is null or char_length(address) <= 500),
  constraint  chk_clients_gst           check (gst_tax_id   is null or char_length(gst_tax_id) <= 50),
  constraint  chk_clients_notes         check (notes        is null or char_length(notes) <= 2000)
);

create index if not exists idx_clients_org          on public.clients (organization_id);
create index if not exists idx_clients_org_status   on public.clients (organization_id, status);
create index if not exists idx_clients_company_name on public.clients (organization_id, company_name);
create index if not exists idx_clients_deleted_at   on public.clients (organization_id) where deleted_at is null;

create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: projects
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id               uuid                    primary key default gen_random_uuid(),
  organization_id  uuid                    not null references public.organizations (id) on delete cascade,
  client_id        uuid                    not null references public.clients        (id) on delete restrict,
  name             text                    not null,
  description      text,
  status           public.project_status   not null default 'planning',
  priority         public.project_priority not null default 'medium',
  start_date       date,
  due_date         date,
  completed_at     timestamptz,
  budget           numeric(12, 2),
  progress         smallint                not null default 0,
  thumbnail_url    text,
  created_by       uuid                    not null references auth.users (id) on delete restrict,
  created_at       timestamptz             not null default now(),
  updated_at       timestamptz             not null default now(),
  deleted_at       timestamptz,
  constraint  chk_projects_name_length    check (char_length(name) <= 200),
  constraint  chk_projects_description    check (description is null or char_length(description) <= 2000),
  constraint  chk_projects_budget         check (budget is null or (budget >= 0 and budget <= 999999999)),
  constraint  chk_projects_progress       check (progress between 0 and 100),
  constraint  chk_projects_date_order     check (start_date is null or due_date is null or due_date >= start_date)
);

create index if not exists idx_projects_org         on public.projects (organization_id);
create index if not exists idx_projects_client      on public.projects (client_id);
create index if not exists idx_projects_org_status  on public.projects (organization_id, status);
create index if not exists idx_projects_due_date    on public.projects (organization_id, due_date);
create index if not exists idx_projects_created_by  on public.projects (created_by);
create index if not exists idx_projects_deleted_at  on public.projects (organization_id) where deleted_at is null;

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: project_members
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

create index if not exists idx_project_members_project    on public.project_members (project_id);
create index if not exists idx_project_members_user       on public.project_members (user_id);
create index if not exists idx_project_members_deleted_at on public.project_members (project_id) where deleted_at is null;

create trigger trg_project_members_updated_at
  before update on public.project_members
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: tasks
-- ---------------------------------------------------------------------------

create table if not exists public.tasks (
  id               uuid                    primary key default gen_random_uuid(),
  organization_id  uuid                    not null references public.organizations (id) on delete cascade,
  project_id       uuid                    not null references public.projects       (id) on delete cascade,
  parent_task_id   uuid                    references public.tasks                  (id) on delete cascade,
  title            text                    not null,
  description      text,
  status           public.task_status      not null default 'todo',
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

create index if not exists idx_tasks_org         on public.tasks (organization_id);
create index if not exists idx_tasks_project     on public.tasks (project_id);
create index if not exists idx_tasks_parent      on public.tasks (parent_task_id) where parent_task_id is not null;
create index if not exists idx_tasks_assigned_to on public.tasks (assigned_to)    where assigned_to   is not null;
create index if not exists idx_tasks_status      on public.tasks (project_id, status);
create index if not exists idx_tasks_deleted_at  on public.tasks (organization_id) where deleted_at is null;

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: task_comments
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

create index if not exists idx_task_comments_task       on public.task_comments (task_id);
create index if not exists idx_task_comments_user       on public.task_comments (user_id) where user_id is not null;
create index if not exists idx_task_comments_deleted_at on public.task_comments (task_id) where deleted_at is null;

create trigger trg_task_comments_updated_at
  before update on public.task_comments
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: folders
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

create index if not exists idx_folders_org        on public.folders (organization_id);
create index if not exists idx_folders_project    on public.folders (project_id)       where project_id       is not null;
create index if not exists idx_folders_parent     on public.folders (parent_folder_id) where parent_folder_id is not null;
create index if not exists idx_folders_deleted_at on public.folders (organization_id)  where deleted_at       is null;

create trigger trg_folders_updated_at
  before update on public.folders
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: assets
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

create index if not exists idx_assets_org         on public.assets (organization_id);
create index if not exists idx_assets_project     on public.assets (project_id)  where project_id  is not null;
create index if not exists idx_assets_folder      on public.assets (folder_id)   where folder_id   is not null;
create index if not exists idx_assets_uploaded_by on public.assets (uploaded_by) where uploaded_by  is not null;
create index if not exists idx_assets_type        on public.assets (organization_id, asset_type);
create index if not exists idx_assets_deleted_at  on public.assets (organization_id) where deleted_at is null;

create trigger trg_assets_updated_at
  before update on public.assets
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: invoices
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
  constraint  uq_invoices_number      unique (organization_id, invoice_number),
  constraint  chk_invoices_subtotal   check (subtotal  >= 0),
  constraint  chk_invoices_tax        check (tax       >= 0),
  constraint  chk_invoices_discount   check (discount  >= 0),
  constraint  chk_invoices_total      check (total     >= 0),
  constraint  chk_invoices_date_order check (due_date is null or due_date >= issue_date)
);

create index if not exists idx_invoices_org        on public.invoices (organization_id);
create index if not exists idx_invoices_client     on public.invoices (client_id);
create index if not exists idx_invoices_project    on public.invoices (project_id)  where project_id is not null;
create index if not exists idx_invoices_status     on public.invoices (organization_id, status);
create index if not exists idx_invoices_deleted_at on public.invoices (organization_id) where deleted_at is null;

create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: invoice_items
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

create index if not exists idx_invoice_items_invoice    on public.invoice_items (invoice_id);
create index if not exists idx_invoice_items_deleted_at on public.invoice_items (invoice_id) where deleted_at is null;

create trigger trg_invoice_items_updated_at
  before update on public.invoice_items
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: payments
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

create index if not exists idx_payments_invoice    on public.payments (invoice_id);
create index if not exists idx_payments_status     on public.payments (status);
create index if not exists idx_payments_deleted_at on public.payments (invoice_id) where deleted_at is null;

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: tags
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

create index if not exists idx_tags_org        on public.tags (organization_id);
create index if not exists idx_tags_deleted_at on public.tags (organization_id) where deleted_at is null;

create trigger trg_tags_updated_at
  before update on public.tags
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: task_tags
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

create trigger trg_task_tags_updated_at
  before update on public.task_tags
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: activity_logs
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

create index if not exists idx_activity_logs_org        on public.activity_logs (organization_id);
create index if not exists idx_activity_logs_user       on public.activity_logs (user_id) where user_id is not null;
create index if not exists idx_activity_logs_entity     on public.activity_logs (entity_type, entity_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs (organization_id, created_at desc);

create trigger trg_activity_logs_updated_at
  before update on public.activity_logs
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Table: notifications
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

create trigger trg_notifications_updated_at
  before update on public.notifications
  for each row execute procedure public.handle_updated_at();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.roles                    enable row level security;
alter table public.profiles                 enable row level security;
alter table public.organizations            enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.clients                  enable row level security;
alter table public.projects                 enable row level security;

-- Business tables — RLS policies to be added per sprint.
-- Schemas are created now; policies follow in a separate migration.
alter table public.project_members  enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_comments    enable row level security;
alter table public.folders          enable row level security;
alter table public.assets           enable row level security;
alter table public.invoices         enable row level security;
alter table public.invoice_items    enable row level security;
alter table public.payments         enable row level security;
alter table public.tags             enable row level security;
alter table public.task_tags        enable row level security;
alter table public.activity_logs    enable row level security;
alter table public.notifications    enable row level security;

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------

create or replace function public.get_my_org_ids()
returns uuid[]
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(array_agg(organization_id), '{}'::uuid[])
  from   public.organization_memberships
  where  user_id     = auth.uid()
    and  deleted_at  is null;
$$;

create or replace function public.get_my_role_in_org(org_id uuid)
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

-- ---------------------------------------------------------------------------
-- Bootstrap RPC: create_organization
-- ---------------------------------------------------------------------------

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
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = 'P0002';
  end if;

  begin
    insert into public.organizations (name, slug, logo_url, owner_id)
    values (p_name, p_slug, p_logo_url, v_user_id)
    returning * into v_org;
  exception
    when unique_violation then
      raise exception 'Slug "%" is already taken', p_slug using errcode = 'P0001';
  end;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (v_org.id, v_user_id, 'owner');

  update public.profiles
  set active_organization_id = v_org.id
  where id = v_user_id;

  return row_to_json(v_org);
end;
$$;

revoke all     on function public.create_organization(text, text, text) from public;
grant  execute on function public.create_organization(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies: roles
-- ---------------------------------------------------------------------------

create policy "roles: authenticated users can read"
  on public.roles for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Policies: profiles
-- ---------------------------------------------------------------------------

create policy "profiles: users can read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles: users can update own"
  on public.profiles for update to authenticated
  using    (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Policies: organizations
-- ---------------------------------------------------------------------------

create policy "organizations: members can read"
  on public.organizations for select to authenticated
  using (id = any(public.get_my_org_ids()));

create policy "organizations: authenticated users can create"
  on public.organizations for insert to authenticated
  with check (owner_id = auth.uid());

create policy "organizations: owners can update"
  on public.organizations for update to authenticated
  using     (public.get_my_role_in_org(id) = 'owner')
  with check (public.get_my_role_in_org(id) = 'owner');

create policy "organizations: owners can delete"
  on public.organizations for delete to authenticated
  using (owner_id = auth.uid() or public.get_my_role_in_org(id) = 'owner');

-- ---------------------------------------------------------------------------
-- Policies: organization_memberships
-- ---------------------------------------------------------------------------

create policy "memberships: members can read org memberships"
  on public.organization_memberships for select to authenticated
  using (user_id = auth.uid() or organization_id = any(public.get_my_org_ids()));

create policy "memberships: users can insert own; owners/admins can invite"
  on public.organization_memberships for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.get_my_role_in_org(organization_id) in ('owner', 'admin')
  );

create policy "memberships: owners can update roles"
  on public.organization_memberships for update to authenticated
  using     (public.get_my_role_in_org(organization_id) = 'owner')
  with check (public.get_my_role_in_org(organization_id) = 'owner');

create policy "memberships: members can leave; owners can remove"
  on public.organization_memberships for delete to authenticated
  using (user_id = auth.uid() or public.get_my_role_in_org(organization_id) = 'owner');

-- ---------------------------------------------------------------------------
-- Policies: clients
-- ---------------------------------------------------------------------------

create policy "clients: members can read"
  on public.clients for select to authenticated
  using (organization_id = any(public.get_my_org_ids()));

create policy "clients: members can create"
  on public.clients for insert to authenticated
  with check (organization_id = any(public.get_my_org_ids()));

create policy "clients: members can update"
  on public.clients for update to authenticated
  using     (organization_id = any(public.get_my_org_ids()))
  with check (organization_id = any(public.get_my_org_ids()));

create policy "clients: owners and admins can delete"
  on public.clients for delete to authenticated
  using (public.get_my_role_in_org(organization_id) in ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- Policies: projects
-- ---------------------------------------------------------------------------

create policy "projects: members can read"
  on public.projects for select to authenticated
  using (organization_id = any(public.get_my_org_ids()));

create policy "projects: members can create"
  on public.projects for insert to authenticated
  with check (
    organization_id = any(public.get_my_org_ids())
    and created_by  = auth.uid()
  );

create policy "projects: members can update"
  on public.projects for update to authenticated
  using     (organization_id = any(public.get_my_org_ids()))
  with check (organization_id = any(public.get_my_org_ids()));

create policy "projects: owners and admins can delete"
  on public.projects for delete to authenticated
  using (public.get_my_role_in_org(organization_id) in ('owner', 'admin'));

-- ===========================================================================
-- Storage bucket (manual step — SQL Editor cannot create buckets)
-- ===========================================================================
-- After running this script, create the following buckets in:
--   Supabase Dashboard → Storage → New bucket
--
--   Name   : organization-logos   | Public: true
--   Name   : project-assets       | Public: false  (signed URLs for access)
--   Name   : project-thumbnails   | Public: true
-- ===========================================================================

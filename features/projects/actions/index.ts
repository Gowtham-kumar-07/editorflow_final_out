'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { ProjectWithClient } from '@/types/project'
import type { ProjectFilters, GetProjectsResult } from '../types'
import type { ProjectFormValues } from '../schema'
import type { OrgRole, ProjectStatus } from '@/types/supabase'
import { logger } from '@/lib/logger'
import {
  fetchProjects,
  fetchProjectById,
  createProjectService,
  updateProjectService,
  archiveProjectService,
  restoreProjectService,
  updateProjectStatusService,
} from '../services/project-service'
import {
  canCreateProject,
  canEditProject,
  canArchiveProject,
} from '@/lib/permissions'

type TypedClient = SupabaseClient<Database>

// ─── Auth helper ──────────────────────────────────────────────────────────────
//
// Accepts an optional pre-built client so mutation actions can share ONE
// Supabase client for both org-resolution and the INSERT/UPDATE, preventing
// the JWT race where proxy.ts refreshes the token between two client creations.
//
async function resolveContext(
  client?: TypedClient
): Promise<{ orgId: string; userId: string; supabase: TypedClient }> {
  const supabase = client ?? (await createClient())

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profileError && profile?.active_organization_id) {
    return { orgId: profile.active_organization_id, userId: user.id, supabase }
  }

  const { data: membership, error: memberError } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (memberError) throw new Error(`Failed to load membership: ${memberError.message}`)
  if (!membership?.organization_id) redirect('/onboarding')

  return { orgId: membership.organization_id, userId: user.id, supabase }
}

// ─── Result type ──────────────────────────────────────────────────────────────

export type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

// ─── Read actions ─────────────────────────────────────────────────────────────

export async function getProjects(
  filters: ProjectFilters = {}
): Promise<GetProjectsResult> {
  const { orgId, supabase } = await resolveContext()
  return fetchProjects(supabase, orgId, filters)
}

export async function getProject(
  id: string
): Promise<ProjectWithClient | null> {
  const { orgId, supabase } = await resolveContext()
  return fetchProjectById(supabase, id, orgId)
}

// ─── Mutation actions ─────────────────────────────────────────────────────────
// Single-client pattern: create ONE client, share it across org-resolution and
// the mutation so auth.uid() is always consistent inside Postgres.

export async function createProjectAction(
  values: ProjectFormValues
): Promise<ActionResult<{ id: string; name: string }>> {
  const supabase = await createClient()
  const { orgId, userId } = await resolveContext(supabase)
  const { data: roleData } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
  const role = (roleData as OrgRole) ?? 'member'
  if (!canCreateProject(role)) {
    return { ok: false, error: 'Only project managers and admins can create projects.' }
  }
  try {
    const project = await createProjectService(supabase, orgId, userId, values)
    return { ok: true, data: { id: project.id, name: project.name } }
  } catch (err) {
    const pg = err as Record<string, unknown>
    console.error('[projects] createProject error', { code: pg?.code, message: pg?.message, details: pg?.details, hint: pg?.hint })
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function updateProjectAction(
  id: string,
  values: ProjectFormValues
): Promise<ActionResult<{ id: string; name: string }>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  const { data: roleData } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
  const role = (roleData as OrgRole) ?? 'member'
  if (!canEditProject(role)) {
    return { ok: false, error: 'Only project managers and admins can edit projects.' }
  }
  try {
    const project = await updateProjectService(supabase, id, orgId, values)
    return { ok: true, data: { id: project.id, name: project.name } }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function archiveProjectAction(
  id: string
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  const { data: roleData } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
  const role = (roleData as OrgRole) ?? 'member'
  if (!canArchiveProject(role)) {
    return { ok: false, error: 'Only project managers and admins can archive projects.' }
  }
  try {
    await archiveProjectService(supabase, id, orgId)
    return { ok: true, data: undefined }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

export async function updateProjectStatusAction(
  projectId: string,
  newStatus: ProjectStatus
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  try {
    await updateProjectStatusService(supabase, projectId, orgId, newStatus)
    return { ok: true, data: undefined }
  } catch (err) {
    logger.error('updateProjectStatus failed', { detail: err instanceof Error ? err.message.slice(0, 40) : 'unknown' })
    return { ok: false, error: 'Could not update project status. Please try again.' }
  }
}

export async function getUserRole(): Promise<OrgRole | null> {
  try {
    const { orgId, supabase } = await resolveContext()
    const { data } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
    return (data as OrgRole) ?? null
  } catch {
    return null
  }
}

export async function restoreProjectAction(
  id: string
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { orgId } = await resolveContext(supabase)
  const { data: roleData } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
  const role = (roleData as OrgRole) ?? 'member'
  if (!canArchiveProject(role)) {
    return { ok: false, error: 'Only project managers and admins can restore projects.' }
  }
  try {
    await restoreProjectService(supabase, id, orgId)
    return { ok: true, data: undefined }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code === 'P0001') return { ok: false, error: String(pg.message ?? 'Operation failed.') }
    if (pg?.code) return { ok: false, error: 'An error occurred. Please try again.' }
    return { ok: false, error: 'An unexpected error occurred.' }
  }
}

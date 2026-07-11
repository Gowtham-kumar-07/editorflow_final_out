import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { ProjectWithClient } from '@/types/project'
import type { ProjectFilters, GetProjectsResult } from '../types'
import { formValuesToProjectData, type ProjectFormValues } from '../schema'
import {
  dbFindProjects,
  dbFindProjectById,
  dbCreateProject,
  dbUpdateProject,
  dbArchiveProject,
  dbRestoreProject,
  dbUpdateProjectStatus,
} from '../repository/project.repository'
import type { ProjectStatus } from '@/types/supabase'

type TypedClient = SupabaseClient<Database>
type ProjectRow  = Database['public']['Tables']['projects']['Row']

export const PROJECT_PAGE_SIZE = 20

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function fetchProjects(
  supabase: TypedClient,
  organizationId: string,
  filters: ProjectFilters = {}
): Promise<GetProjectsResult> {
  const page     = filters.page     ?? 1
  const pageSize = filters.pageSize ?? PROJECT_PAGE_SIZE

  const { rows, count } = await dbFindProjects(supabase, organizationId, { ...filters, pageSize })

  return {
    projects:   rows as unknown as ProjectWithClient[],
    total:      count,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(count / pageSize)),
  }
}

export async function fetchProjectById(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<ProjectWithClient | null> {
  const row = await dbFindProjectById(supabase, id, organizationId)
  return row as unknown as ProjectWithClient | null
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createProjectService(
  supabase: TypedClient,
  organizationId: string,
  userId: string,
  values: ProjectFormValues
): Promise<ProjectRow> {
  const data = formValuesToProjectData(values)
  return dbCreateProject(supabase, {
    ...data,
    organization_id: organizationId,
    created_by: userId,
  })
}

export async function updateProjectService(
  supabase: TypedClient,
  id: string,
  organizationId: string,
  values: ProjectFormValues
): Promise<ProjectRow> {
  const data = formValuesToProjectData(values)
  return dbUpdateProject(supabase, id, organizationId, data)
}

export async function archiveProjectService(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<void> {
  return dbArchiveProject(supabase, id, organizationId)
}

export async function updateProjectStatusService(
  supabase: TypedClient,
  projectId: string,
  organizationId: string,
  newStatus: ProjectStatus
): Promise<void> {
  // RPC validates role + transition at DB layer
  await dbUpdateProjectStatus(supabase, projectId, newStatus)
}

export async function restoreProjectService(
  supabase: TypedClient,
  id: string,
  organizationId: string
): Promise<void> {
  return dbRestoreProject(supabase, id, organizationId)
}

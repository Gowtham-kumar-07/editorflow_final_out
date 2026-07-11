import type { Database, ProjectStatus, ProjectPriority } from './supabase'

export type { ProjectStatus, ProjectPriority }

export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']

/** Project with the associated client name (returned by JOIN queries). */
export type ProjectWithClient = Project & {
  client: { id: string; company_name: string } | null
}

/** Params for creating a new project. */
export type CreateProjectData = Omit<ProjectInsert, 'id' | 'created_at' | 'updated_at'>

/** Params for updating an existing project (org and creator cannot change). */
export type UpdateProjectData = Omit<
  Partial<CreateProjectData>,
  'organization_id' | 'created_by'
>

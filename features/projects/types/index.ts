import type { ProjectStatus, ProjectPriority } from '@/types/supabase'

export type { ProjectStatus, ProjectPriority }
export type { Project, ProjectWithClient, ProjectInsert, ProjectUpdate } from '@/types/project'

export interface ProjectFilters {
  search?: string
  status?: ProjectStatus | ''
  priority?: ProjectPriority | ''
  clientId?: string
  sortBy?: 'name' | 'created_at' | 'updated_at' | 'due_date' | 'budget'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface GetProjectsResult {
  projects: import('@/types/project').ProjectWithClient[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

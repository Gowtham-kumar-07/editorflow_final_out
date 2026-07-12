import type { TaskStatus, TaskPriority, ActivityType } from '@/types/supabase'

export type { TaskStatus, TaskPriority, ActivityType }

export type TaskSortField = 'title' | 'created_at' | 'updated_at' | 'due_date' | 'priority' | 'status'
export type TaskSortOrder = 'asc' | 'desc'

export interface TaskFilters {
  search?:    string
  status?:    TaskStatus | ''
  priority?:  TaskPriority | ''
  projectId?: string
  assigneeId?: string
  sortBy?:    TaskSortField
  sortOrder?: TaskSortOrder
  page?:      number
  pageSize?:  number
  showDeleted?: boolean
}

export interface TaskWithDetails {
  id:               string
  organization_id:  string
  project_id:       string
  parent_task_id:   string | null
  title:            string
  description:      string | null
  status:           TaskStatus
  priority:         TaskPriority
  assigned_to:      string | null
  due_date:         string | null
  estimated_hours:  number | null
  actual_hours:     number | null
  position:         number
  created_at:       string
  updated_at:       string
  deleted_at:       string | null
  completed_at:     string | null
  amount:           number
  task_currency:    string
  project:          { id: string; name: string; project_files_url: string | null } | null
  assignee:         { id: string; full_name: string | null; avatar_url: string | null } | null
}

export interface GetTasksResult {
  tasks:       TaskWithDetails[]
  total:       number
  page:        number
  pageSize:    number
  totalPages:  number
}

export interface TaskComment {
  id:         string
  task_id:    string
  user_id:    string | null
  comment:    string
  edited_at:  string | null
  created_at: string
  user:       { full_name: string | null; avatar_url: string | null } | null
}

export interface TaskActivity {
  id:            string
  user_id:       string | null
  activity_type: ActivityType
  metadata:      Record<string, unknown> | null
  created_at:    string
  user:          { full_name: string | null; avatar_url: string | null } | null
}

export interface OrgMember {
  id:         string
  full_name:  string | null
  avatar_url: string | null
}

export interface ProjectOption {
  id:   string
  name: string
}

import type { TaskStatus, TaskPriority, ActivityType, ProjectMemberRole } from '@/types/supabase'

export type { TaskStatus, TaskPriority, ActivityType, ProjectMemberRole }

export interface ProjectStats {
  totalTasks: number
  completedTasks: number
  teamMembers: number
  invoices: number
}

export interface TaskWithAssignee {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  assignee: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export interface TeamMember {
  id: string
  user_id: string
  role: ProjectMemberRole
  profile: { full_name: string | null; avatar_url: string | null } | null
}

export interface ActivityItem {
  id: string
  user_id: string | null
  activity_type: ActivityType
  entity_type: string
  metadata: Record<string, unknown> | null
  created_at: string
  user: { full_name: string | null; avatar_url: string | null } | null
}

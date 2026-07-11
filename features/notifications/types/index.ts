import type { Database } from '@/types/supabase'

export type NotificationRow = Database['public']['Tables']['notifications']['Row']

export type NotificationType =
  | 'general'
  // Task workflow
  | 'task_assigned'
  | 'task_submitted_for_review'
  | 'task_revision_requested'
  | 'task_approved'
  | 'task_reopened'
  // Project
  | 'project_assigned'
  | 'project_status_changed'
  // Financial
  | 'invoice_sent'
  | 'invoice_overdue'
  | 'payment_received'
  | 'payment_voided'
  // Team
  | 'team_invitation_accepted'
  | 'member_role_changed'
  | 'member_specialization_changed'
  | 'member_reactivated'

export type EntityType = 'task' | 'project' | 'invoice' | 'payment' | 'team' | null

export interface Notification {
  id:              string
  organization_id: string
  user_id:         string
  actor_id:        string | null
  type:            NotificationType
  title:           string
  body:            string
  entity_type:     EntityType
  entity_id:       string | null
  link:            string | null
  is_read:         boolean
  read_at:         string | null
  created_at:      string
  updated_at:      string
}

export interface NotificationFilters {
  unread_only?: boolean
  page?:        number
  pageSize?:    number
}

export interface GetNotificationsResult {
  notifications: Notification[]
  total:         number
  page:          number
  pageSize:      number
  totalPages:    number
  unread_count:  number
}

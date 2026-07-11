import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type {
  Notification,
  NotificationFilters,
  GetNotificationsResult,
} from '../types'

type TypedClient = SupabaseClient<Database>

// ─── List notifications (paginated) ──────────────────────────────────────────

export async function dbGetNotifications(
  supabase: TypedClient,
  orgId: string,
  filters: NotificationFilters = {}
): Promise<GetNotificationsResult> {
  const pageSize = filters.pageSize ?? 20
  const page     = filters.page     ?? 1
  const from     = (page - 1) * pageSize
  const to       = from + pageSize - 1

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.unread_only) {
    query = query.eq('is_read', false)
  }

  const { data, error, count } = await query
  if (error) throw error

  const [unreadResult] = await Promise.all([
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_read', false)
      .is('deleted_at', null),
  ])

  const total = count ?? 0
  return {
    notifications: (data ?? []).map(mapRow),
    total,
    page,
    pageSize,
    totalPages:   Math.ceil(total / pageSize),
    unread_count: unreadResult.count ?? 0,
  }
}

// ─── Unread count only (for bell badge) ──────────────────────────────────────

export async function dbGetUnreadCount(
  supabase: TypedClient,
  orgId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('is_read', false)
    .is('deleted_at', null)

  if (error) throw error
  return count ?? 0
}

// ─── Recent notifications for popover (no pagination) ────────────────────────

export async function dbGetRecentNotifications(
  supabase: TypedClient,
  orgId: string,
  limit = 10
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map(mapRow)
}

// ─── Mutations (via SECURITY DEFINER RPCs) ────────────────────────────────────

export async function dbMarkNotificationRead(
  supabase: TypedClient,
  notificationId: string
): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  })
  if (error) throw error
}

export async function dbMarkAllNotificationsRead(
  supabase: TypedClient,
  orgId: string
): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read', {
    p_org_id: orgId,
  })
  if (error) throw error
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Notification {
  return {
    id:              row.id,
    organization_id: row.organization_id,
    user_id:         row.user_id,
    actor_id:        row.actor_id     ?? null,
    type:            row.type         ?? 'general',
    title:           row.title        ?? '',
    body:            row.body         ?? '',
    entity_type:     row.entity_type  ?? null,
    entity_id:       row.entity_id    ?? null,
    link:            row.link         ?? null,
    is_read:         row.is_read      ?? false,
    read_at:         row.read_at      ?? null,
    created_at:      row.created_at,
    updated_at:      row.updated_at,
  }
}

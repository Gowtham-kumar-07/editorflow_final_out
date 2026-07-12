'use server'

import { redirect }      from 'next/navigation'
import { createClient }  from '@/supabase/server'
import {
  dbGetNotifications,
  dbGetUnreadCount,
  dbGetRecentNotifications,
  dbMarkNotificationRead,
  dbMarkAllNotificationsRead,
} from '../repository/notification.repository'
import type { NotificationFilters, GetNotificationsResult, Notification } from '../types'

// ─── Auth + org context ───────────────────────────────────────────────────────

async function resolveContext() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.active_organization_id) {
    return { orgId: profile.active_organization_id, userId: user.id, supabase }
  }

  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (!membership?.organization_id) redirect('/onboarding')

  return { orgId: membership!.organization_id, userId: user.id, supabase }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getNotificationsAction(
  filters: NotificationFilters = {}
): Promise<GetNotificationsResult> {
  const { orgId, supabase } = await resolveContext()
  try {
    return await dbGetNotifications(supabase, orgId, filters)
  } catch {
    return { notifications: [], total: 0, page: 1, pageSize: 20, totalPages: 0, unread_count: 0 }
  }
}

export async function getUnreadNotificationCountAction(): Promise<number> {
  const { orgId, supabase } = await resolveContext()
  try {
    return await dbGetUnreadCount(supabase, orgId)
  } catch {
    return 0
  }
}

export async function getRecentNotificationsAction(
  limit = 10
): Promise<Notification[]> {
  const { orgId, supabase } = await resolveContext()
  try {
    return await dbGetRecentNotifications(supabase, orgId, limit)
  } catch {
    return []
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function markNotificationReadAction(
  notificationId: string
): Promise<{ ok: boolean }> {
  try {
    const { supabase } = await resolveContext()
    await dbMarkNotificationRead(supabase, notificationId)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  try {
    const { orgId, supabase } = await resolveContext()
    await dbMarkAllNotificationsRead(supabase, orgId)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

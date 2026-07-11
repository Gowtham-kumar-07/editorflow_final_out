'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { ActionResult } from './index'
import type { ProjectStats, TaskWithAssignee, TeamMember, ActivityItem } from '../types/workspace'
import {
  dbGetProjectStats,
  dbGetProjectTasksPreview,
  dbGetProjectTeam,
  dbGetProjectActivity,
} from '../repository/workspace.repository'

type TypedClient = SupabaseClient<Database>

// ─── Auth helper (shared pattern) ─────────────────────────────────────────────

async function resolveContext(): Promise<{ orgId: string; supabase: TypedClient }> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.active_organization_id) {
    return { orgId: profile.active_organization_id, supabase }
  }

  const { data: membership, error: memberError } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (memberError) throw new Error(`Failed to load membership: ${memberError.message}`)
  if (!membership?.organization_id) redirect('/onboarding')

  return { orgId: membership.organization_id, supabase }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getProjectStats(
  projectId: string
): Promise<ActionResult<ProjectStats>> {
  try {
    const { orgId, supabase } = await resolveContext()
    const stats = await dbGetProjectStats(supabase, projectId, orgId)
    return { ok: true, data: stats }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code) return { ok: false, error: `[${pg.code}] ${pg.message}` }
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function getProjectTasksPreview(
  projectId: string
): Promise<ActionResult<TaskWithAssignee[]>> {
  try {
    const { orgId, supabase } = await resolveContext()
    const tasks = await dbGetProjectTasksPreview(supabase, projectId, orgId)
    return { ok: true, data: tasks }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code) return { ok: false, error: `[${pg.code}] ${pg.message}` }
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function getProjectTeam(
  projectId: string
): Promise<ActionResult<TeamMember[]>> {
  try {
    const { supabase } = await resolveContext()
    const team = await dbGetProjectTeam(supabase, projectId)
    return { ok: true, data: team }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code) return { ok: false, error: `[${pg.code}] ${pg.message}` }
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function getProjectActivity(
  projectId: string
): Promise<ActionResult<ActivityItem[]>> {
  try {
    const { orgId, supabase } = await resolveContext()
    const activity = await dbGetProjectActivity(supabase, projectId, orgId)
    return { ok: true, data: activity }
  } catch (err) {
    const pg = err as Record<string, unknown>
    if (pg?.code) return { ok: false, error: `[${pg.code}] ${pg.message}` }
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

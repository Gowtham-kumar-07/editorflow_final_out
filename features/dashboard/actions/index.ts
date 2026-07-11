'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { OrgRole } from '@/types/supabase'
import {
  dbGetAdminDashboard,
  dbGetPmDashboard,
  dbGetMemberDashboard,
} from '../repository/dashboard.repository'
import type { DashboardData } from '../types'

// ─── Context resolution (shared pattern) ─────────────────────────────────────

async function resolveDashboardContext() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  // Active org from profile first
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .maybeSingle()

  let orgId = profile?.active_organization_id ?? null

  if (!orgId) {
    const { data: mem } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    orgId = mem?.organization_id ?? null
  }

  if (!orgId) redirect('/onboarding')

  // Role in current org
  const { data: roleData } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
  const role: OrgRole = (roleData as OrgRole | null) ?? 'member'

  return { supabase, orgId, userId: user.id, role }
}

// ─── Main dashboard action ────────────────────────────────────────────────────

export async function getDashboardDataAction(): Promise<DashboardData> {
  const { supabase, orgId, userId, role } = await resolveDashboardContext()

  if (role === 'owner' || role === 'admin') {
    const data = await dbGetAdminDashboard(supabase, orgId)
    return { role, ...data }
  }

  if (role === 'project_manager') {
    const data = await dbGetPmDashboard(supabase, orgId)
    return { role, ...data }
  }

  // member (default)
  const data = await dbGetMemberDashboard(supabase, orgId, userId)
  return { role, ...data }
}

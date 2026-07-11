import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import type { OrgRole } from '@/types/supabase'

/**
 * Fetches the current user's role in their active org.
 * Redirects to /login if unauthenticated or /dashboard if member.
 * Used in layout.tsx files to protect entire route subtrees.
 */
export async function requireManagerRole(): Promise<void> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

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

  const { data: roleData } = await supabase.rpc('get_my_role_in_org', { org_id: orgId })
  const role = (roleData as OrgRole | null) ?? 'member'

  if (role === 'member') redirect('/dashboard')
}

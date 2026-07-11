import type { Metadata } from 'next'
import { redirect }        from 'next/navigation'
import { createClient }    from '@/supabase/server'
import { PageContainer }   from '@/components/layout'
import { canViewReports }  from '@/lib/permissions'
import { ReportsClient }   from '@/features/reports/components'
import type { OrgRole }    from '@/types/supabase'

export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  // Resolve active org
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
  const role: OrgRole = (roleData as OrgRole | null) ?? 'member'

  // Members have no access to reports
  if (!canViewReports(role)) redirect('/dashboard')

  return (
    <PageContainer
      title="Reports"
      description="Analyse revenue, delivery performance, and team productivity."
    >
      <ReportsClient role={role} />
    </PageContainer>
  )
}

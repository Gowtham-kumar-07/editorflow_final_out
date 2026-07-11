import type { Metadata } from 'next'
import { redirect }      from 'next/navigation'
import { createClient }  from '@/supabase/server'
import { PageContainer } from '@/components/layout'
import { IncomeClient }  from '@/features/income/components'
import type { OrgRole }  from '@/types/supabase'

export const metadata: Metadata = { title: 'Income' }

export default async function IncomePage() {
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
  const role: OrgRole = (roleData as OrgRole | null) ?? 'member'

  // Fetch org members for the filter bar (managers only need this)
  let members: { id: string; full_name: string | null }[] = []
  if (role !== 'member') {
    const { data: mems } = await supabase
      .from('organization_memberships')
      .select('user_id, profiles(id, full_name)')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    members = (mems ?? []).map((m: any) => {
      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      return { id: m.user_id, full_name: prof?.full_name ?? null }
    })
  }

  return (
    <PageContainer
      title="Income"
      description={role === 'member' ? 'Your completed task earnings.' : 'Member income and payroll status.'}
    >
      <IncomeClient role={role} members={members} />
    </PageContainer>
  )
}

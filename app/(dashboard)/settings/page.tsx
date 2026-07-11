import { redirect }       from 'next/navigation'
import type { Metadata }  from 'next'
import { PageContainer }  from '@/components/layout'
import { createClient }   from '@/supabase/server'
import type { OrgRole }   from '@/types/supabase'
import { getSettingsAction } from '@/features/settings/actions'
import { SettingsClient }    from '@/features/settings/components'

export const metadata: Metadata = { title: 'Settings' }

async function resolveRole(): Promise<OrgRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

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
  if (!orgId) return null

  const { data: mem } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .maybeSingle()

  return (mem?.role ?? 'member') as OrgRole
}

export default async function SettingsPage() {
  const [role, data] = await Promise.all([resolveRole(), getSettingsAction()])

  if (!role) redirect('/login')

  return (
    <PageContainer
      title="Settings"
      description="Manage your profile and organization preferences."
    >
      <div className="max-w-3xl lg:max-w-none">
        <SettingsClient data={data} role={role} />
      </div>
    </PageContainer>
  )
}

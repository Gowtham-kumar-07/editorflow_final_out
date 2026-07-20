import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { createClient } from '@/supabase/server'
import { getUserOrganization, getAllUserOrganizations } from '@/services/organization.service'
import { OrganizationProvider } from '@/components/providers/organization-provider'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [organization, allOrganizations, { data: profileRow }] = await Promise.all([
    getUserOrganization(supabase, user.id),
    getAllUserOrganizations(supabase, user.id),
    supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
  ])
  // middleware.ts (proxy.ts) guards org membership before reaching this layout.
  // If no org is found here it means the user genuinely has none — send them
  // to onboarding rather than crashing with an unhandled error.
  if (!organization) redirect('/onboarding')

  const shellUser = {
    id:        user.id,
    email:     user.email ?? '',
    fullName:  profileRow?.full_name  ?? (user.user_metadata?.full_name  as string | null) ?? null,
    avatarUrl: profileRow?.avatar_url ?? (user.user_metadata?.avatar_url as string | null) ?? null,
  }

  return (
    <OrganizationProvider initialOrg={organization} initialAllOrgs={allOrganizations}>
      <DashboardShell user={shellUser}>
        {children}
      </DashboardShell>
    </OrganizationProvider>
  )
}

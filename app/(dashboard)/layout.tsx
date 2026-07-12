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
  // proxy.ts is the single source of truth for org-based routing.
  // If we somehow reach here without an org the proxy failed — throw so
  // Next.js shows an error boundary instead of creating a redirect loop.
  if (!organization) throw new Error('Organization not found. Please refresh or contact support.')

  const shellUser = {
    id:        user.id,
    email:     user.email ?? '',
    fullName:  profileRow?.full_name  ?? (user.user_metadata?.full_name  as string | null) ?? null,
    avatarUrl: profileRow?.avatar_url ?? (user.user_metadata?.avatar_url as string | null) ?? null,
  }

  return (
    <OrganizationProvider initialOrg={organization} initialAllOrgs={allOrganizations}>
      <DashboardShell user={shellUser} orgName={organization.name}>
        {children}
      </DashboardShell>
    </OrganizationProvider>
  )
}

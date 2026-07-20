import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'

import { redirect } from 'next/navigation'
import { getClientOptions } from '@/features/clients/actions'
import { getUserRole } from '@/features/projects/actions'
import { getOrgDefaultsAction } from '@/features/settings/actions'
import { PageContainer } from '@/components/layout'
import { ProjectForm } from '@/features/projects/components/project-form'
import { canCreateProject } from '@/lib/permissions'

export const metadata: Metadata = {
  title: 'New Project',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params          = await searchParams
  const defaultClientId = Array.isArray(params.client_id)
    ? params.client_id[0]
    : (params.client_id ?? undefined)

  const [clientOptions, userRole, orgDefaults] = await Promise.all([
    getClientOptions(),
    getUserRole(),
    getOrgDefaultsAction(),
  ])
  if (!canCreateProject(userRole ?? 'member')) redirect('/projects')

  return (
    <PageContainer>
      <Link
        href="/projects"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new project to track work for a client.
        </p>
      </div>

      <ProjectForm
        mode="create"
        clients={clientOptions}
        defaultClientId={defaultClientId}
        defaultCurrency={orgDefaults?.default_currency ?? 'USD'}
      />
    </PageContainer>
  )
}

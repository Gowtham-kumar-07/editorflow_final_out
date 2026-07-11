import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'

import { getProjects, getUserRole } from '@/features/projects/actions'
import { getClientOptions } from '@/features/clients/actions'
import { PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { canCreateProject } from '@/lib/permissions'
import {
  ProjectSearchFilters,
  type ProjectSortOption,
} from '@/features/projects/components/project-search-filters'
import { ProjectsTable } from '@/features/projects/components/projects-table'
import type { ProjectStatus, ProjectPriority } from '@/types/supabase'

export const metadata: Metadata = {
  title: 'Projects',
}

// ─── Sort mapping ─────────────────────────────────────────────────────────────

const SORT_MAP: Record<
  ProjectSortOption,
  { sortBy: 'name' | 'created_at' | 'updated_at' | 'due_date' | 'budget'; sortOrder: 'asc' | 'desc' }
> = {
  newest:        { sortBy: 'created_at', sortOrder: 'desc' },
  oldest:        { sortBy: 'created_at', sortOrder: 'asc' },
  'name-asc':    { sortBy: 'name',       sortOrder: 'asc' },
  'name-desc':   { sortBy: 'name',       sortOrder: 'desc' },
  'due-date':    { sortBy: 'due_date',   sortOrder: 'asc' },
  updated:       { sortBy: 'updated_at', sortOrder: 'desc' },
  'budget-desc': { sortBy: 'budget',     sortOrder: 'desc' },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function param(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params    = await searchParams
  const q         = param(params.q)
  const status    = param(params.status)    as ProjectStatus | ''
  const priority  = param(params.priority)  as ProjectPriority | ''
  const clientId  = param(params.client_id)
  const sortKey   = (param(params.sort) || 'newest') as ProjectSortOption
  const { sortBy, sortOrder } = SORT_MAP[sortKey] ?? SORT_MAP.newest
  const page      = Math.max(1, Number(param(params.page)) || 1)

  const [result, clientOptions, userRole] = await Promise.all([
    getProjects({ search: q, status, priority, clientId, sortBy, sortOrder, page }),
    getClientOptions(),
    getUserRole(),
  ])

  const hasFilters = Boolean(q || status || priority || clientId || sortKey !== 'newest')

  return (
    <PageContainer
      title="Projects"
      description={
        result.total > 0
          ? `${result.total} ${result.total === 1 ? 'project' : 'projects'}`
          : undefined
      }
      actions={
        canCreateProject(userRole ?? 'member') ? (
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        ) : undefined
      }
    >
      <ProjectSearchFilters
        defaultSearch={q}
        defaultStatus={status}
        defaultPriority={priority}
        defaultClientId={clientId}
        defaultSort={sortKey}
        clientOptions={clientOptions}
      />

      <ProjectsTable
        projects={result.projects}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        hasFilters={hasFilters}
        userRole={userRole}
      />
    </PageContainer>
  )
}

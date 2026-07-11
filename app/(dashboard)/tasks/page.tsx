import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout'
import { getProjectOptions, getOrgMembers, getCurrentUser, getUserRole } from '@/features/tasks/actions'
import { TasksListClient } from '@/features/tasks/components/tasks-list-client'
import type { TaskFilters, TaskSortField } from '@/features/tasks/types'
import { canCreateTask } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Tasks' }

type SearchParams = Promise<{
  search?:     string
  status?:     string
  priority?:   string
  projectId?:  string
  assigneeId?: string
  sortBy?:     string
  sortOrder?:  string
  page?:       string
}>

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams

  const [projects, members, currentUser, userRole] = await Promise.all([
    getProjectOptions(),
    getOrgMembers(),
    getCurrentUser(),
    getUserRole(),
  ])

  // Members default to their own task list when no explicit assignee filter is set
  const effectiveAssigneeId =
    sp.assigneeId || (userRole === 'member' && currentUser?.id ? currentUser.id : undefined)

  const filters: TaskFilters = {
    search:     sp.search     || undefined,
    status:     (sp.status    as TaskFilters['status'])   || undefined,
    priority:   (sp.priority  as TaskFilters['priority']) || undefined,
    projectId:  sp.projectId  || undefined,
    assigneeId: effectiveAssigneeId,
    sortBy:     (sp.sortBy    as TaskSortField)           || 'created_at',
    sortOrder:  (sp.sortOrder as 'asc' | 'desc')         || 'desc',
    page:       sp.page ? parseInt(sp.page, 10) : 1,
  }

  return (
    <PageContainer
      title="Tasks"
      description="View and manage tasks across all projects."
      actions={
        canCreateTask(userRole ?? 'member') ? (
          <Button size="sm" asChild>
            <Link href="/tasks/new">
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Link>
          </Button>
        ) : undefined
      }
    >
      <TasksListClient filters={filters} projects={projects} members={members} currentUserId={currentUser?.id} />
    </PageContainer>
  )
}

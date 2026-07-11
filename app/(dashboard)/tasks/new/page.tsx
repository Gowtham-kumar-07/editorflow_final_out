import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'

import { redirect } from 'next/navigation'
import { PageContainer } from '@/components/layout'
import { getProjectOptions, getOrgMembers, getUserRole } from '@/features/tasks/actions'
import { TaskForm } from '@/features/tasks/components/task-form'
import { canCreateTask, canEditTask } from '@/lib/permissions'

export const metadata: Metadata = { title: 'New Task' }

type SearchParams = Promise<{ projectId?: string }>

export default async function NewTaskPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const [projects, members, userRole] = await Promise.all([
    getProjectOptions(),
    getOrgMembers(),
    getUserRole(),
  ])
  if (!canCreateTask(userRole ?? 'member')) redirect('/tasks')

  return (
    <PageContainer>
      <Link
        href="/tasks"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Tasks
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Task</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a task and assign it to a project.
        </p>
      </div>

      <TaskForm
        mode="create"
        projects={projects}
        members={members}
        defaultProjectId={sp.projectId}
        canEditAmount={canEditTask(userRole ?? 'member')}
      />
    </PageContainer>
  )
}

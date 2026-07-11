import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'

import { getTask, getProjectOptions, getOrgMembers, getUserRole } from '@/features/tasks/actions'
import { PageContainer } from '@/components/layout'
import { TaskForm } from '@/features/tasks/components/task-form'
import { canEditTask } from '@/lib/permissions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id }  = await params
  const task    = await getTask(id)
  return { title: task ? `Edit · ${task.title}` : 'Edit Task' }
}

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [task, projects, members, userRole] = await Promise.all([
    getTask(id),
    getProjectOptions(),
    getOrgMembers(),
    getUserRole(),
  ])

  if (!task) notFound()
  if (!canEditTask(userRole ?? 'member')) redirect(`/tasks/${id}`)

  return (
    <PageContainer>
      <Link
        href={`/tasks/${id}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Task
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Task</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update <span className="font-medium">{task.title}</span>.
        </p>
      </div>

      <TaskForm
        mode="edit"
        task={task}
        projects={projects}
        members={members}
        canEditAmount={canEditTask(userRole ?? 'member')}
      />
    </PageContainer>
  )
}

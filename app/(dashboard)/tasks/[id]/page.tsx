import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ExternalLink, FolderOpen, MoreHorizontal, Pencil } from 'lucide-react'
import type { Metadata } from 'next'

import { getTask, getCurrentUser, getUserRole } from '@/features/tasks/actions'
import { canEditTask } from '@/lib/permissions'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TaskStatusBadge }   from '@/features/tasks/components/task-status-badge'
import { TaskPriorityBadge } from '@/features/tasks/components/task-priority-badge'
import { TaskComments }      from '@/features/tasks/components/task-comments'
import { TaskActivity }      from '@/features/tasks/components/task-activity'
import { TaskDetailSidebar } from '@/features/tasks/components/task-detail-sidebar'
import { formatDate } from '@/utils/format'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const task   = await getTask(id)
  return { title: task?.title ?? 'Task' }
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [task, currentUser, userRole] = await Promise.all([
    getTask(id),
    getCurrentUser(),
    getUserRole(),
  ])
  if (!task) notFound()

  const isAssignee = !!currentUser && task.assigned_to === currentUser.id
  const role = userRole ?? 'member'

  return (
    <PageContainer>
      <Link
        href="/tasks"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Tasks
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
          {task.project && (
            <Link
              href={`/projects/${task.project_id}`}
              className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {task.project.name}
            </Link>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Created {formatDate(task.created_at)} · Updated {formatDate(task.updated_at)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {task.project?.project_files_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={task.project.project_files_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Project Files
              </a>
            </Button>
          )}

          {canEditTask(role) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="mr-2 h-4 w-4" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/tasks/${id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Task
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Separator />

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {task.description ? (
                <p className="text-sm whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description provided.</p>
              )}
            </CardContent>
          </Card>

          <TaskComments taskId={id} currentUser={currentUser} />
          <TaskActivity taskId={id} />
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <div>
          <TaskDetailSidebar
            initialTask={task}
            userRole={role}
            isAssignee={isAssignee}
          />
        </div>
      </div>
    </PageContainer>
  )
}

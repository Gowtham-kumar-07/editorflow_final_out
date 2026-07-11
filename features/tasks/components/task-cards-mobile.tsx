'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, FolderOpen, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDate } from '@/utils/format'
import { TaskStatusBadge }   from './task-status-badge'
import { TaskPriorityBadge } from './task-priority-badge'
import { useArchiveTask } from '../hooks/use-tasks'
import type { TaskWithDetails } from '../types'

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function TaskCard({ task }: { task: TaskWithDetails }) {
  const router     = useRouter()
  const archiveMut = useArchiveTask()

  async function handleArchive() {
    const result = await archiveMut.mutateAsync({
      id:        task.id,
      title:     task.title,
      projectId: task.project_id,
    })
    if (!result.ok) toast.error(result.error)
    else { toast.success(`"${task.title}" archived.`); router.refresh() }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/tasks/${task.id}`}
            className="flex-1 min-w-0 font-medium text-sm hover:underline line-clamp-2"
          >
            {task.title}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/tasks/${task.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleArchive}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Badges row */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <TaskStatusBadge   status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
        </div>

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          {task.project && (
            <Link
              href={`/projects/${task.project_id}`}
              className="flex items-center gap-1 hover:text-foreground"
            >
              <FolderOpen className="h-3 w-3" />
              {task.project.name}
            </Link>
          )}

          {task.assignee && (
            <span className="flex items-center gap-1">
              <Avatar className="h-4 w-4">
                {task.assignee.avatar_url && <AvatarImage src={task.assignee.avatar_url} />}
                <AvatarFallback className="text-[8px]">
                  {initials(task.assignee.full_name)}
                </AvatarFallback>
              </Avatar>
              {task.assignee.full_name ?? '—'}
            </span>
          )}

          {task.due_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

type Props = {
  tasks:      TaskWithDetails[]
  hasFilters: boolean
}

export function TaskCardsMobile({ tasks, hasFilters }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          {hasFilters ? 'No tasks match your filters.' : 'No tasks yet.'}
        </p>
        {!hasFilters && (
          <Button asChild size="sm" className="mt-4">
            <Link href="/tasks/new">Create your first task</Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  )
}

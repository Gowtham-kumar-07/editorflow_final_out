'use client'

import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/utils/format'
import { useProjectTasksPreview } from '../../hooks/use-project-workspace'
import { TasksPreviewSkeleton } from './skeletons'
import type { TaskStatus, TaskPriority } from '../../types/workspace'

// ─── Badge helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  review:      'In Review',
  completed:   'Completed',
  blocked:     'Blocked',
}

const STATUS_VARIANT: Record<TaskStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  todo:        'outline',
  in_progress: 'secondary',
  review:      'default',
  completed:   'secondary',
  blocked:     'destructive',
}

const PRIORITY_VARIANT: Record<TaskPriority, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low:    'outline',
  medium: 'secondary',
  high:   'default',
  urgent: 'destructive',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectTasksPreview({ projectId }: { projectId: string }) {
  const { data: result, isPending } = useProjectTasksPreview(projectId)

  if (isPending) return <TasksPreviewSkeleton />

  const tasks = result?.ok ? result.data : []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Workflow Tasks</CardTitle>
        <div className="flex items-center gap-1">
          {tasks.length > 0 && (
            <Button variant="ghost" size="sm" asChild className="h-7 gap-1 text-xs">
              <Link href={`/tasks?projectId=${projectId}`}>
                View all
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild className="h-7 gap-1 text-xs">
            <Link href={`/tasks/new?projectId=${projectId}`}>
              <Plus className="h-3 w-3" />
              Add Task
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              No workflow tasks yet.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This project is managed as a single workflow. Add tasks only if you need to split the work into stages.
            </p>
            <Button variant="outline" size="sm" asChild className="mt-3">
              <Link href={`/tasks/new?projectId=${projectId}`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add first task
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 rounded-md border px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {(task.due_date || task.assignee) && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {task.assignee?.full_name && (
                        <span>{task.assignee.full_name}</span>
                      )}
                      {task.assignee?.full_name && task.due_date && (
                        <span className="mx-1">·</span>
                      )}
                      {task.due_date && (
                        <span>Due {formatDate(task.due_date)}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant={PRIORITY_VARIANT[task.priority]} className="text-xs capitalize">
                    {task.priority}
                  </Badge>
                  <Badge variant={STATUS_VARIANT[task.status]} className="text-xs">
                    {STATUS_LABEL[task.status]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

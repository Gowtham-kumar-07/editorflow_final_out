'use client'

import { toast } from 'sonner'
import { Play, Send, CheckCircle2, RotateCcw, Undo2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTransitionTaskStatus } from '../hooks/use-tasks'
import { getAllowedTaskTransitions } from '@/lib/permissions'
import type { TaskStatus } from '../types'
import type { OrgRole } from '@/types/supabase'

// ─── Status display config ────────────────────────────────────────────────────

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  review:      'In Review',
  completed:   'Completed',
  blocked:     'Blocked',
}

const STATUS_CLASS: Record<TaskStatus, string> = {
  todo:        '',
  in_progress: 'border-blue-500 text-blue-600 dark:text-blue-400',
  review:      'border-yellow-500 text-yellow-600 dark:text-yellow-400',
  completed:   'border-green-500 text-green-600 dark:text-green-400',
  blocked:     '',
}

// ─── Action button definitions ────────────────────────────────────────────────

type ActionDef = {
  label:    string
  next:     TaskStatus
  variant:  'default' | 'outline' | 'ghost'
  icon:     React.ComponentType<{ className?: string }>
}

function getActions(
  status:     TaskStatus,
  userRole:   OrgRole,
  isAssignee: boolean
): ActionDef[] {
  const allowed = getAllowedTaskTransitions(status, userRole, isAssignee)
  const isAdmin = userRole === 'owner' || userRole === 'admin' || userRole === 'project_manager'

  const defs: ActionDef[] = []

  for (const next of allowed) {
    if (next === 'in_progress' && status === 'todo') {
      defs.push({ label: 'Start Work',         next, variant: 'default',  icon: Play })
    } else if (next === 'review') {
      defs.push({ label: 'Submit for Review',  next, variant: 'default',  icon: Send })
    } else if (next === 'completed' && isAdmin) {
      defs.push({ label: 'Approve & Complete', next, variant: 'default',  icon: CheckCircle2 })
    } else if (next === 'in_progress' && status === 'review' && isAdmin) {
      defs.push({ label: 'Request Revision',   next, variant: 'outline',  icon: RotateCcw })
    } else if (next === 'in_progress' && status === 'review' && !isAdmin) {
      defs.push({ label: 'Withdraw Review',    next, variant: 'ghost',    icon: Undo2 })
    } else if (next === 'in_progress' && status === 'completed') {
      defs.push({ label: 'Reopen Task',        next, variant: 'outline',  icon: RotateCcw })
    } else if (next === 'todo') {
      defs.push({ label: 'Reset to To Do',     next, variant: 'ghost',    icon: RotateCcw })
    } else if (next === 'blocked') {
      defs.push({ label: 'Mark Blocked',       next, variant: 'ghost',    icon: RotateCcw })
    } else if (next === 'in_progress') {
      defs.push({ label: 'Resume Work',        next, variant: 'outline',  icon: Play })
    }
  }

  return defs
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  taskId:     string
  projectId:  string
  status:     TaskStatus
  userRole:   OrgRole
  isAssignee: boolean
}

export function TaskWorkflowActions({ taskId, projectId, status, userRole, isAssignee }: Props) {
  const mutation = useTransitionTaskStatus(taskId, projectId)
  const isAdmin  = userRole === 'owner' || userRole === 'admin' || userRole === 'project_manager'

  async function handle(next: TaskStatus) {
    const result = await mutation.mutateAsync(next)
    if (!result.ok) {
      toast.error(result.error)
    } else {
      toast.success(getSuccessMessage(status, next))
    }
  }

  const actions = getActions(status, userRole, isAssignee)

  return (
    <div className="space-y-2">
      {/* Current status badge */}
      <Badge variant="outline" className={STATUS_CLASS[status]}>
        {STATUS_LABEL[status]}
      </Badge>

      {/* Contextual actions */}
      {mutation.isPending ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Updating…
        </div>
      ) : actions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {actions.map((a) => {
            const Icon = a.icon
            return (
              <Button
                key={a.next}
                variant={a.variant}
                size="sm"
                className="h-7 justify-start px-2 text-xs"
                onClick={() => handle(a.next)}
              >
                <Icon className="mr-1.5 h-3 w-3" />
                {a.label}
              </Button>
            )
          })}
        </div>
      ) : (
        /* No available transitions */
        <p className="text-xs text-muted-foreground">
          {status === 'completed'
            ? 'Task approved and completed.'
            : status === 'review' && !isAdmin
              ? 'Awaiting review approval.'
              : !isAssignee && !isAdmin
                ? 'Not assigned to this task.'
                : null}
        </p>
      )}
    </div>
  )
}

function getSuccessMessage(from: TaskStatus, to: TaskStatus): string {
  if (to === 'in_progress' && from === 'todo')       return 'Work started.'
  if (to === 'review')                                return 'Submitted for review.'
  if (to === 'completed')                             return 'Task approved and completed.'
  if (to === 'in_progress' && from === 'review')      return 'Returned for revision.'
  if (to === 'in_progress' && from === 'completed')   return 'Task reopened.'
  return `Status updated to "${STATUS_LABEL[to]}".`
}

'use client'

import Link from 'next/link'
import { Calendar, Clock, User, FolderOpen, Activity, Flag, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDate } from '@/utils/format'
import { TaskWorkflowActions } from './task-workflow-actions'
import { TaskPriorityBadge } from './task-priority-badge'
import { useTask, useTaskIncome } from '../hooks/use-tasks'
import type { TaskWithDetails } from '../types'
import type { OrgRole } from '@/types/supabase'

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

type Props = {
  initialTask: TaskWithDetails
  userRole:    OrgRole
  isAssignee:  boolean
}

export function TaskDetailSidebar({ initialTask, userRole, isAssignee }: Props) {
  const { data: task } = useTask(initialTask.id, { initialData: initialTask })
  const t = task ?? initialTask

  const showIncome = t.status === 'completed' && t.amount > 0 && !!t.assigned_to
  const { data: income } = useTaskIncome(t.id, showIncome)

  const dueDate   = t.due_date ? new Date(t.due_date) : null
  const isOverdue =
    dueDate !== null &&
    dueDate.getTime() < Date.now() &&
    t.status !== 'completed'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status — role-aware workflow actions */}
        <DetailRow icon={Activity} label="Status">
          <div className="mt-0.5">
            <TaskWorkflowActions
              taskId={t.id}
              projectId={t.project_id}
              status={t.status}
              userRole={userRole}
              isAssignee={isAssignee}
            />
          </div>
        </DetailRow>

        <Separator />

        {/* Priority */}
        <DetailRow icon={Flag} label="Priority">
          <div className="mt-0.5">
            <TaskPriorityBadge priority={t.priority} />
          </div>
        </DetailRow>

        <Separator />

        {/* Assignee */}
        <DetailRow icon={User} label="Assignee">
          {t.assignee ? (
            <div className="flex items-center gap-2 mt-0.5">
              <Avatar className="h-6 w-6">
                {t.assignee.avatar_url && <AvatarImage src={t.assignee.avatar_url} />}
                <AvatarFallback className="text-[10px]">{initials(t.assignee.full_name)}</AvatarFallback>
              </Avatar>
              <span>{t.assignee.full_name ?? '—'}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          )}
        </DetailRow>

        <Separator />

        {/* Due Date */}
        <DetailRow icon={Calendar} label="Due Date">
          {t.due_date ? (
            <span className={isOverdue ? 'font-medium text-red-600 dark:text-red-400' : ''}>
              {formatDate(t.due_date)}
              {isOverdue && ' (overdue)'}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </DetailRow>

        {/* Estimated Hours */}
        {t.estimated_hours !== null && (
          <>
            <Separator />
            <DetailRow icon={Clock} label="Estimated Hours">
              {t.estimated_hours}h
            </DetailRow>
          </>
        )}

        {/* Amount */}
        {t.amount > 0 && (
          <>
            <Separator />
            <DetailRow icon={DollarSign} label="Task Amount">
              {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1 text-xs text-muted-foreground">{t.task_currency ?? 'USD'}</span>
            </DetailRow>

            {/* Member Receives — shown when income record exists with FX conversion */}
            {income && income.member_currency && income.member_currency !== (t.task_currency ?? 'USD') && (
              <>
                <Separator />
                <DetailRow icon={DollarSign} label="Member Receives">
                  <span className="font-medium">
                    {(income.converted_amount ?? income.original_amount ?? t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="ml-1 text-xs text-muted-foreground font-normal">{income.member_currency}</span>
                  </span>
                  {income.fx_rate && income.fx_rate !== 1 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      1 {t.task_currency} = {income.fx_rate.toFixed(4)} {income.member_currency}
                      {income.fx_snapshot_date && ` · ${income.fx_snapshot_date}`}
                    </p>
                  )}
                </DetailRow>
              </>
            )}
          </>
        )}

        {/* Project */}
        {t.project && (
          <>
            <Separator />
            <DetailRow icon={FolderOpen} label="Project">
              <Link href={`/projects/${t.project_id}`} className="hover:underline">
                {t.project.name}
              </Link>
            </DetailRow>
          </>
        )}
      </CardContent>
    </Card>
  )
}

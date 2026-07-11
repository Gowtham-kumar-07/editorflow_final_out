'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ProjectStatusBadge } from './project-status-badge'
import { useUpdateProjectStatus } from '../hooks/use-projects'
import { canChangeProjectStatus, getAllowedProjectStatusTransitions } from '@/lib/permissions'
import type { ProjectStatus, OrgRole } from '@/types/supabase'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft:     'Draft',
  planning:  'Planning',
  active:    'Active',
  on_hold:   'On Hold',
  review:    'In Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived:  'Archived',
}

type Props = {
  projectId:     string
  initialStatus: ProjectStatus
  userRole:      OrgRole | null
}

export function ProjectStatusSelector({ projectId, initialStatus, userRole }: Props) {
  const [status, setStatus] = useState<ProjectStatus>(initialStatus)
  const mutation = useUpdateProjectStatus(projectId)

  // Sync optimistic state when server re-renders with fresh data (after router.refresh())
  useEffect(() => { setStatus(initialStatus) }, [initialStatus])

  if (!userRole || !canChangeProjectStatus(userRole)) {
    return <ProjectStatusBadge status={status} />
  }

  const allowed = getAllowedProjectStatusTransitions(status)

  async function handleChange(next: ProjectStatus) {
    if (next === status) return
    const previous = status
    setStatus(next) // optimistic
    const result = await mutation.mutateAsync(next)
    if (!result.ok) {
      setStatus(previous) // rollback
      toast.error(result.error)
    } else {
      toast.success(`Status updated to "${STATUS_LABEL[next]}".`)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select value={status} onValueChange={(v) => handleChange(v as ProjectStatus)} disabled={mutation.isPending}>
        <SelectTrigger className="h-7 w-auto min-w-[110px] text-xs" data-no-navigate>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* Current status always shown first (selected) */}
          <SelectItem value={status}>{STATUS_LABEL[status]}</SelectItem>
          {allowed.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  )
}

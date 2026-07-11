import { Badge } from '@/components/ui/badge'
import type { TaskStatus } from '../types'

const CONFIG: Record<TaskStatus, { label: string; className: string }> = {
  todo:        { label: 'To Do',       className: 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400' },
  in_progress: { label: 'In Progress', className: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  review:      { label: 'In Review',   className: 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  completed:   { label: 'Completed',   className: 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-300' },
  blocked:     { label: 'Blocked',     className: 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300' },
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { label, className } = CONFIG[status] ?? CONFIG.todo
  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {label}
    </Badge>
  )
}

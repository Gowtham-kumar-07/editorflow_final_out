import { Badge } from '@/components/ui/badge'
import type { TaskPriority } from '../types'

const CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  low:    { label: 'Low',    className: 'border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400' },
  medium: { label: 'Medium', className: 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' },
  high:   { label: 'High',   className: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  urgent: { label: 'Urgent', className: 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300' },
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const { label, className } = CONFIG[priority] ?? CONFIG.medium
  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {label}
    </Badge>
  )
}

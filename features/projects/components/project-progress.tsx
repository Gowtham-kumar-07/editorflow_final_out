import { cn } from '@/lib/utils'

type ProjectProgressProps = {
  value: number
  showLabel?: boolean
  className?: string
}

export function ProjectProgress({ value, showLabel = true, className }: ProjectProgressProps) {
  const pct = Math.min(100, Math.max(0, value))
  const color =
    pct === 100
      ? 'bg-green-500'
      : pct >= 70
        ? 'bg-primary'
        : pct >= 30
          ? 'bg-blue-500'
          : 'bg-muted-foreground/50'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{pct}%</span>
      )}
    </div>
  )
}

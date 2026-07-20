import { PageContainer } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'

export default function TasksLoading() {
  return (
    <PageContainer title="Tasks">
      {/* Filter bar skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        <Skeleton className="h-9 flex-1 min-w-[200px]" />
        <Skeleton className="h-9 w-full sm:w-[140px]" />
        <Skeleton className="h-9 w-full sm:w-[140px]" />
        <Skeleton className="h-9 w-full sm:w-[140px]" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border">
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 border-b bg-muted/40 px-4 py-3">
          {['Title', 'Project', 'Assignee', 'Due Date', 'Status'].map((h) => (
            <Skeleton key={h} className="h-4 w-20" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="h-4 flex-1 max-w-[300px]" />
            <Skeleton className="hidden md:block h-4 w-28" />
            <Skeleton className="hidden md:block h-4 w-24" />
            <Skeleton className="hidden md:block h-4 w-20" />
            <Skeleton className="ml-auto h-5 w-20" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}

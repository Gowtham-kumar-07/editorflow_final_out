import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/layout'

export default function ProjectsLoading() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-[150px]" />
          <Skeleton className="h-9 w-[140px]" />
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="ml-auto h-9 w-[180px]" />
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <div className="flex gap-8">
            {['w-40', 'w-28', 'w-20', 'w-16', 'w-28'].map((w, i) => (
              <Skeleton key={i} className={`h-4 ${w}`} />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-8 border-b px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="ml-auto h-4 w-8" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}

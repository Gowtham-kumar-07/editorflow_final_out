import { PageContainer } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'

export default function ReportsLoading() {
  return (
    <PageContainer title="Reports & Analytics">
      {/* Tab bar skeleton */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="h-4 flex-1 max-w-[200px]" />
            <Skeleton className="hidden md:block h-4 w-24" />
            <Skeleton className="hidden md:block h-4 w-20" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}

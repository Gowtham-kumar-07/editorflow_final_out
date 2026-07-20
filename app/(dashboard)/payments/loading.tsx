import { PageContainer } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'

export default function PaymentsLoading() {
  return (
    <PageContainer title="Payments">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center mb-4">
        <Skeleton className="h-9 flex-1 min-w-[200px]" />
        <Skeleton className="h-9 w-full sm:w-[150px]" />
        <Skeleton className="h-9 w-full sm:w-[160px]" />
        <Skeleton className="h-9 w-full sm:w-[145px]" />
        <Skeleton className="h-9 w-full sm:w-[145px]" />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="hidden md:block h-4 flex-1" />
            <Skeleton className="hidden md:block h-4 w-24" />
            <Skeleton className="hidden md:block h-5 w-20" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}

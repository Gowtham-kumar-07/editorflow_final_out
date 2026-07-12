import { PageContainer } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="mt-6 space-y-3">
        <Skeleton className="h-9 w-full" />
        <div className="rounded-lg border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 border-b px-4 py-3 last:border-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="ml-auto h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}

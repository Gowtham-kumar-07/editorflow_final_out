import { Skeleton } from '@/components/ui/skeleton'

export function TeamTableSkeleton() {
  return (
    <div className="space-y-2">
      {/* Table header placeholder */}
      <div className="hidden md:grid grid-cols-[1fr_120px_140px_90px_100px_48px] gap-4 px-4 py-2">
        {['Member', 'Role', 'Specialization', 'Status', 'Workload', ''].map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-40" />
          </div>
          <Skeleton className="h-5 w-20 hidden md:block" />
          <Skeleton className="h-5 w-24 hidden md:block" />
          <Skeleton className="h-5 w-14 hidden md:block" />
          <Skeleton className="h-5 w-16 hidden md:block" />
          <Skeleton className="h-7 w-7" />
        </div>
      ))}
    </div>
  )
}

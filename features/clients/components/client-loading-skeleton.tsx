import { Skeleton } from '@/components/ui/skeleton'

const ROW_COUNT = 8

export function ClientLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter bar skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-[148px]" />
        <Skeleton className="h-9 w-[175px]" />
      </div>

      {/* Table skeleton (desktop) */}
      <div className="hidden sm:block rounded-lg border">
        <div className="border-b px-4 py-3">
          <div className="flex gap-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        {Array.from({ length: ROW_COUNT }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-4 h-4 w-28 hidden md:block" />
            <Skeleton className="ml-auto h-5 w-16" />
          </div>
        ))}
      </div>

      {/* Card skeleton (mobile) */}
      <div className="grid gap-3 sm:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-md shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-14" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

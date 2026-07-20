import { PageContainer } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <PageContainer title="Organization Settings">
      {/* Section tabs / navigation */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-md" />
        ))}
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Section header */}
        <div className="space-y-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Form fields */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}

        {/* Logo upload area */}
        <div className="rounded-lg border-2 border-dashed p-8 flex flex-col items-center gap-3">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>

        <Skeleton className="h-9 w-28" />
      </div>
    </PageContainer>
  )
}

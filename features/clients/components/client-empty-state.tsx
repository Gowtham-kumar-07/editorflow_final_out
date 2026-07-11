import Link from 'next/link'
import { Users, Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ClientStatusFilter } from '../types'

interface ClientEmptyStateProps {
  hasFilters: boolean
  statusFilter?: ClientStatusFilter
  onClearFilters?: () => void
}

export function ClientEmptyState({
  hasFilters,
  statusFilter,
  onClearFilters,
}: ClientEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="rounded-lg border">
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">No clients match your search</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your search term or filters
          </p>
          {onClearFilters && (
            <Button variant="outline" size="sm" className="mt-4" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (statusFilter === 'archived') {
    return (
      <div className="rounded-lg border">
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">No archived clients</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Archived clients will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <p className="mt-4 text-sm font-medium">No clients yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add your first client to start managing projects and invoices
        </p>
        <Button size="sm" className="mt-4" asChild>
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Link>
        </Button>
      </div>
    </div>
  )
}

'use client'

import { Suspense } from 'react'
import { TaskSearchFilters } from './task-search-filters'
import { TasksTable, TasksTableSkeleton } from './tasks-table'
import { TaskCardsMobile } from './task-cards-mobile'
import { TaskPagination } from './task-pagination'
import { useTasks } from '../hooks/use-tasks'
import type { TaskFilters, ProjectOption, OrgMember } from '../types'

type Props = {
  filters:       TaskFilters
  projects:      ProjectOption[]
  members:       OrgMember[]
  currentUserId?: string
}

function TasksContent({ filters, projects, members, currentUserId }: Props) {
  const { data, isPending, isError } = useTasks(filters)

  const hasFilters = !!(
    filters.search || filters.status || filters.priority ||
    filters.projectId || filters.assigneeId
  )

  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-destructive">
        Failed to load tasks. Please refresh.
      </p>
    )
  }

  const tasks = data?.tasks ?? []

  return (
    <div className="space-y-4">
      <TaskSearchFilters projects={projects} members={members} currentUserId={currentUserId} />

      {isPending ? (
        <>
          {/* Desktop skeleton */}
          <div className="hidden sm:block">
            <TasksTableSkeleton />
          </div>
          {/* Mobile skeleton */}
          <div className="space-y-3 sm:hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted" />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <TasksTable
              tasks={tasks}
              hasFilters={hasFilters}
              currentSort={filters.sortBy ?? 'created_at'}
              currentOrder={filters.sortOrder ?? 'desc'}
            />
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden">
            <TaskCardsMobile tasks={tasks} hasFilters={hasFilters} />
          </div>

          {data && (
            <TaskPagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
            />
          )}
        </>
      )}
    </div>
  )
}

export function TasksListClient({ filters, projects, members, currentUserId }: Props) {
  return (
    <Suspense fallback={<TasksTableSkeleton />}>
      <TasksContent filters={filters} projects={projects} members={members} currentUserId={currentUserId} />
    </Suspense>
  )
}

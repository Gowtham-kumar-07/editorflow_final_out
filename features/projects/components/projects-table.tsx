'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Eye, Edit, Archive, RotateCcw, FolderKanban } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ProjectStatusSelector } from './project-status-selector'
import { ProjectPriorityBadge } from './project-priority-badge'
import { ProjectProgress } from './project-progress'
import { ProjectArchiveDialog } from './project-archive-dialog'
import { formatDate, formatCurrency } from '@/utils/format'
import type { ProjectWithClient } from '@/types/project'
import type { OrgRole } from '@/types/supabase'

// ─── Due date display ─────────────────────────────────────────────────────────

function DueDateCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">—</span>
  const d = new Date(date)
  const diff = d.getTime() - Date.now()
  const daysLeft = Math.ceil(diff / 86_400_000)

  const className =
    daysLeft < 0
      ? 'text-red-600 dark:text-red-400 font-medium'
      : daysLeft <= 7
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-muted-foreground'

  return (
    <span className={className}>
      {formatDate(date)}
      {daysLeft < 0 && ' ⚠'}
    </span>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function TablePagination({
  page,
  totalPages,
  total,
}: {
  page: number
  totalPages: number
  total: number
}) {
  function buildPageUrl(target: number) {
    if (typeof window === 'undefined') return '#'
    const params = new URLSearchParams(window.location.search)
    params.set('page', String(target))
    return `?${params.toString()}`
  }

  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        {total} {total === 1 ? 'project' : 'projects'}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild disabled={page <= 1}>
            <Link href={buildPageUrl(page - 1)}>Previous</Link>
          </Button>
          <span className="text-xs">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
            <Link href={buildPageUrl(page + 1)}>Next</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function ProjectsEmptyState({ hasFilters, userRole }: { hasFilters: boolean; userRole: OrgRole | null }) {
  const canCreate = userRole === 'owner' || userRole === 'admin' || userRole === 'project_manager'

  if (hasFilters) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No projects found"
        description="Try adjusting your search or filters."
        action={{ label: 'Clear filters', href: '/projects' }}
      />
    )
  }
  return (
    <EmptyState
      icon={FolderKanban}
      title="No projects yet"
      description={canCreate ? 'Create your first project to get started.' : 'Projects will appear here when created.'}
      action={canCreate ? { label: 'New Project', href: '/projects/new' } : undefined}
    />
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

type ProjectsTableProps = {
  projects:  ProjectWithClient[]
  total:     number
  page:      number
  totalPages: number
  hasFilters: boolean
  userRole:  OrgRole | null
}

export function ProjectsTable({
  projects,
  total,
  page,
  totalPages,
  hasFilters,
  userRole,
}: ProjectsTableProps) {
  const router = useRouter()
  const [archiveTarget, setArchiveTarget] = useState<ProjectWithClient | null>(null)

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border">
        <ProjectsEmptyState hasFilters={hasFilters} userRole={userRole} />
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      {/* ── Mobile cards ──────────────────────────────────────────────────── */}
      <div className="md:hidden divide-y">
        {projects.map((project) => (
          <div
            key={project.id}
            className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={(e) => {
              if (!(e.target as Element).closest('[data-no-navigate]')) {
                router.push(`/projects/${project.id}`)
              }
            }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-medium truncate">{project.name}</p>
              {project.client && (
                <p className="text-xs text-muted-foreground truncate">{project.client.company_name}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap" data-no-navigate onClick={(e) => e.stopPropagation()}>
                <ProjectStatusSelector
                  projectId={project.id}
                  initialStatus={project.status}
                  userRole={userRole}
                />
                <ProjectPriorityBadge priority={project.priority} />
              </div>
              {project.due_date && (
                <div className="text-xs text-muted-foreground">
                  <DueDateCell date={project.due_date} />
                </div>
              )}
            </div>
            <div data-no-navigate>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${project.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      View details
                    </Link>
                  </DropdownMenuItem>
                  {project.status !== 'archived' && (
                    <DropdownMenuItem asChild>
                      <Link href={`/projects/${project.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {project.status === 'archived' ? (
                    <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}`)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restore
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setArchiveTarget(project)}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop table ─────────────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="hidden md:table-cell">Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Priority</TableHead>
              <TableHead className="hidden lg:table-cell w-32">Progress</TableHead>
              <TableHead className="hidden md:table-cell">Due Date</TableHead>
              <TableHead className="hidden lg:table-cell">Budget</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow
                key={project.id}
                className="cursor-pointer"
                onClick={(e) => {
                  if (!(e.target as Element).closest('[data-no-navigate]')) {
                    router.push(`/projects/${project.id}`)
                  }
                }}
              >
                <TableCell className="max-w-[220px]">
                  <span className="block truncate font-medium">{project.name}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[160px]">
                  <span className="block truncate">{project.client?.company_name ?? '—'}</span>
                </TableCell>
                <TableCell data-no-navigate onClick={(e) => e.stopPropagation()}>
                  <ProjectStatusSelector
                    projectId={project.id}
                    initialStatus={project.status}
                    userRole={userRole}
                  />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <ProjectPriorityBadge priority={project.priority} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <ProjectProgress value={project.progress} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <DueDateCell date={project.due_date} />
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                  {project.budget !== null ? formatCurrency(Number(project.budget)) : '—'}
                </TableCell>
                <TableCell data-no-navigate>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/projects/${project.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View details
                        </Link>
                      </DropdownMenuItem>
                      {project.status !== 'archived' && (
                        <DropdownMenuItem asChild>
                          <Link href={`/projects/${project.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {project.status === 'archived' ? (
                        <DropdownMenuItem
                          onClick={() => router.push(`/projects/${project.id}`)}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setArchiveTarget(project)}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination page={page} totalPages={totalPages} total={total} />

      <ProjectArchiveDialog
        project={archiveTarget}
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null)
        }}
        onSuccess={() => {
          setArchiveTarget(null)
          router.refresh()
        }}
      />
    </div>
  )
}

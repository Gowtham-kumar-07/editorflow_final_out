'use client'

import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDate } from '@/utils/format'
import { TaskStatusBadge }   from './task-status-badge'
import { TaskPriorityBadge } from './task-priority-badge'
import { useArchiveTask } from '../hooks/use-tasks'
import type { TaskWithDetails, TaskSortField } from '../types'

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortHeader({
  label,
  field,
  currentSort,
  currentOrder,
  onSort,
}: {
  label: string
  field: TaskSortField
  currentSort: string
  currentOrder: string
  onSort: (field: TaskSortField) => void
}) {
  const isActive = currentSort === field
  const Icon = isActive
    ? currentOrder === 'asc' ? ArrowUp : ArrowDown
    : ArrowUpDown

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 font-medium"
      onClick={() => onSort(field)}
    >
      {label}
      <Icon className="ml-1.5 h-3.5 w-3.5" />
    </Button>
  )
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        {hasFilters ? 'No tasks match your filters.' : 'No tasks yet.'}
      </p>
      {!hasFilters && (
        <Button asChild size="sm" className="mt-4">
          <Link href="/tasks/new">Create your first task</Link>
        </Button>
      )}
    </div>
  )
}

// ─── Table skeleton ───────────────────────────────────────────────────────────

export function TasksTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {['Title', 'Project', 'Assignee', 'Priority', 'Status', 'Due Date', 'Updated', ''].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 8 }).map((_, j) => (
                <TableCell key={j}>
                  <div className="h-4 rounded bg-muted animate-pulse" style={{ width: j === 0 ? '180px' : '80px' }} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Main table ───────────────────────────────────────────────────────────────

type Props = {
  tasks:       TaskWithDetails[]
  hasFilters:  boolean
  currentSort: string
  currentOrder: string
}

export function TasksTable({ tasks, hasFilters, currentSort, currentOrder }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const archiveMut   = useArchiveTask()

  function handleSort(field: TaskSortField) {
    const params = new URLSearchParams(searchParams.toString())
    const newOrder =
      currentSort === field && currentOrder === 'asc' ? 'desc' : 'asc'
    params.set('sortBy',    field)
    params.set('sortOrder', newOrder)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  async function handleArchive(task: TaskWithDetails) {
    const result = await archiveMut.mutateAsync({ id: task.id, title: task.title })
    if (!result.ok) toast.error(result.error)
    else { toast.success(`"${task.title}" archived.`); router.refresh() }
  }

  if (tasks.length === 0) return <EmptyState hasFilters={hasFilters} />

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortHeader label="Title" field="title" currentSort={currentSort} currentOrder={currentOrder} onSort={handleSort} />
            </TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>
              <SortHeader label="Priority" field="priority" currentSort={currentSort} currentOrder={currentOrder} onSort={handleSort} />
            </TableHead>
            <TableHead>
              <SortHeader label="Status" field="status" currentSort={currentSort} currentOrder={currentOrder} onSort={handleSort} />
            </TableHead>
            <TableHead>
              <SortHeader label="Due Date" field="due_date" currentSort={currentSort} currentOrder={currentOrder} onSort={handleSort} />
            </TableHead>
            <TableHead>
              <SortHeader label="Updated" field="updated_at" currentSort={currentSort} currentOrder={currentOrder} onSort={handleSort} />
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} className="group">
              <TableCell className="max-w-[260px]">
                <Link
                  href={`/tasks/${task.id}`}
                  className="font-medium hover:underline line-clamp-1"
                >
                  {task.title}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[140px]">
                {task.project ? (
                  <Link href={`/projects/${task.project_id}`} className="hover:text-foreground line-clamp-1">
                    {task.project.name}
                  </Link>
                ) : '—'}
              </TableCell>
              <TableCell>
                {task.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      {task.assignee.avatar_url && <AvatarImage src={task.assignee.avatar_url} />}
                      <AvatarFallback className="text-[10px]">
                        {initials(task.assignee.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate max-w-[100px]">
                      {task.assignee.full_name ?? '—'}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <TaskPriorityBadge priority={task.priority} />
              </TableCell>
              <TableCell>
                <TaskStatusBadge status={task.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {task.due_date ? formatDate(task.due_date) : '—'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(task.updated_at)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/tasks/${task.id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleArchive(task)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

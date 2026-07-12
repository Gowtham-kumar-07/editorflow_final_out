'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useRef } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { ProjectOption, OrgMember } from '../types'

type Props = {
  projects:       ProjectOption[]
  members:        OrgMember[]
  currentUserId?: string
}

export function TaskSearchFilters({ projects, members, currentUserId }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const hasFilters =
    searchParams.has('search') ||
    searchParams.has('status') ||
    searchParams.has('priority') ||
    searchParams.has('projectId') ||
    searchParams.has('assigneeId')

  function clearFilters() {
    router.push(pathname)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks…"
          className="pl-8"
          defaultValue={searchParams.get('search') ?? ''}
          onChange={(e) => {
            const val = e.target.value
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => updateParam('search', val), 300)
          }}
        />
      </div>

      <Select
        value={searchParams.get('status') ?? ''}
        onValueChange={(v) => updateParam('status', v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Statuses</SelectItem>
          <SelectItem value="todo">To Do</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="review">In Review</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="blocked">Blocked</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('priority') ?? ''}
        onValueChange={(v) => updateParam('priority', v)}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Priorities</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('projectId') ?? ''}
        onValueChange={(v) => updateParam('projectId', v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Projects</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {members.length > 0 && (
        <Select
          value={searchParams.get('assigneeId') ?? ''}
          onValueChange={(v) => updateParam('assigneeId', v)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Assignees</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name ?? m.id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {currentUserId && (
        <Button
          variant={searchParams.get('assigneeId') === currentUserId ? 'secondary' : 'outline'}
          size="sm"
          onClick={() =>
            updateParam(
              'assigneeId',
              searchParams.get('assigneeId') === currentUserId ? '' : currentUserId
            )
          }
        >
          My Tasks
        </Button>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
          Clear
        </Button>
      )}
    </div>
  )
}

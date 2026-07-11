'use client'

import {
  Users,
  FolderOpen,
  CheckSquare,
  FileText,
  CreditCard,
  UserCircle,
} from 'lucide-react'
import { CommandItem } from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import type { GlobalSearchResult, GlobalSearchResultType } from '../types'

const ICON_MAP: Record<GlobalSearchResultType, React.ComponentType<{ className?: string }>> = {
  client:      Users,
  project:     FolderOpen,
  task:        CheckSquare,
  invoice:     FileText,
  payment:     CreditCard,
  team_member: UserCircle,
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active:    'default',
  completed: 'default',
  paid:      'default',
  sent:      'secondary',
  draft:     'outline',
  overdue:   'destructive',
  cancelled: 'destructive',
  voided:    'destructive',
}

interface SearchResultItemProps {
  result:   GlobalSearchResult
  onSelect: () => void
}

export function SearchResultItem({ result, onSelect }: SearchResultItemProps) {
  const Icon = ICON_MAP[result.type]

  return (
    <CommandItem
      value={`${result.type}:${result.id}`}
      onSelect={onSelect}
      className="flex items-center gap-3 px-3 py-2"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{result.title}</p>
        {result.subtitle && (
          <p className="truncate text-xs text-muted-foreground">{result.subtitle}</p>
        )}
      </div>

      {result.status && (
        <Badge
          variant={STATUS_VARIANT[result.status] ?? 'outline'}
          className="shrink-0 text-[10px] capitalize"
        >
          {result.status.replace(/_/g, ' ')}
        </Badge>
      )}
    </CommandItem>
  )
}

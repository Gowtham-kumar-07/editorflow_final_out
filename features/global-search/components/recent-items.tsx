'use client'

import {
  Users,
  FolderOpen,
  CheckSquare,
  FileText,
  CreditCard,
  UserCircle,
  Clock,
} from 'lucide-react'
import { CommandGroup, CommandItem } from '@/components/ui/command'
import type { RecentItem, GlobalSearchResultType } from '../types'

const ICON_MAP: Record<GlobalSearchResultType, React.ComponentType<{ className?: string }>> = {
  client:      Users,
  project:     FolderOpen,
  task:        CheckSquare,
  invoice:     FileText,
  payment:     CreditCard,
  team_member: UserCircle,
}

interface RecentItemsProps {
  items:    RecentItem[]
  onSelect: (item: RecentItem) => void
}

export function RecentItems({ items, onSelect }: RecentItemsProps) {
  if (items.length === 0) return null

  return (
    <CommandGroup heading="Recent">
      {items.map((item) => {
        const Icon = ICON_MAP[item.type]
        return (
          <CommandItem
            key={`recent:${item.type}:${item.id}`}
            value={`recent:${item.type}:${item.id}`}
            onSelect={() => onSelect(item)}
            className="flex items-center gap-3 px-3 py-2"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.title}</p>
              {item.subtitle && (
                <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
              )}
            </div>
            <Clock className="h-3 w-3 shrink-0 text-muted-foreground/50" />
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}

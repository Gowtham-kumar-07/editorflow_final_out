'use client'

import { cn } from '@/lib/utils'
import type { ReportTabDef, ReportTab } from '../types'

interface ReportTabBarProps {
  tabs:      ReportTabDef[]
  activeTab: ReportTab | string
  onChange:  (tab: ReportTab) => void
}

export function ReportTabBar({ tabs, activeTab, onChange }: ReportTabBarProps) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 scrollbar-none">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
            activeTab === tab.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

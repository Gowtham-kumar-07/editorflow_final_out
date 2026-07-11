'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { PRESET_LABELS, type DatePreset, type ReportDateRange } from '../utils/date-range'

const PRESETS: DatePreset[] = ['last_7', 'last_30', 'last_90', 'ytd', 'last_year', 'custom']

interface ReportDateFilterProps {
  preset:    DatePreset
  dateRange: ReportDateRange
  onChange:  (preset: DatePreset, from?: string, to?: string) => void
}

export function ReportDateFilter({ preset, dateRange, onChange }: ReportDateFilterProps) {
  const [customFrom, setCustomFrom] = useState(dateRange.from)
  const [customTo,   setCustomTo]   = useState(dateRange.to)

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      onChange('custom', customFrom, customTo)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(p => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
            preset === p
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background text-foreground hover:bg-muted',
          )}
        >
          {PRESET_LABELS[p]}
        </button>
      ))}

      {preset === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            onChange={e => setCustomTo(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={applyCustom}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Apply
          </button>
        </div>
      )}

      {preset !== 'custom' && (
        <span className="text-xs text-muted-foreground">
          {dateRange.from} — {dateRange.to}
        </span>
      )}
    </div>
  )
}

export type DatePreset = 'last_7' | 'last_30' | 'last_90' | 'ytd' | 'last_year' | 'custom'

export interface ReportDateRange {
  from:   string // YYYY-MM-DD
  to:     string // YYYY-MM-DD
  preset: DatePreset
}

export const PRESET_LABELS: Record<DatePreset, string> = {
  last_7:    'Last 7 days',
  last_30:   'Last 30 days',
  last_90:   'Last 90 days',
  ytd:       'Year to date',
  last_year: 'Last year',
  custom:    'Custom',
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function resolveDateRange(
  preset: DatePreset,
  customFrom?: string | null,
  customTo?:   string | null,
): ReportDateRange {
  const today = new Date()
  const todayStr = toISODate(today)

  switch (preset) {
    case 'last_7': {
      const start = new Date(today)
      start.setDate(today.getDate() - 6)
      return { from: toISODate(start), to: todayStr, preset }
    }
    case 'last_30': {
      const start = new Date(today)
      start.setDate(today.getDate() - 29)
      return { from: toISODate(start), to: todayStr, preset }
    }
    case 'last_90': {
      const start = new Date(today)
      start.setDate(today.getDate() - 89)
      return { from: toISODate(start), to: todayStr, preset }
    }
    case 'ytd': {
      return { from: `${today.getFullYear()}-01-01`, to: todayStr, preset }
    }
    case 'last_year': {
      const year = today.getFullYear() - 1
      return { from: `${year}-01-01`, to: `${year}-12-31`, preset }
    }
    case 'custom': {
      if (customFrom && customTo && customFrom <= customTo) {
        return { from: customFrom, to: customTo, preset: 'custom' }
      }
      return resolveDateRange('last_30')
    }
  }
}

const VALID_PRESETS: DatePreset[] = ['last_7', 'last_30', 'last_90', 'ytd', 'last_year', 'custom']

export function parseDateRangeParams(params: {
  preset?: string | null
  from?:   string | null
  to?:     string | null
}): ReportDateRange {
  const raw = params.preset ?? 'last_30'
  const preset: DatePreset = (VALID_PRESETS as string[]).includes(raw)
    ? (raw as DatePreset)
    : 'last_30'
  return resolveDateRange(preset, params.from, params.to)
}

export function formatDateRangeLabel(range: ReportDateRange): string {
  if (range.preset !== 'custom') return PRESET_LABELS[range.preset]
  return `${range.from} — ${range.to}`
}

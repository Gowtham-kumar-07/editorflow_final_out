'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { OrgRole } from '@/types/supabase'
import { canViewFinancialReports } from '@/lib/permissions'
import { ADMIN_TABS, PM_TABS, type ReportTab, type ReportTabDef } from '../types'
import { parseDateRangeParams, type DatePreset } from '../utils/date-range'
import { ReportTabBar }    from './report-tab-bar'
import { ReportDateFilter } from './report-date-filter'
import { OverviewReportView }    from './overview-report'
import { RevenueReportView }     from './revenue-report'
import { ReceivablesReportView } from './receivables-report'
import { ClientsReportView }     from './clients-report'
import { ProjectsReportView }    from './projects-report'
import { TasksReportView }       from './tasks-report'
import { TeamReportView }        from './team-report'
import { BottlenecksReportView } from './bottlenecks-report'
import { PayrollReportView }     from './payroll-report'

interface ReportsClientProps {
  role: OrgRole
}

export function ReportsClient({ role }: ReportsClientProps) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const isFinancial = canViewFinancialReports(role)
  const tabs: ReportTabDef[] = isFinancial ? ADMIN_TABS : PM_TABS
  const defaultTab: ReportTab = isFinancial ? 'overview' : 'projects'

  const rawTab   = searchParams.get('tab') ?? defaultTab
  const rawPreset = searchParams.get('preset')
  const rawFrom   = searchParams.get('from')
  const rawTo     = searchParams.get('to')

  // Validate tab is available for this role
  const tabIds   = tabs.map(t => t.id) as string[]
  const activeTab: ReportTab = tabIds.includes(rawTab) ? (rawTab as ReportTab) : defaultTab

  const dateRange = parseDateRangeParams({ preset: rawPreset, from: rawFrom, to: rawTo })

  function setTab(newTab: ReportTab) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  function setDateRange(preset: DatePreset, customFrom?: string, customTo?: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('preset', preset)
    if (preset === 'custom' && customFrom && customTo) {
      params.set('from', customFrom)
      params.set('to',   customTo)
    } else {
      params.delete('from')
      params.delete('to')
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-5">
      {/* Date filter */}
      <ReportDateFilter
        preset={dateRange.preset}
        dateRange={dateRange}
        onChange={setDateRange}
      />

      {/* Tab navigation */}
      <ReportTabBar
        tabs={tabs}
        activeTab={activeTab}
        onChange={setTab}
      />

      {/* Active tab content */}
      <ReportContent tab={activeTab} dateRange={dateRange} />
    </div>
  )
}

interface ReportContentProps {
  tab:       ReportTab
  dateRange: ReturnType<typeof parseDateRangeParams>
}

function ReportContent({ tab, dateRange }: ReportContentProps) {
  switch (tab) {
    case 'overview':
      return <OverviewReportView    dateRange={dateRange} />
    case 'revenue':
      return <RevenueReportView     dateRange={dateRange} />
    case 'receivables':
      return <ReceivablesReportView />
    case 'clients':
      return <ClientsReportView     dateRange={dateRange} />
    case 'projects':
      return <ProjectsReportView    dateRange={dateRange} />
    case 'tasks':
      return <TasksReportView       dateRange={dateRange} />
    case 'team':
      return <TeamReportView        dateRange={dateRange} />
    case 'bottlenecks':
      return <BottlenecksReportView />
    case 'payroll':
      return <PayrollReportView />
    default:
      return <ProjectsReportView    dateRange={dateRange} />
  }
}

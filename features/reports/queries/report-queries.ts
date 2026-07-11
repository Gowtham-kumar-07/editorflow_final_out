import type { ReportTab } from '../types'

export const reportKeys = {
  all:          () => ['reports'] as const,
  tab:          (tab: ReportTab, from: string, to: string) =>
                  [...reportKeys.all(), tab, from, to] as const,
  overview:     (from: string, to: string) => reportKeys.tab('overview',     from, to),
  revenue:      (from: string, to: string) => reportKeys.tab('revenue',      from, to),
  receivables:  (from: string, to: string) => reportKeys.tab('receivables',  from, to),
  clients:      (from: string, to: string) => reportKeys.tab('clients',      from, to),
  projects:     (from: string, to: string) => reportKeys.tab('projects',     from, to),
  tasks:        (from: string, to: string) => reportKeys.tab('tasks',        from, to),
  team:         (from: string, to: string) => reportKeys.tab('team',         from, to),
  bottlenecks:  (from: string, to: string) => reportKeys.tab('bottlenecks',  from, to),
}

import type { ProjectFilters } from '../types'

export const projectKeys = {
  all:      ['projects'] as const,
  lists:    () => [...projectKeys.all,    'list']       as const,
  list:     (filters?: ProjectFilters) =>
              [...projectKeys.lists(),    filters ?? {}] as const,
  details:  () => [...projectKeys.all,    'detail']     as const,
  detail:   (id: string) =>
              [...projectKeys.details(),  id]            as const,
  stats:    (id: string) => [...projectKeys.detail(id), 'stats']    as const,
  tasks:    (id: string) => [...projectKeys.detail(id), 'tasks']    as const,
  team:     (id: string) => [...projectKeys.detail(id), 'team']     as const,
  activity: (id: string) => [...projectKeys.detail(id), 'activity'] as const,
}

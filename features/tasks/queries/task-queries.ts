import type { TaskFilters } from '../types'

export const taskKeys = {
  all:      ['tasks'] as const,
  lists:    () => [...taskKeys.all,    'list']          as const,
  list:     (filters?: TaskFilters) =>
              [...taskKeys.lists(),    filters ?? {}]   as const,
  details:  () => [...taskKeys.all,    'detail']        as const,
  detail:   (id: string) =>
              [...taskKeys.details(),  id]              as const,
  comments: (id: string) => [...taskKeys.detail(id),   'comments'] as const,
  activity: (id: string) => [...taskKeys.detail(id),   'activity'] as const,
}

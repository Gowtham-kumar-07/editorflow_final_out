import { useQuery } from '@tanstack/react-query'
import { getSettingsAction } from '../actions'
import { settingsKeys }      from '../queries/settings-queries'
import type { SettingsPageData } from '../types'

export function useSettings() {
  return useQuery<SettingsPageData>({
    queryKey: settingsKeys.page(),
    queryFn:  () => getSettingsAction(),
    staleTime: 60 * 1000,
    retry: 1,
  })
}

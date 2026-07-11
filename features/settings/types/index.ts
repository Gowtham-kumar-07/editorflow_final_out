import type { Database } from '@/types/supabase'

export type OrgSettings = Database['public']['Tables']['organizations']['Row']

export type ProfileSettings = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'email' | 'avatar_url'
>

export interface SettingsPageData {
  profile: ProfileSettings
  org:     OrgSettings | null
}

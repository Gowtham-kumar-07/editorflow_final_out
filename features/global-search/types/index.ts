export type GlobalSearchResultType =
  | 'client'
  | 'project'
  | 'task'
  | 'invoice'
  | 'payment'
  | 'team_member'

export interface GlobalSearchResult {
  id:        string
  type:      GlobalSearchResultType
  title:     string
  subtitle:  string | null
  status:    string | null
  actionUrl: string
  relevance: number
}

export interface RecentItem {
  id:        string
  type:      GlobalSearchResultType
  title:     string
  subtitle:  string | null
  actionUrl: string
  viewedAt:  number
}

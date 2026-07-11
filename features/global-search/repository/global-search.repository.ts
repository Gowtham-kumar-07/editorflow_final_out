import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { GlobalSearchResult, GlobalSearchResultType } from '../types'

type TypedClient = SupabaseClient<Database>

export async function dbGlobalSearch(
  supabase: TypedClient,
  query: string
): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase.rpc('global_search', { p_query: query })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id:        row.id as string,
    type:      row.type as GlobalSearchResultType,
    title:     row.title as string,
    subtitle:  (row.subtitle as string | null) ?? null,
    status:    (row.status  as string | null) ?? null,
    actionUrl: row.action_url as string,
    relevance: row.relevance as number,
  }))
}

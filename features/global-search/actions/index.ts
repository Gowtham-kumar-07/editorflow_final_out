'use server'

import { createClient } from '@/supabase/server'
import { dbGlobalSearch } from '../repository/global-search.repository'
import type { GlobalSearchResult } from '../types'

export async function globalSearchAction(query: string): Promise<GlobalSearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  try {
    const supabase = await createClient()
    return await dbGlobalSearch(supabase, trimmed)
  } catch (err) {
    console.error('[global_search] action error:', err instanceof Error ? err.message : err)
    return []
  }
}

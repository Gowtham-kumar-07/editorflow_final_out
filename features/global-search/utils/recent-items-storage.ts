import { isSafeRedirect } from '@/lib/safe-redirect'
import type { RecentItem, GlobalSearchResultType } from '../types'

const MAX_ITEMS = 8

const VALID_TYPES = new Set<GlobalSearchResultType>([
  'client', 'project', 'task', 'invoice', 'payment', 'team_member',
])

// Scoped by both user AND org so two users sharing the same browser
// profile in the same org cannot see each other's recent navigation.
function storageKey(userId: string, orgId: string): string {
  return `efs:recent:${userId.slice(0, 8)}:${orgId.slice(0, 8)}`
}

function isValidItem(item: unknown): item is RecentItem {
  if (typeof item !== 'object' || item === null) return false
  const r = item as Record<string, unknown>
  return (
    typeof r.id        === 'string' &&
    typeof r.type      === 'string' &&
    VALID_TYPES.has(r.type as GlobalSearchResultType) &&
    typeof r.title     === 'string' &&
    typeof r.actionUrl === 'string' &&
    isSafeRedirect(r.actionUrl as string) &&
    typeof r.viewedAt  === 'number'
  )
}

export function getRecentItems(userId: string, orgId: string): RecentItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey(userId, orgId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidItem)
  } catch {
    return []
  }
}

export function addRecentItem(
  userId: string,
  orgId: string,
  item: Omit<RecentItem, 'viewedAt'>
): void {
  if (typeof window === 'undefined') return
  if (!isSafeRedirect(item.actionUrl)) return
  try {
    const existing = getRecentItems(userId, orgId)
    const deduplicated = existing.filter(
      (i) => !(i.type === item.type && i.id === item.id)
    )
    const next: RecentItem[] = [
      { ...item, viewedAt: Date.now() },
      ...deduplicated,
    ].slice(0, MAX_ITEMS)
    localStorage.setItem(storageKey(userId, orgId), JSON.stringify(next))
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

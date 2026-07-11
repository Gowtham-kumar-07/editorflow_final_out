// Server-only FX service. Do not import from 'use client' components.
// Uses open.er-api.com (free tier, no API key required).
// Rates are cached in-process for 5 minutes to avoid hammering the provider.

export type FxSource = 'live' | 'fallback_1'

export interface FxResult {
  rate:   number
  source: FxSource
  date:   string   // YYYY-MM-DD of the rate
}

// ─── In-process cache ─────────────────────────────────────────────────────────

const CACHE     = new Map<string, { rate: number; ts: number }>()
const TTL_MS    = 5 * 60 * 1000   // 5 minutes
const API_BASE  = 'https://open.er-api.com/v6/latest'
const TIMEOUT   = 5_000            // 5 s

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getFxRate(from: string, to: string): Promise<FxResult> {
  const f   = from.toUpperCase()
  const t   = to.toUpperCase()
  const now = todayStr()

  if (f === t) return { rate: 1, source: 'live', date: now }

  const key    = `${f}/${t}`
  const cached = CACHE.get(key)
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return { rate: cached.rate, source: 'live', date: now }
  }

  try {
    const res = await fetch(`${API_BASE}/${f}`, {
      signal: AbortSignal.timeout(TIMEOUT),
      // Bypass Next.js data cache — we manage our own in-process cache
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`FX API HTTP ${res.status}`)

    const json = await res.json()
    if (json.result !== 'success') throw new Error(`FX API: ${json['error-type'] ?? 'unknown error'}`)

    const rate: number = json.rates?.[t]
    if (typeof rate !== 'number' || rate <= 0) {
      throw new Error(`No rate returned for ${t}`)
    }

    CACHE.set(key, { rate, ts: Date.now() })
    return { rate, source: 'live', date: now }
  } catch (err) {
    // Log server-side only — never surfaces to browser
    console.error('[fx] rate lookup failed', { from: f, to: t, err: String(err) })
    // Fallback: 1:1 with explicit source tag so the audit trail is honest
    return { rate: 1, source: 'fallback_1', date: now }
  }
}

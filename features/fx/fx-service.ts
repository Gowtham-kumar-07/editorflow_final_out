// Server-only FX service. Do not import from 'use client' components.
// Uses open.er-api.com (free tier, no API key required).
// Rates are cached in-process for 5 minutes to avoid hammering the provider.

export type FxSource = 'live' | 'fallback_1' | 'same_currency'

export interface FxResult {
  rate:   number
  source: FxSource
  date:   string   // YYYY-MM-DD of the rate
}

export interface PayrollFxSnapshot {
  original_amount:   number
  original_currency: string
  member_currency:   string
  converted_amount:  number
  fx_rate:           number
  fx_rate_source:    FxSource
  fx_snapshot_date:  string
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

  if (f === t) return { rate: 1, source: 'same_currency', date: now }

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
    throw new Error(`FX rate unavailable for ${f}/${t}: ${String(err)}`)
  }
}

// ─── Payroll FX helper ────────────────────────────────────────────────────────

export async function capturePayrollFxSnapshot(
  originalAmount:   number,
  originalCurrency: string,
  memberCurrency:   string
): Promise<PayrollFxSnapshot> {
  const from = originalCurrency.toUpperCase()
  const to   = memberCurrency.toUpperCase()
  const fx   = await getFxRate(from, to)

  const converted = parseFloat((originalAmount * fx.rate).toFixed(2))

  return {
    original_amount:   originalAmount,
    original_currency: from,
    member_currency:   to,
    converted_amount:  converted,
    fx_rate:           fx.rate,
    fx_rate_source:    fx.source,
    fx_snapshot_date:  fx.date,
  }
}

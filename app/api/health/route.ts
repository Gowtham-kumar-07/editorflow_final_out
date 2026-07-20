export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export async function GET() {
  const start = Date.now()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return NextResponse.json(
      { status: 'unhealthy', database: 'misconfigured', timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }

  try {
    const admin = createSupabaseAdmin<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Simple connectivity check — RLS bypassed by service role
    const { error } = await admin.from('organizations').select('id').limit(1)

    if (error) {
      return NextResponse.json(
        { status: 'unhealthy', database: 'error', timestamp: new Date().toISOString() },
        { status: 503 }
      )
    }

    return NextResponse.json({
      status:      'healthy',
      database:    'ok',
      version:     process.env.APP_VERSION ?? '1.0.0',
      timestamp:   new Date().toISOString(),
      latency_ms:  Date.now() - start,
    })
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', database: 'unreachable', timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
}

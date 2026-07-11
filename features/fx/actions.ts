'use server'

import { createClient }  from '@/supabase/server'
import { getFxRate }     from './fx-service'
import type { FxResult } from './fx-service'

export interface FxPreview extends FxResult {
  transaction_currency: string
  base_currency:        string
}

// Called from dialogs to show the user an estimated base-currency equivalent
// before they submit. The server independently re-fetches the rate on submit.
export async function getFxPreviewAction(invoiceId: string): Promise<FxPreview | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('invoices')
      .select('currency, organizations(default_currency)')
      .eq('id', invoiceId)
      .maybeSingle()

    if (error || !data) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseCurrency: string = (data.organizations as any)?.default_currency ?? 'USD'
    const txCurrency   = data.currency ?? 'USD'

    const fx = await getFxRate(txCurrency, baseCurrency)

    return { ...fx, transaction_currency: txCurrency, base_currency: baseCurrency }
  } catch {
    return null
  }
}

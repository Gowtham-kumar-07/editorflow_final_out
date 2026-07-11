export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { createClient } from '@/supabase/server'
import { dbGetPaymentById } from '@/features/payments/repository/payment.repository'
import { PAYMENT_METHOD_LABELS } from '@/features/payments/types'
import type { PaymentMethod } from '@/features/payments/types'

const el = React.createElement

function pdfMoney(amount: number, currency = 'USD'): string {
  return `${currency} ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))}`
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

async function fetchImageData(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const buf  = await res.arrayBuffer()
    const mime = res.headers.get('content-type') ?? 'image/png'
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}

interface ReceiptData {
  paymentId:            string
  amount:               number
  paymentDate:          string
  paymentMethod:        string
  transactionReference: string | null
  notes:                string | null
  invoiceNumber:        string
  invoiceTotal:         number
  currency:             string
  clientName:           string
  orgName:              string
  logoData:             string | null
  accentColor:          string
  footerText:           string | null
  isVoided:             boolean
  voidedAt:             string | null
  voidReason:           string | null
  // FX fields — only present when transaction_currency ≠ base_currency
  baseAmount:           number | null
  baseCurrency:         string | null
  fxRate:               number | null
  fxRateSource:         string | null
}

function ReceiptPDF(data: ReceiptData) {
  const methodLabel = PAYMENT_METHOD_LABELS[data.paymentMethod as PaymentMethod] ?? data.paymentMethod
  const orgInits    = initials(data.orgName)
  const accent      = data.accentColor

  const C = {
    navy:    '#0f172a',
    accent,
    blueBg:  '#dbeafe',
    border:  '#e2e8f0',
    surfA:   '#f8fafc',
    muted:   '#64748b',
    body:    '#1e293b',
    white:   '#ffffff',
    green:   '#16a34a',
    greenBg: '#dcfce7',
    red:     '#dc2626',
    redBg:   '#fee2e2',
  }

  const styles = StyleSheet.create({
    page:       { fontFamily: 'Helvetica', fontSize: 9, color: C.body, backgroundColor: C.white, padding: 36 },
    row:        { flexDirection: 'row' },
    col:        { flexDirection: 'column' },
    headerMark: { width: 44, height: 44, borderRadius: 8, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
    headerLogo: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden' },
    markText:   { color: C.white, fontSize: 16, fontFamily: 'Helvetica-Bold' },
    vDivider:   { width: 1, backgroundColor: C.border, marginHorizontal: 14 },
    metaLabel:  { fontSize: 7, color: C.muted, letterSpacing: 1 },
    metaValue:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy, marginTop: 2 },
    stamp:      { borderRadius: 6, backgroundColor: C.greenBg, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },
    stampText:  { color: C.green, fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 0.5 },
    voidStamp:  { borderRadius: 6, backgroundColor: C.redBg, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },
    voidText:   { color: C.red, fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 0.5 },
    card:       { borderRadius: 6, border: 1, borderColor: C.border, backgroundColor: C.surfA, padding: 12, flex: 1 },
    cardLabel:  { fontSize: 7, color: C.muted, letterSpacing: 1, marginBottom: 4 },
    cardValue:  { fontSize: 9, color: C.body },
    cardBold:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.navy },
    amountBox:  { borderRadius: 6, backgroundColor: C.blueBg, padding: 14, marginTop: 14 },
    amountLbl:  { fontSize: 7, color: C.accent, letterSpacing: 1, marginBottom: 4 },
    amountVal:  { fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.navy },
    footer:     { marginTop: 28, borderTop: 1, borderColor: C.border, paddingTop: 10, alignItems: 'center' },
    footerText: { fontSize: 7, color: C.muted, textAlign: 'center' },
  })

  const orgMark = data.logoData
    ? el(View, { style: styles.headerLogo },
        el(Image, { src: data.logoData, style: { width: '100%', height: '100%', objectFit: 'contain' } })
      )
    : el(View, { style: styles.headerMark },
        el(Text, { style: styles.markText }, orgInits)
      )

  const footerContent = data.footerText
    ? `${data.footerText} · ${data.orgName}`
    : `Thank you for your payment · ${data.orgName}`

  return el(Document, { title: `Receipt - ${data.invoiceNumber}` },
    el(Page, { size: 'A4', style: styles.page },

      // Header
      el(View, { style: [styles.row, { alignItems: 'center', marginBottom: 24 }] },
        orgMark,
        el(View, { style: styles.vDivider }),
        el(View, { style: styles.col },
          el(Text, { style: styles.metaLabel }, 'PAYMENT RECEIPT'),
          el(Text, { style: styles.metaValue }, data.invoiceNumber),
          data.isVoided
            ? el(View, { style: styles.voidStamp }, el(Text, { style: styles.voidText }, 'VOIDED'))
            : el(View, { style: styles.stamp },     el(Text, { style: styles.stampText }, 'PAYMENT RECEIVED')),
        )
      ),

      // Details row
      el(View, { style: [styles.row, { gap: 10, marginBottom: 6 }] },
        el(View, { style: styles.card },
          el(Text, { style: styles.cardLabel }, 'Billed To'),
          el(Text, { style: styles.cardBold }, data.clientName)
        ),
        el(View, { style: styles.card },
          el(Text, { style: styles.cardLabel }, 'Invoice'),
          el(Text, { style: styles.cardBold }, data.invoiceNumber),
          el(Text, { style: [styles.cardValue, { marginTop: 3, color: C.muted }] },
            `Total: ${pdfMoney(data.invoiceTotal, data.currency)}`
          )
        ),
        el(View, { style: styles.card },
          el(Text, { style: styles.cardLabel }, 'Payment Date'),
          el(Text, { style: styles.cardBold }, fmtDate(data.paymentDate)),
          el(Text, { style: [styles.cardValue, { marginTop: 3, color: C.muted }] }, methodLabel)
        ),
      ),

      // Amount block
      el(View, { style: styles.amountBox },
        el(Text, { style: styles.amountLbl }, 'AMOUNT RECEIVED'),
        el(Text, { style: styles.amountVal }, pdfMoney(data.amount, data.currency)),
        // FX row — only shown for cross-currency payments
        data.baseAmount !== null && data.baseCurrency && data.fxRate
          ? el(View, { style: { marginTop: 6, flexDirection: 'row', alignItems: 'baseline', gap: 4 } },
              el(Text, { style: { fontSize: 8, color: C.accent, letterSpacing: 0.5 } }, 'CONVERTED'),
              el(Text, { style: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy } },
                pdfMoney(data.baseAmount, data.baseCurrency)
              ),
              el(Text, { style: { fontSize: 7, color: C.muted } },
                `@ ${data.fxRate.toFixed(4)} ${data.currency}/${data.baseCurrency}${data.fxRateSource === 'fallback_1' ? ' (estimated)' : ''}`
              ),
            )
          : null,
      ),

      // Transaction reference & notes
      (data.transactionReference || data.notes)
        ? el(View, { style: { marginTop: 14, gap: 6 } },
            data.transactionReference
              ? el(View, { style: styles.row },
                  el(Text, { style: { color: C.muted, width: 100 } }, 'Transaction Ref:'),
                  el(Text, { style: { color: C.body, fontFamily: 'Helvetica-Bold' } }, data.transactionReference)
                )
              : null,
            data.notes
              ? el(View, { style: styles.row },
                  el(Text, { style: { color: C.muted, width: 100 } }, 'Notes:'),
                  el(Text, { style: { color: C.body } }, data.notes)
                )
              : null,
          )
        : null,

      // Void details
      data.isVoided
        ? el(View, { style: { marginTop: 14, backgroundColor: C.redBg, borderRadius: 6, padding: 12, gap: 4 } },
            el(Text, { style: { color: C.red, fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 1, marginBottom: 4 } }, 'PAYMENT VOIDED'),
            data.voidedAt
              ? el(View, { style: styles.row },
                  el(Text, { style: { color: C.muted, width: 100 } }, 'Voided On:'),
                  el(Text, { style: { color: C.body } }, fmtDate(data.voidedAt))
                )
              : null,
            data.voidReason
              ? el(View, { style: [styles.row, { marginTop: 2 }] },
                  el(Text, { style: { color: C.muted, width: 100 } }, 'Reason:'),
                  el(Text, { style: { color: C.body } }, data.voidReason)
                )
              : null,
          )
        : null,

      // Footer
      el(View, { style: styles.footer },
        el(Text, { style: styles.footerText }, footerContent)
      ),
    )
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const payment = await dbGetPaymentById(supabase, id)
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('invoice_number, total, currency, organization_id, clients(company_name), organizations(name, logo_url, invoice_accent_color, invoice_footer_text)')
    .eq('id', payment.invoice_id)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv = invoice as any
  const org = (inv.organizations as {
    name:                 string
    logo_url:             string | null
    invoice_accent_color: string | null
    invoice_footer_text:  string | null
  } | null) ?? { name: '', logo_url: null, invoice_accent_color: null, invoice_footer_text: null }

  const logoData = await fetchImageData(org.logo_url)

  const showFx = payment.transaction_currency &&
    payment.base_currency &&
    payment.transaction_currency !== payment.base_currency

  const receiptData: ReceiptData = {
    paymentId:            payment.id,
    amount:               payment.amount,
    paymentDate:          payment.payment_date,
    paymentMethod:        payment.payment_method,
    transactionReference: payment.transaction_reference,
    notes:                payment.notes,
    invoiceNumber:        inv.invoice_number ?? '',
    invoiceTotal:         Number(inv.total ?? 0),
    currency:             inv.currency ?? 'USD',
    clientName:           (inv.clients as { company_name: string } | null)?.company_name ?? '',
    orgName:              org.name,
    logoData,
    accentColor:          org.invoice_accent_color ?? '#2563eb',
    footerText:           org.invoice_footer_text,
    isVoided:             payment.status === 'voided',
    voidedAt:             payment.voided_at,
    voidReason:           payment.void_reason,
    baseAmount:           showFx ? payment.base_amount  : null,
    baseCurrency:         showFx ? payment.base_currency : null,
    fxRate:               showFx ? payment.fx_rate       : null,
    fxRateSource:         showFx ? payment.fx_rate_source : null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(ReceiptPDF(receiptData) as any)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="Receipt-${inv.invoice_number}.pdf"`,
      'Cache-Control':       'no-store',
    },
  })
}

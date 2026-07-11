// Force Node.js runtime — @react-pdf/renderer requires Node.js APIs.
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import { createClient } from '@/supabase/server'
import { canViewInvoices } from '@/lib/permissions'
import type { OrgRole } from '@/types/supabase'
import type { InvoiceWithDetails } from '@/features/invoices/types'

const el = React.createElement

// ─── PDF-safe money formatter ─────────────────────────────────────────────────
// Intl.NumberFormat with style:'currency' outputs non-ASCII glyphs (€, £, ₹)
// that Helvetica base-14 fonts don't contain. Use ISO code + plain number.
function pdfMoney(amount: number, currency = 'USD'): string {
  const n = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  return `${currency} ${n}`
}

function fmtDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(date + 'T00:00:00'))
}

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

// ─── Org data type (full settings as of Sprint 12A) ──────────────────────────
type OrgData = {
  name:                 string
  logo_url:             string | null
  logoData:             string | null   // pre-fetched base64 data URI
  tagline:              string | null
  business_email:       string | null
  business_phone:       string | null
  website:              string | null
  address_line1:        string | null
  address_line2:        string | null
  city:                 string | null
  state:                string | null
  postal_code:          string | null
  country:              string | null
  tax_id:               string | null
  invoice_accent_color: string | null
  invoice_footer_text:  string | null
  invoice_legal_text:   string | null
  bank_name:            string | null
  bank_account_name:    string | null
  bank_account_number:  string | null
  bank_ifsc:            string | null
  bank_swift:           string | null
  bank_branch:          string | null
  upi_id:               string | null
  payment_qr_url:       string | null
  qrData:               string | null   // pre-fetched base64 data URI
}

// ─── Color palette (accent substituted at render time) ───────────────────────
function makeColors(accent: string) {
  return {
    navy:    '#0f172a',
    navyMed: '#1e3a5f',
    accent,
    blueBg:  '#dbeafe',
    blueXl:  '#eff6ff',
    border:  '#e2e8f0',
    surfA:   '#f8fafc',
    surfB:   '#f1f5f9',
    muted:   '#64748b',
    faint:   '#94a3b8',
    body:    '#1e293b',
    white:   '#ffffff',
    green:   '#16a34a',
  }
}

function statusBadge(s: string): { bg: string; fg: string; label: string } {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    draft:     { bg: '#f1f5f9', fg: '#64748b', label: 'DRAFT'     },
    sent:      { bg: '#eff6ff', fg: '#2563eb', label: 'SENT'      },
    paid:      { bg: '#f0fdf4', fg: '#16a34a', label: 'PAID'      },
    overdue:   { bg: '#fef2f2', fg: '#dc2626', label: 'OVERDUE'   },
    partial:   { bg: '#fffbeb', fg: '#d97706', label: 'PARTIAL'   },
    cancelled: { bg: '#f9fafb', fg: '#9ca3af', label: 'CANCELLED' },
  }
  return map[s] ?? { bg: '#f1f5f9', fg: '#64748b', label: s.toUpperCase() }
}

// ─── InvoicePDF ───────────────────────────────────────────────────────────────

function InvoicePDF({
  invoice,
  org,
}: {
  invoice: InvoiceWithDetails
  org:     OrgData
}) {
  const C          = makeColors(org.invoice_accent_color ?? '#2563eb')
  const cur        = invoice.currency ?? 'USD'
  const subtotal   = Number(invoice.subtotal)
  const discAmt    = Number(invoice.discount)
  const taxAmt     = Number(invoice.tax)
  const total      = Number(invoice.total)
  const taxRate    = Number(invoice.tax_rate)
  const discValue  = Number(invoice.discount_value)
  const discType   = invoice.discount_type
  const taxable    = subtotal - discAmt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw        = invoice as any
  const paidAmount = Number(raw.paid_amount ?? 0)
  const balanceDue = Number(raw.balance_due ?? (total - paidAmount))
  const hasPaid    = paidAmount > 0
  const isFullyPaid = invoice.status === 'paid'

  const badge      = statusBadge(invoice.status)
  const initials   = getInitials(org.name)
  const client     = invoice.client as InvoiceWithDetails['client'] & {
    contact_name?: string | null
    phone?:        string | null
  }
  const hasProjects = invoice.projects.length > 0

  // Build address string for org header
  const addressParts = [
    org.address_line1,
    org.address_line2,
    [org.city, org.state].filter(Boolean).join(', '),
    [org.postal_code, org.country].filter(Boolean).join(' '),
  ].filter(Boolean)

  // Styles (created inline so accent can vary per org)
  const S = StyleSheet.create({
    page:         { fontFamily: 'Helvetica', fontSize: 9, color: C.body, backgroundColor: C.white, paddingTop: 44, paddingBottom: 40, paddingHorizontal: 48, lineHeight: 1.5 },
    header:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
    orgBlock:     { flex: 1, paddingRight: 16 },
    orgMark:      { width: 42, height: 42, backgroundColor: C.navyMed, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    orgMarkText:  { color: C.white, fontSize: 15, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
    orgLogoBox:   { width: 42, height: 42, marginBottom: 10, overflow: 'hidden', borderRadius: 4 },
    orgName:      { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 1 },
    orgDetail:    { fontSize: 8, color: C.muted, lineHeight: 1.4 },
    vDivider:     { width: 1, backgroundColor: C.border, marginHorizontal: 20, alignSelf: 'stretch' },
    metaBlock:    { alignItems: 'flex-end', minWidth: 175 },
    invoiceTitle: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: C.navy, letterSpacing: 3, marginBottom: 4 },
    invoiceNum:   { fontSize: 10, color: C.muted, marginBottom: 8 },
    badgeWrap:    { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 3, alignSelf: 'flex-end', marginBottom: 10 },
    badgeText:    { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
    dateLine:     { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3 },
    dateLabel:    { fontSize: 8, color: C.faint, width: 60, textAlign: 'right', marginRight: 8 },
    dateValue:    { fontSize: 8, color: C.body, fontFamily: 'Helvetica-Bold' },
    hrLight:      { borderBottomWidth: 1, borderBottomColor: C.border },
    sectionLbl:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, letterSpacing: 0.8, marginBottom: 4 },
    bodyText:     { fontSize: 8, color: C.body, lineHeight: 1.5 },
    mutedText:    { fontSize: 8, color: C.muted, lineHeight: 1.6 },
    cardsRow:     { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 24 },
    card:         { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 4, backgroundColor: C.surfA, padding: 14 },
    cardLbl:      { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.accent, letterSpacing: 1, marginBottom: 6 },
    cardDiv:      { borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 8 },
    cardPrim:     { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 3 },
    cardSec:      { fontSize: 8, color: C.muted, lineHeight: 1.5, marginBottom: 2 },
    tableAccent:  { height: 3, backgroundColor: C.accent },
    tableHdr:     { flexDirection: 'row', backgroundColor: C.navy, paddingVertical: 8, paddingHorizontal: 12 },
    tableRow:     { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    tableRowAlt:  { backgroundColor: C.surfA },
    colNum:   { width: 20, fontSize: 9 },
    colDesc:  { flex: 1,   fontSize: 9, paddingRight: 6 },
    colQty:   { width: 40, fontSize: 9, textAlign: 'right' },
    colPrice: { width: 90, fontSize: 9, textAlign: 'right' },
    colAmt:   { width: 90, fontSize: 9, textAlign: 'right' },
    colNumH:   { width: 20, fontSize: 7, color: C.faint, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6 },
    colDescH:  { flex: 1,   fontSize: 7, color: C.faint, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6 },
    colQtyH:   { width: 40, fontSize: 7, color: C.faint, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, textAlign: 'right' },
    colPriceH: { width: 90, fontSize: 7, color: C.faint, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, textAlign: 'right' },
    colAmtH:   { width: 90, fontSize: 7, color: C.faint, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, textAlign: 'right' },
    bottomRow:  { flexDirection: 'row', gap: 24, marginTop: 28 },
    notesBlock: { flex: 1 },
    bankBlock:  { flex: 1 },
    sumCard:  { width: 216, borderWidth: 1, borderColor: C.border, borderRadius: 4 },
    sumHead:  { backgroundColor: C.surfB, paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    sumHdTxt: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, letterSpacing: 1 },
    sumBody:  { padding: 12 },
    sumRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    sumLbl:   { fontSize: 8, color: C.muted },
    sumVal:   { fontSize: 8, color: C.body },
    sumDivider: { borderTopWidth: 1, borderTopColor: C.border, marginBottom: 8, marginTop: 2 },
    totalBlock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.blueBg, paddingVertical: 10, paddingHorizontal: 12, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
    totalLbl: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navyMed },
    totalVal: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.accent },
    footerArea: { marginTop: 32, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 18 },
    footerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    thankBox:   { flex: 1, alignItems: 'center' },
    thankTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 4, textAlign: 'center' },
    thankText:  { fontSize: 8, color: C.muted, textAlign: 'center', lineHeight: 1.5 },
    legalBox:   { borderTopWidth: 1, borderTopColor: C.border, marginTop: 14, paddingTop: 10 },
    legalText:  { fontSize: 7, color: C.faint, textAlign: 'center' },
    qrBox:      { width: 64, height: 64, marginLeft: 16 },
  })

  // ── 1. HEADER ──────────────────────────────────────────────────────────────
  const orgMark = org.logoData
    ? el(View, { style: S.orgLogoBox },
        el(Image, { src: org.logoData, style: { width: '100%', height: '100%', objectFit: 'contain' } })
      )
    : el(View, { style: S.orgMark },
        el(Text, { style: S.orgMarkText }, initials)
      )

  const orgContactLines = [
    org.tagline,
    org.business_email,
    org.business_phone,
    org.website,
    ...addressParts,
    org.tax_id ? `GST/Tax ID: ${org.tax_id}` : null,
  ].filter(Boolean) as string[]

  const header = el(View, { style: S.header },
    el(View, { style: S.orgBlock },
      orgMark,
      el(Text, { style: S.orgName }, org.name),
      ...orgContactLines.map((line, i) =>
        el(Text, { key: i, style: S.orgDetail }, line)
      ),
    ),
    el(View, { style: S.vDivider }),
    el(View, { style: S.metaBlock },
      el(Text, { style: S.invoiceTitle }, 'INVOICE'),
      el(Text, { style: S.invoiceNum }, invoice.invoice_number),
      el(View, { style: { ...S.badgeWrap, backgroundColor: badge.bg } },
        el(Text, { style: { ...S.badgeText, color: badge.fg } }, badge.label),
      ),
      el(View, { style: S.dateLine },
        el(Text, { style: S.dateLabel }, 'Issue Date'),
        el(Text, { style: S.dateValue }, fmtDate(invoice.issue_date)),
      ),
      invoice.due_date
        ? el(View, { style: S.dateLine },
            el(Text, { style: S.dateLabel }, 'Due Date'),
            el(Text, { style: S.dateValue }, fmtDate(invoice.due_date)),
          )
        : null,
    ),
  )

  // ── 2. CARDS ───────────────────────────────────────────────────────────────
  const billToCard = el(View, { style: S.card },
    el(Text, { style: S.cardLbl }, 'BILL TO'),
    el(View, { style: S.cardDiv }),
    el(Text, { style: S.cardPrim }, client.company_name),
    client.contact_name ? el(Text, { style: S.cardSec }, client.contact_name) : null,
    client.email        ? el(Text, { style: S.cardSec }, client.email)        : null,
    client.phone        ? el(Text, { style: S.cardSec }, client.phone)        : null,
    client.address      ? el(Text, { style: S.cardSec }, client.address)      : null,
    client.gst_tax_id   ? el(Text, { style: S.cardSec }, `GST/Tax ID: ${client.gst_tax_id}`) : null,
  )

  const projHeading = hasProjects
    ? (invoice.projects.length === 1 ? 'PROJECT' : 'PROJECTS')
    : 'DETAILS'

  const projCard = el(View, { style: S.card },
    el(Text, { style: S.cardLbl }, projHeading),
    el(View, { style: S.cardDiv }),
    ...(hasProjects
      ? invoice.projects.map((p) =>
          el(View, { key: p.id, style: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 } },
            el(View, { style: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent, marginTop: 2, marginRight: 7 } }),
            el(Text, { style: { ...S.bodyText, flex: 1 } }, p.name),
          )
        )
      : [el(Text, { key: 'no-proj', style: { ...S.mutedText, fontStyle: 'italic' } }, 'No linked projects')]
    ),
    ...(invoice.payment_terms
      ? [
          el(View, { key: 'pt-div', style: { ...S.cardDiv, marginTop: 12 } }),
          el(Text, { key: 'pt-lbl', style: S.cardLbl }, 'PAYMENT TERMS'),
          el(Text, { key: 'pt-val', style: S.bodyText }, invoice.payment_terms),
        ]
      : []
    ),
  )

  const cardsRow = el(View, { style: S.cardsRow }, billToCard, projCard)

  // ── 3. TABLE ───────────────────────────────────────────────────────────────
  const tableHdr = el(View, { style: S.tableHdr },
    el(Text, { style: S.colNumH   }, '#'),
    el(Text, { style: S.colDescH  }, 'DESCRIPTION'),
    el(Text, { style: S.colQtyH   }, 'QTY'),
    el(Text, { style: S.colPriceH }, 'UNIT PRICE'),
    el(Text, { style: S.colAmtH   }, 'AMOUNT'),
  )

  const tableRows = invoice.items.map((item, i) =>
    el(View, {
      key:  item.id,
      wrap: false,
      style: i % 2 === 1 ? { ...S.tableRow, ...S.tableRowAlt } : S.tableRow,
    },
      el(Text, { style: { ...S.colNum,   color: C.faint } }, String(i + 1)),
      el(Text, { style: { ...S.colDesc,  color: C.body  } }, item.description),
      el(Text, { style: { ...S.colQty,   color: C.muted } }, String(Number(item.quantity))),
      el(Text, { style: { ...S.colPrice, color: C.muted } }, pdfMoney(Number(item.unit_price), cur)),
      el(Text, { style: { ...S.colAmt,   color: C.navy, fontFamily: 'Helvetica-Bold' } },
        pdfMoney(Number(item.amount), cur),
      ),
    )
  )

  // ── 4. BOTTOM ROW: notes/bank left, summary right ─────────────────────────
  const hasBankDetails = !!(
    org.bank_name || org.bank_account_number || org.upi_id
  )

  const bankLines = hasBankDetails
    ? [
        org.bank_name                          ? `Bank: ${org.bank_name}`                             : null,
        org.bank_branch                        ? `Branch: ${org.bank_branch}`                         : null,
        org.bank_account_name                  ? `A/c Name: ${org.bank_account_name}`                 : null,
        org.bank_account_number                ? `A/c No: ${org.bank_account_number}`                 : null,
        org.bank_ifsc                          ? `IFSC: ${org.bank_ifsc}`                             : null,
        org.bank_swift                         ? `SWIFT: ${org.bank_swift}`                           : null,
        org.upi_id                             ? `UPI: ${org.upi_id}`                                 : null,
      ].filter(Boolean) as string[]
    : []

  const leftBlock = el(View, { style: S.notesBlock },
    invoice.notes
      ? [
          el(Text, { key: 'n-lbl', style: S.sectionLbl }, 'NOTES'),
          el(Text, { key: 'n-txt', style: { ...S.mutedText, marginBottom: 14 } }, invoice.notes),
        ]
      : null,
    invoice.payment_terms && !hasProjects
      ? [
          el(Text, { key: 'pt-lbl', style: S.sectionLbl }, 'PAYMENT TERMS'),
          el(Text, { key: 'pt-val', style: { ...S.bodyText, marginBottom: 14 } }, invoice.payment_terms),
        ]
      : null,
    hasBankDetails
      ? [
          el(Text, { key: 'bk-lbl', style: S.sectionLbl }, 'BANK DETAILS'),
          ...bankLines.map((line, i) =>
            el(Text, { key: `bk-${i}`, style: S.mutedText }, line)
          ),
        ]
      : null,
  )

  const summaryCard = el(View, { style: S.sumCard, wrap: false },
    el(View, { style: S.sumHead }, el(Text, { style: S.sumHdTxt }, 'FINANCIAL SUMMARY')),
    el(View, { style: S.sumBody },
      el(View, { style: S.sumRow },
        el(Text, { style: S.sumLbl }, 'Subtotal'),
        el(Text, { style: S.sumVal }, pdfMoney(subtotal, cur)),
      ),
      discAmt > 0
        ? el(View, { style: S.sumRow },
            el(Text, { style: S.sumLbl }, discType === 'percent' ? `Discount (${discValue}%)` : 'Discount'),
            el(Text, { style: { ...S.sumVal, color: C.green } }, `- ${pdfMoney(discAmt, cur)}`),
          )
        : null,
      discAmt > 0
        ? el(View, { style: S.sumRow },
            el(Text, { style: S.sumLbl }, 'After discount'),
            el(Text, { style: S.sumVal }, pdfMoney(taxable, cur)),
          )
        : null,
      taxAmt > 0
        ? el(View, { style: S.sumRow },
            el(Text, { style: S.sumLbl }, `Tax (${taxRate}%)`),
            el(Text, { style: S.sumVal }, pdfMoney(taxAmt, cur)),
          )
        : null,
      el(View, { style: S.sumDivider }),
    ),
    el(View, { style: hasPaid
      ? { ...S.totalBlock, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
      : S.totalBlock },
      el(Text, { style: S.totalLbl }, 'TOTAL'),
      el(Text, { style: S.totalVal }, pdfMoney(total, cur)),
    ),
    hasPaid
      ? el(View, { style: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border } },
          el(View, { style: S.sumRow },
            el(Text, { style: S.sumLbl }, 'Paid'),
            el(Text, { style: { ...S.sumVal, color: C.green } }, `- ${pdfMoney(paidAmount, cur)}`),
          ),
          isFullyPaid
            ? el(View, { style: { backgroundColor: '#f0fdf4', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 3, marginTop: 4, alignItems: 'center' } },
                el(Text, { style: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.green, letterSpacing: 0.5 } }, 'PAID IN FULL')
              )
            : el(View, { style: S.sumRow },
                el(Text, { style: { ...S.sumLbl, fontFamily: 'Helvetica-Bold' } }, 'Balance Due'),
                el(Text, { style: { ...S.sumVal, fontFamily: 'Helvetica-Bold', color: C.navy } }, pdfMoney(balanceDue, cur)),
              ),
        )
      : null,
  )

  const bottomRow = el(View, { style: S.bottomRow }, leftBlock, summaryCard)

  // ── 5. FOOTER ──────────────────────────────────────────────────────────────
  const footerText = org.invoice_footer_text || 'If you have any questions, please contact us.'
  const legalText  = org.invoice_legal_text  || 'This is a computer-generated invoice and does not require a signature.'

  const footerArea = el(View, { style: S.footerArea },
    el(View, { style: S.footerRow },
      el(View, { style: S.thankBox },
        el(Text, { style: S.thankTitle }, 'Thank you!'),
        el(Text, { style: S.thankText }, footerText),
      ),
      org.qrData
        ? el(View, { style: S.qrBox },
            el(Image, { src: org.qrData, style: { width: '100%', height: '100%' } })
          )
        : null,
    ),
    el(View, { style: S.legalBox },
      el(Text, { style: S.legalText }, legalText),
    ),
  )

  return el(
    Document,
    { title: invoice.invoice_number, author: org.name },
    el(
      Page,
      { size: 'A4', style: S.page },
      header,
      el(View, { style: S.hrLight }),
      cardsRow,
      el(View, { style: S.tableAccent }),
      tableHdr,
      ...tableRows,
      bottomRow,
      footerArea,
    ),
  )
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function resolveOrgAndRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .maybeSingle()

  let orgId = profile?.active_organization_id ?? null
  if (!orgId) {
    const { data: mem } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    orgId = mem?.organization_id ?? null
  }
  if (!orgId) return null

  const { data: mem } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .maybeSingle()

  const role = (mem?.role ?? 'member') as OrgRole
  return { orgId, role }
}

// ─── Fetch image as base64 data URI ──────────────────────────────────────────

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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createClient()

  const ctx = await resolveOrgAndRole(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewInvoices(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: invoiceRaw, error } = await supabase
    .from('invoices')
    .select(`
      *,
      clients(id, company_name, contact_name, email, phone, address, gst_tax_id),
      invoice_projects(project_id, projects(id, name)),
      invoice_items(*)
    `)
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (error || !invoiceRaw) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('name, logo_url, tagline, business_email, business_phone, website, address_line1, address_line2, city, state, postal_code, country, tax_id, invoice_accent_color, invoice_footer_text, invoice_legal_text, bank_name, bank_account_name, bank_account_number, bank_ifsc, bank_swift, bank_branch, upi_id, payment_qr_url')
    .eq('id', ctx.orgId)
    .single()

  // Pre-fetch logo and QR images (so PDF can render them inline)
  const [logoData, qrData] = await Promise.all([
    fetchImageData(orgRow?.logo_url ?? null),
    fetchImageData(orgRow?.payment_qr_url ?? null),
  ])

  const org: OrgData = {
    name:                 orgRow?.name                 ?? 'EditorFlow',
    logo_url:             orgRow?.logo_url             ?? null,
    logoData,
    tagline:              orgRow?.tagline              ?? null,
    business_email:       orgRow?.business_email       ?? null,
    business_phone:       orgRow?.business_phone       ?? null,
    website:              orgRow?.website              ?? null,
    address_line1:        orgRow?.address_line1        ?? null,
    address_line2:        orgRow?.address_line2        ?? null,
    city:                 orgRow?.city                 ?? null,
    state:                orgRow?.state                ?? null,
    postal_code:          orgRow?.postal_code          ?? null,
    country:              orgRow?.country              ?? null,
    tax_id:               orgRow?.tax_id               ?? null,
    invoice_accent_color: orgRow?.invoice_accent_color ?? null,
    invoice_footer_text:  orgRow?.invoice_footer_text  ?? null,
    invoice_legal_text:   orgRow?.invoice_legal_text   ?? null,
    bank_name:            orgRow?.bank_name            ?? null,
    bank_account_name:    orgRow?.bank_account_name    ?? null,
    bank_account_number:  orgRow?.bank_account_number  ?? null,
    bank_ifsc:            orgRow?.bank_ifsc            ?? null,
    bank_swift:           orgRow?.bank_swift           ?? null,
    bank_branch:          orgRow?.bank_branch          ?? null,
    upi_id:               orgRow?.upi_id               ?? null,
    payment_qr_url:       orgRow?.payment_qr_url       ?? null,
    qrData,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = invoiceRaw as any
  const linkedProjects = ((r.invoice_projects ?? []) as Array<{
    project_id: string
    projects:   { id: string; name: string } | null
  }>).map((ip) => ip.projects).filter((p): p is { id: string; name: string } => !!p)

  const invoice: InvoiceWithDetails = {
    ...invoiceRaw,
    paid_amount: Number(r.paid_amount ?? 0),
    balance_due: Number(r.balance_due ?? (Number(r.total ?? 0) - Number(r.paid_amount ?? 0))),
    paid_at:     r.paid_at ?? null,
    client: r.clients ?? {
      id: '', company_name: '', contact_name: null, email: null,
      phone: null, address: null, gst_tax_id: null,
    },
    projects: linkedProjects,
    items: ((r.invoice_items ?? []) as Array<{ sort_order?: number }>)
             .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  } as unknown as InvoiceWithDetails

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(InvoicePDF({ invoice, org }) as any)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('PDF generation failed:', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}

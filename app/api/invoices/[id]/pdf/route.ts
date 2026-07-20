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

// ─── Utilities ────────────────────────────────────────────────────────────────

// Intl.NumberFormat with style:'currency' outputs non-ASCII glyphs (€, £, ₹)
// that Helvetica base-14 fonts don't contain. Use ISO code + plain number instead.
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

// ─── Org data type ────────────────────────────────────────────────────────────

type OrgData = {
  name:                 string
  logo_url:             string | null
  logoData:             string | null
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
  qrData:               string | null
}

// ─── Design tokens ────────────────────────────────────────────────────────────

function makeColors(accent: string) {
  return {
    black:   '#09090B',
    gray900: '#18181B',
    gray700: '#3F3F46',
    gray600: '#52525B',
    gray500: '#71717A',
    gray400: '#A1A1AA',
    gray300: '#D4D4D8',
    gray200: '#E4E4E7',
    gray100: '#F4F4F5',
    white:   '#FFFFFF',
    accent,
    green:   '#16A34A',
    amber:   '#B45309',
    red:     '#DC2626',
  }
}

function statusBadge(s: string): { bg: string; fg: string; label: string } {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    draft:     { bg: '#F4F4F5', fg: '#71717A', label: 'Draft'     },
    sent:      { bg: '#EFF6FF', fg: '#2563EB', label: 'Sent'      },
    paid:      { bg: '#F0FDF4', fg: '#16A34A', label: 'Paid'      },
    overdue:   { bg: '#FEF2F2', fg: '#DC2626', label: 'Overdue'   },
    partial:   { bg: '#FFFBEB', fg: '#B45309', label: 'Partial'   },
    cancelled: { bg: '#F9FAFB', fg: '#9CA3AF', label: 'Cancelled' },
  }
  return map[s] ?? { bg: '#F4F4F5', fg: '#71717A', label: s }
}

// ─── Invoice PDF ──────────────────────────────────────────────────────────────

function InvoicePDF({
  invoice,
  org,
}: {
  invoice: InvoiceWithDetails
  org:     OrgData
}) {
  const C           = makeColors(org.invoice_accent_color ?? '#2563eb')
  const cur         = invoice.currency ?? 'USD'
  const subtotal    = Number(invoice.subtotal)
  const discAmt     = Number(invoice.discount)
  const taxAmt      = Number(invoice.tax)
  const total       = Number(invoice.total)
  const taxRate     = Number(invoice.tax_rate)
  const discValue   = Number(invoice.discount_value)
  const discType    = invoice.discount_type
  const taxable     = subtotal - discAmt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw         = invoice as any
  const paidAmount  = Number(raw.paid_amount ?? 0)
  const balanceDue  = Number(raw.balance_due ?? (total - paidAmount))
  const hasPaid     = paidAmount > 0
  const isFullyPaid = invoice.status === 'paid'
  const badge       = statusBadge(invoice.status)
  const initials    = getInitials(org.name)
  const client      = invoice.client as InvoiceWithDetails['client'] & {
    contact_name?: string | null
    phone?:        string | null
  }
  const hasProjects = invoice.projects.length > 0

  const addressParts = [
    org.address_line1,
    org.address_line2,
    [org.city, org.state].filter(Boolean).join(', '),
    [org.postal_code, org.country].filter(Boolean).join(' '),
  ].filter(Boolean) as string[]

  const hasBankDetails = !!(org.bank_name || org.bank_account_number || org.upi_id)

  // ── DESIGN SYSTEM ─────────────────────────────────────────────────────────
  //
  // Grid:     491pt content (595pt A4 - 52pt × 2 margins)
  // Scale:    4 · 8 · 12 · 16 · 24 · 32 · 40 · 48
  // Type:     Helvetica family only (embedded in PDF spec; no external fonts needed)
  // Colors:   Zinc palette + single configurable accent; no decorative color
  //
  const S = StyleSheet.create({

    // ── Page ──────────────────────────────────────────────────────────────
    page: {
      fontFamily:        'Helvetica',
      fontSize:          8.5,
      color:             C.gray900,
      backgroundColor:   C.white,
      paddingTop:        48,
      paddingBottom:     44,
      paddingHorizontal: 52,
      lineHeight:        1.5,
    },

    // ── Header ────────────────────────────────────────────────────────────
    header:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 32 },
    orgBlock: { flex: 1, paddingRight: 16 },

    // Monogram: circle in brand black
    mark:     { width: 40, height: 40, borderRadius: 20, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    markText: { color: C.white, fontSize: 13, fontFamily: 'Helvetica-Bold' },

    // Logo image: rounded square
    logoBox:  { width: 40, height: 40, marginBottom: 12, borderRadius: 4, overflow: 'hidden' },

    orgName:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 2, lineHeight: 1.3 },
    orgLine:  { fontSize: 7.5, color: C.gray500, lineHeight: 1.45 },

    // Invoice meta (right column)
    metaBlock:  { alignItems: 'flex-end', minWidth: 192 },
    metaLabel:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray400, letterSpacing: 2, marginBottom: 4 },
    invoiceNum: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 12 },
    badge:      { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20 },
    badgeText:  { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6 },
    dateGroup:  { marginTop: 12 },
    dateRow:    { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 4 },
    dateLbl:    { fontSize: 7.5, color: C.gray400, width: 52, textAlign: 'right', marginRight: 10 },
    dateVal:    { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.gray700 },

    // ── Separator ─────────────────────────────────────────────────────────
    sep: { borderTopWidth: 1, borderTopColor: C.gray200, marginBottom: 32 },

    // ── Parties ───────────────────────────────────────────────────────────
    parties:     { flexDirection: 'row', marginBottom: 32 },
    partyLeft:   { flex: 1, paddingRight: 24 },
    partyRight:  { flex: 1, paddingLeft: 24 },
    partyLabel:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray400, letterSpacing: 1.2, marginBottom: 8 },
    partyName:   { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 4, lineHeight: 1.3 },
    partyDetail: { fontSize: 7.5, color: C.gray500, lineHeight: 1.5 },
    projItem:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
    projDot:     { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: C.accent, marginTop: 3.5, marginRight: 7 },
    projName:    { fontSize: 7.5, color: C.gray700, flex: 1, lineHeight: 1.5 },

    // ── Table ─────────────────────────────────────────────────────────────
    tableWrap: { marginBottom: 0 },

    // Header: labels only — no background, thin bottom rule
    tableHead: {
      flexDirection:   'row',
      paddingBottom:   9,
      borderBottomWidth: 1,
      borderBottomColor: C.gray200,
      marginBottom:    2,
    },

    // Each data row: generous vertical padding, very subtle separator
    tableRow: {
      flexDirection:   'row',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.gray200,
    },

    // Column header cells — 7pt, tracked, gray400
    thIdx:   { width: 20,  fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray400, letterSpacing: 0.8 },
    thDesc:  { flex: 1,    fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray400, letterSpacing: 0.8 },
    thQty:   { width: 44,  fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray400, letterSpacing: 0.8, textAlign: 'right' },
    thPrice: { width: 80,  fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray400, letterSpacing: 0.8, textAlign: 'right' },
    thAmt:   { width: 80,  fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray400, letterSpacing: 0.8, textAlign: 'right' },

    // Data cells — 8.5pt body text, no bold except amount column
    tdIdx:   { width: 20,  fontSize: 8, color: C.gray400 },
    tdDesc:  { flex: 1,    fontSize: 8.5, color: C.gray900, paddingRight: 12, lineHeight: 1.5 },
    tdQty:   { width: 44,  fontSize: 8.5, color: C.gray500, textAlign: 'right' },
    tdPrice: { width: 80,  fontSize: 8.5, color: C.gray500, textAlign: 'right' },
    tdAmt:   { width: 80,  fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.gray900, textAlign: 'right' },

    // ── Bottom section (notes/bank left · totals right) ───────────────────
    bottom:  { flexDirection: 'row', marginTop: 36, gap: 28 },
    leftCol: { flex: 1 },

    // Section labels (NOTES, BANK DETAILS, etc.)
    secLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray400, letterSpacing: 1.2, marginBottom: 8 },

    // Notes
    notesText: { fontSize: 8, color: C.gray600, lineHeight: 1.65 },
    notesSec:  { marginBottom: 20 },

    // Bank detail rows
    bankRow: { flexDirection: 'row', marginBottom: 5 },
    bankKey: { fontSize: 7.5, color: C.gray400, width: 76 },
    bankVal: { fontSize: 7.5, color: C.gray700, flex: 1, lineHeight: 1.4 },

    // QR code (scan to pay)
    qrBox:  { width: 56, height: 56, marginTop: 14 },

    // ── Totals ────────────────────────────────────────────────────────────
    //
    // Philosophy: pure typography, right-aligned, no container.
    // The total amount is the visual anchor — 18pt, accent color.
    //
    totalsCol:  { width: 200 },
    totRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    totLbl:     { fontSize: 8, color: C.gray500 },
    totVal:     { fontSize: 8, color: C.gray900 },
    totDisc:    { fontSize: 8, color: C.green },

    // Divider between line items and grand total
    totSep:     { borderTopWidth: 1, borderTopColor: C.gray200, marginTop: 6, marginBottom: 14 },

    // Grand total row — the visual hero of the document
    grandRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    grandLbl:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.black },
    grandVal:  { fontSize: 19, fontFamily: 'Helvetica-Bold', color: C.accent },

    // Partial payment / balance
    paidSep:   { borderTopWidth: 1, borderTopColor: C.gray200, marginTop: 14, marginBottom: 10 },
    paidLbl:   { fontSize: 8, color: C.gray500 },
    paidVal:   { fontSize: 8, color: C.green },
    balLbl:    { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.black },
    balVal:    { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.black },

    // Paid-in-full indicator — a clean pill
    paidPill:     { alignItems: 'center', marginTop: 12 },
    paidPillInner: {
      paddingVertical:   5,
      paddingHorizontal: 14,
      backgroundColor:   '#F0FDF4',
      borderRadius:      20,
    },
    paidPillText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.green, letterSpacing: 0.6 },

    // ── Footer ────────────────────────────────────────────────────────────
    footer:      { marginTop: 40, borderTopWidth: 1, borderTopColor: C.gray200, paddingTop: 20 },
    footerInner: { flexDirection: 'row', alignItems: 'flex-end' },
    footerText:  { flex: 1, fontSize: 8, color: C.gray500, textAlign: 'center', lineHeight: 1.55 },
    legalText:   { flex: 1, fontSize: 7, color: C.gray300, textAlign: 'center', marginTop: 7, lineHeight: 1.4 },
    qrFooter:    { width: 52, height: 52, marginLeft: 20 },
  })

  // ── 1. HEADER ─────────────────────────────────────────────────────────────

  const orgMark = org.logoData
    ? el(View, { style: S.logoBox },
        el(Image, { src: org.logoData, style: { width: '100%', height: '100%', objectFit: 'contain' } })
      )
    : el(View, { style: S.mark },
        el(Text, { style: S.markText }, initials)
      )

  const orgContactLines = [
    org.business_email,
    org.business_phone,
    org.website,
    ...addressParts,
    org.tax_id ? `Tax ID: ${org.tax_id}` : null,
  ].filter(Boolean) as string[]

  const header = el(View, { style: S.header },

    // Left — org identity
    el(View, { style: S.orgBlock },
      orgMark,
      el(Text, { style: S.orgName }, org.name),
      org.tagline ? el(Text, { style: { ...S.orgLine, marginBottom: 1 } }, org.tagline) : null,
      ...orgContactLines.map((line, i) =>
        el(Text, { key: `org-${i}`, style: S.orgLine }, line)
      ),
    ),

    // Right — invoice meta
    el(View, { style: S.metaBlock },
      el(Text, { style: S.metaLabel }, 'INVOICE'),
      el(Text, { style: S.invoiceNum }, invoice.invoice_number),
      el(View, { style: { ...S.badge, backgroundColor: badge.bg } },
        el(Text, { style: { ...S.badgeText, color: badge.fg } }, badge.label)
      ),
      el(View, { style: S.dateGroup },
        el(View, { style: S.dateRow },
          el(Text, { style: S.dateLbl }, 'Issued'),
          el(Text, { style: S.dateVal }, fmtDate(invoice.issue_date)),
        ),
        invoice.due_date
          ? el(View, { style: S.dateRow },
              el(Text, { style: S.dateLbl }, 'Due'),
              el(Text, { style: S.dateVal }, fmtDate(invoice.due_date)),
            )
          : null,
      ),
    ),
  )

  // ── 2. SEPARATOR ──────────────────────────────────────────────────────────

  const separator = el(View, { style: S.sep })

  // ── 3. PARTIES ────────────────────────────────────────────────────────────

  const projHeading = hasProjects
    ? (invoice.projects.length === 1 ? 'PROJECT' : 'PROJECTS')
    : invoice.payment_terms
      ? 'PAYMENT TERMS'
      : null

  const rightParty = projHeading
    ? el(View, { style: S.partyRight },
        el(Text, { style: S.partyLabel }, projHeading),
        ...(hasProjects
          ? invoice.projects.map((p) =>
              el(View, { key: p.id, style: S.projItem },
                el(View, { style: S.projDot }),
                el(Text, { style: S.projName }, p.name),
              )
            )
          : invoice.payment_terms
            ? [el(Text, { key: 'pt', style: S.partyDetail }, invoice.payment_terms)]
            : []
        ),
      )
    : null

  const parties = el(View, { style: S.parties },
    el(View, { style: S.partyLeft },
      el(Text, { style: S.partyLabel }, 'BILL TO'),
      el(Text, { style: S.partyName }, client.company_name),
      client.contact_name ? el(Text, { style: S.partyDetail }, client.contact_name) : null,
      client.email        ? el(Text, { style: S.partyDetail }, client.email)        : null,
      client.phone        ? el(Text, { style: S.partyDetail }, client.phone)        : null,
      client.address      ? el(Text, { style: S.partyDetail }, client.address)      : null,
      client.gst_tax_id   ? el(Text, { style: S.partyDetail }, `GST/Tax: ${client.gst_tax_id}`) : null,
    ),
    rightParty,
  )

  // ── 4. TABLE ──────────────────────────────────────────────────────────────

  const tableHead = el(View, { style: S.tableHead },
    el(Text, { style: S.thIdx   }, '#'),
    el(Text, { style: S.thDesc  }, 'DESCRIPTION'),
    el(Text, { style: S.thQty   }, 'QTY'),
    el(Text, { style: S.thPrice }, 'UNIT PRICE'),
    el(Text, { style: S.thAmt   }, 'AMOUNT'),
  )

  const tableRows = invoice.items.map((item, i) =>
    el(View, { key: item.id, style: S.tableRow, wrap: false },
      el(Text, { style: S.tdIdx   }, String(i + 1)),
      el(Text, { style: S.tdDesc  }, item.description),
      el(Text, { style: S.tdQty   }, String(Number(item.quantity))),
      el(Text, { style: S.tdPrice }, pdfMoney(Number(item.unit_price), cur)),
      el(Text, { style: S.tdAmt   }, pdfMoney(Number(item.amount), cur)),
    )
  )

  const table = el(View, { style: S.tableWrap }, tableHead, ...tableRows)

  // ── 5. BOTTOM SECTION ─────────────────────────────────────────────────────

  // Bank detail key-value pairs
  const bankLines: Array<[string, string]> = ([
    org.bank_name           ? ['Bank',    org.bank_name]           : null,
    org.bank_branch         ? ['Branch',  org.bank_branch]         : null,
    org.bank_account_name   ? ['Name',    org.bank_account_name]   : null,
    org.bank_account_number ? ['Account', org.bank_account_number] : null,
    org.bank_ifsc           ? ['IFSC',    org.bank_ifsc]           : null,
    org.bank_swift          ? ['SWIFT',   org.bank_swift]          : null,
    org.upi_id              ? ['UPI',     org.upi_id]              : null,
  ] as Array<[string, string] | null>).filter(Boolean) as Array<[string, string]>

  const leftCol = el(View, { style: S.leftCol },
    invoice.notes
      ? el(View, { style: S.notesSec },
          el(Text, { style: S.secLabel }, 'NOTES'),
          el(Text, { style: S.notesText }, invoice.notes),
        )
      : null,
    hasBankDetails
      ? el(View, {},
          el(Text, { style: S.secLabel }, 'BANK DETAILS'),
          ...bankLines.map(([key, val], i) =>
            el(View, { key: i, style: S.bankRow },
              el(Text, { style: S.bankKey }, key),
              el(Text, { style: S.bankVal }, val),
            )
          ),
        )
      : null,
  )

  // Totals column — pure typography, no container chrome
  const totalsCol = el(View, { style: S.totalsCol, wrap: false },

    // Line subtotals
    el(View, { style: S.totRow },
      el(Text, { style: S.totLbl }, 'Subtotal'),
      el(Text, { style: S.totVal }, pdfMoney(subtotal, cur)),
    ),

    discAmt > 0
      ? el(View, { style: S.totRow },
          el(Text, { style: S.totLbl }, discType === 'percent' ? `Discount (${discValue}%)` : 'Discount'),
          el(Text, { style: S.totDisc }, `− ${pdfMoney(discAmt, cur)}`),
        )
      : null,

    discAmt > 0
      ? el(View, { style: S.totRow },
          el(Text, { style: S.totLbl }, 'After discount'),
          el(Text, { style: S.totVal }, pdfMoney(taxable, cur)),
        )
      : null,

    taxAmt > 0
      ? el(View, { style: S.totRow },
          el(Text, { style: S.totLbl }, `Tax (${taxRate}%)`),
          el(Text, { style: S.totVal }, pdfMoney(taxAmt, cur)),
        )
      : null,

    // Separator above total
    el(View, { style: S.totSep }),

    // Grand total — the visual anchor of the invoice
    el(View, { style: S.grandRow },
      el(Text, { style: S.grandLbl }, 'Total'),
      el(Text, { style: S.grandVal }, pdfMoney(total, cur)),
    ),

    // Payment breakdown (partial / paid)
    hasPaid
      ? el(View, {},
          el(View, { style: S.paidSep }),
          el(View, { style: S.totRow },
            el(Text, { style: S.paidLbl }, 'Paid'),
            el(Text, { style: S.paidVal }, `− ${pdfMoney(paidAmount, cur)}`),
          ),
          isFullyPaid
            ? el(View, { style: S.paidPill },
                el(View, { style: S.paidPillInner },
                  el(Text, { style: S.paidPillText }, 'PAID IN FULL')
                )
              )
            : el(View, { style: { ...S.totRow, marginTop: 4 } },
                el(Text, { style: S.balLbl }, 'Balance Due'),
                el(Text, { style: S.balVal }, pdfMoney(balanceDue, cur)),
              ),
        )
      : null,
  )

  const bottom = el(View, { style: S.bottom, wrap: false }, leftCol, totalsCol)

  // ── 6. FOOTER ─────────────────────────────────────────────────────────────

  const footerText = org.invoice_footer_text
    || 'Thank you for your business. Please contact us with any questions.'
  const legalText = org.invoice_legal_text
    || 'This is a computer-generated document and does not require a physical signature.'

  const footer = el(View, { style: S.footer, wrap: false },
    org.qrData
      ? el(View, { style: S.footerInner },
          el(View, { style: { flex: 1 } },
            el(Text, { style: S.footerText }, footerText),
            el(Text, { style: S.legalText  }, legalText),
          ),
          el(View, { style: S.qrFooter },
            el(Image, { src: org.qrData, style: { width: '100%', height: '100%' } })
          ),
        )
      : el(View, {},
          el(Text, { style: S.footerText }, footerText),
          el(Text, { style: S.legalText  }, legalText),
        ),
  )

  // ── DOCUMENT ──────────────────────────────────────────────────────────────

  return el(
    Document,
    { title: invoice.invoice_number, author: org.name },
    el(
      Page,
      { size: 'A4', style: S.page },
      header,
      separator,
      parties,
      table,
      bottom,
      footer,
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

import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Mail,
  Phone,
  Globe,
  Building2,
  MapPin,
  FileText,
  Hash,
  FolderKanban,
} from 'lucide-react'
import type { Metadata } from 'next'

import { getClient } from '@/features/clients/actions'
import { ClientStatusBadge } from '@/features/clients/components/client-status-badge'
import { ClientProjectsCard } from '@/features/clients/components/client-projects-card'
import { ClientInvoicesCard } from '@/features/clients/components/client-invoices-card'
import { ClientActivityCard } from '@/features/clients/components/client-activity-card'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/utils/format'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const client = await getClient(id)
  return { title: client?.company_name ?? 'Client' }
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | null | undefined
  href?: string
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm break-all underline-offset-4 hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm break-words">{value}</p>
        )}
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const client = await getClient(id)
  if (!client) notFound()

  const initials = client.company_name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <PageContainer>
      <Link
        href="/clients"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted text-lg font-bold">
            {initials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{client.company_name}</h1>
              <ClientStatusBadge status={client.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Added {formatDate(client.created_at)} · Updated {formatDate(client.updated_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={FolderKanban} label="Projects" value={client.project_count} />
        <StatCard icon={FileText} label="Invoices" value={client.invoice_count} />
        {client.industry && (
          <div className="col-span-2 flex items-center gap-3 rounded-lg border px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{client.industry}</p>
              <p className="text-xs text-muted-foreground">Industry</p>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — static client info */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow icon={Building2} label="Industry" value={client.industry} />
              <InfoRow
                icon={Globe}
                label="Website"
                value={client.website}
                href={client.website ?? undefined}
              />
              <InfoRow icon={Hash} label="GST / Tax ID" value={client.gst_tax_id} />
              <InfoRow icon={MapPin} label="Address" value={client.address} />
              {!client.industry && !client.website && !client.gst_tax_id && !client.address && (
                <p className="text-sm text-muted-foreground">No company details added yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow icon={Building2} label="Contact Person" value={client.contact_name} />
              <InfoRow
                icon={Mail}
                label="Email"
                value={client.email}
                href={client.email ? `mailto:${client.email}` : undefined}
              />
              <InfoRow
                icon={Phone}
                label="Phone"
                value={client.phone}
                href={client.phone ? `tel:${client.phone}` : undefined}
              />
              {!client.contact_name && !client.email && !client.phone && (
                <p className="text-sm text-muted-foreground">No contact details added yet.</p>
              )}
            </CardContent>
          </Card>

          {client.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — independently queried sections */}
        <div className="space-y-4">
          <ClientProjectsCard clientId={id} />
          <ClientInvoicesCard clientId={id} />
        </div>
      </div>

      {/* Activity — full width, independently queried */}
      <ClientActivityCard clientId={id} />
    </PageContainer>
  )
}

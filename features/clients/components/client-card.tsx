import Link from 'next/link'
import { Mail, Phone, FolderKanban, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ClientStatusBadge } from './client-status-badge'
import type { ClientWithCounts } from '../types'

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'bg-rose-100   text-rose-700   dark:bg-rose-900/40   dark:text-rose-300',
  'bg-teal-100   text-teal-700   dark:bg-teal-900/40   dark:text-teal-300',
  'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
] as const

function ClientAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${color}`}
    >
      {initials}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface ClientCardProps {
  client: ClientWithCounts
}

export function ClientCard({ client }: ClientCardProps) {
  return (
    <Link href={`/clients/${client.id}`} className="block group">
      <Card className="transition-colors group-hover:bg-muted/40">
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <ClientAvatar name={client.company_name} />
              <div className="min-w-0">
                <p className="truncate font-medium text-sm leading-tight">
                  {client.company_name}
                </p>
                {client.contact_name && (
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    {client.contact_name}
                  </p>
                )}
              </div>
            </div>
            <ClientStatusBadge status={client.status} />
          </div>

          {/* Contact details */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {client.email && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{client.email}</span>
              </span>
            )}
            {client.phone && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{client.phone}</span>
              </span>
            )}
          </div>

          {/* Counts row */}
          <div className="flex items-center gap-4 pt-0.5 border-t">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FolderKanban className="h-3.5 w-3.5" />
              {client.project_count} {client.project_count === 1 ? 'project' : 'projects'}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {client.invoice_count} {client.invoice_count === 1 ? 'invoice' : 'invoices'}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

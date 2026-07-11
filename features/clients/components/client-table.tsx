'use client'

import { useRouter } from 'next/navigation'
import { FolderKanban, FileText } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ClientStatusBadge } from './client-status-badge'
import { formatDate } from '@/utils/format'
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
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${color}`}
    >
      {initials}
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function TablePagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        {total} {total === 1 ? 'client' : 'clients'}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs tabular-nums">{page} / {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Count chip ───────────────────────────────────────────────────────────────

function CountChip({
  icon: Icon,
  count,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  count: number
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={label}>
      <Icon className="h-3.5 w-3.5" />
      {count}
    </span>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

interface ClientTableProps {
  clients: ClientWithCounts[]
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function ClientTable({
  clients,
  total,
  page,
  totalPages,
  onPageChange,
}: ClientTableProps) {
  const router = useRouter()

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead className="hidden sm:table-cell">Contact</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead className="hidden lg:table-cell">Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell text-center">Projects</TableHead>
            <TableHead className="hidden sm:table-cell text-center">Invoices</TableHead>
            <TableHead className="hidden lg:table-cell">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow
              key={client.id}
              className="cursor-pointer"
              onClick={() => router.push(`/clients/${client.id}`)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <ClientAvatar name={client.company_name} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{client.company_name}</p>
                    {client.industry && (
                      <p className="truncate text-xs text-muted-foreground hidden md:block">
                        {client.industry}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>

              <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                {client.contact_name ?? '—'}
              </TableCell>

              <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {client.email}
                  </a>
                ) : (
                  '—'
                )}
              </TableCell>

              <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                {client.phone ?? '—'}
              </TableCell>

              <TableCell>
                <ClientStatusBadge status={client.status} />
              </TableCell>

              <TableCell className="hidden sm:table-cell text-center">
                <CountChip
                  icon={FolderKanban}
                  count={client.project_count}
                  label={`${client.project_count} project${client.project_count !== 1 ? 's' : ''}`}
                />
              </TableCell>

              <TableCell className="hidden sm:table-cell text-center">
                <CountChip
                  icon={FileText}
                  count={client.invoice_count}
                  label={`${client.invoice_count} invoice${client.invoice_count !== 1 ? 's' : ''}`}
                />
              </TableCell>

              <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                {formatDate(client.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TablePagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={onPageChange}
      />
    </div>
  )
}

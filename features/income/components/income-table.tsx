'use client'

import { useState } from 'react'
import { Banknote } from 'lucide-react'
import { formatDate } from '@/utils/format'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { IncomeStatusBadge } from './income-status-badge'
import { MarkPaidDialog } from './mark-paid-dialog'
import type { IncomeListItem } from '../types'

interface IncomeTableProps {
  items:     IncomeListItem[]
  canManage: boolean
}

function fmtAmt(n: number, currency: string) {
  return (
    <>
      <span className="font-mono">
        {n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className="ml-1 text-xs text-muted-foreground">{currency}</span>
    </>
  )
}

function AmountCell({ item }: { item: IncomeListItem }) {
  // Use explicit FX columns: converted_amount + member_currency are set by the FX snapshot RPC
  const hasFx =
    item.converted_amount != null &&
    item.member_currency  != null &&
    item.original_currency != null &&
    item.member_currency !== item.original_currency

  if (hasFx) {
    return (
      <span className="flex flex-col items-end gap-0.5">
        <span className="text-xs text-muted-foreground">
          {fmtAmt(item.original_amount!, item.original_currency!)}
        </span>
        <span>{fmtAmt(item.converted_amount!, item.member_currency!)}</span>
      </span>
    )
  }

  // Same-currency or pre-FX: prefer member_currency/converted_amount when available
  const displayAmount   = item.converted_amount ?? item.original_amount ?? item.amount
  const displayCurrency = item.member_currency  ?? item.original_currency ?? item.currency
  return <>{fmtAmt(displayAmount, displayCurrency)}</>
}

export function IncomeTable({ items, canManage }: IncomeTableProps) {
  const [dialogItem, setDialogItem] = useState<IncomeListItem | null>(null)

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Banknote}
        title="No income records"
        description="Income records appear here as tasks are completed and marked as paid."
      />
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage && <TableHead>Member</TableHead>}
              <TableHead>Task</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid On</TableHead>
              {canManage && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                {canManage && (
                  <TableCell className="font-medium">{item.member_name ?? '—'}</TableCell>
                )}
                <TableCell className="max-w-[200px] truncate">{item.task_title ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{item.project_name ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDate(item.completed_at)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <AmountCell item={item} />
                </TableCell>
                <TableCell><IncomeStatusBadge status={item.status} /></TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {item.paid_at ? formatDate(item.paid_at) : '—'}
                </TableCell>
                {canManage && (
                  <TableCell>
                    {item.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setDialogItem(item)}
                      >
                        Mark Paid
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {dialogItem && (
        <MarkPaidDialog
          item={dialogItem}
          open={!!dialogItem}
          onClose={() => setDialogItem(null)}
        />
      )}
    </>
  )
}

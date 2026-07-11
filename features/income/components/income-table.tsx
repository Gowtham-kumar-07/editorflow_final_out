'use client'

import { useState } from 'react'
import { formatDate } from '@/utils/format'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { IncomeStatusBadge } from './income-status-badge'
import { MarkPaidDialog } from './mark-paid-dialog'
import type { IncomeListItem } from '../types'

interface IncomeTableProps {
  items:         IncomeListItem[]
  canManage:     boolean
}

export function IncomeTable({ items, canManage }: IncomeTableProps) {
  const [dialogItem, setDialogItem] = useState<IncomeListItem | null>(null)

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <p className="text-sm">No income records found.</p>
      </div>
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
                <TableCell className="text-right font-mono whitespace-nowrap">
                  {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="ml-1 text-xs text-muted-foreground">{item.currency}</span>
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

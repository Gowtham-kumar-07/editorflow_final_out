'use client'

import { useState } from 'react'
import { formatDate } from '@/utils/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IncomeStatusBadge } from './income-status-badge'
import { MarkPaidDialog } from './mark-paid-dialog'
import type { IncomeListItem } from '../types'

interface IncomeMobileCardsProps {
  items:     IncomeListItem[]
  canManage: boolean
}

export function IncomeMobileCards({ items, canManage }: IncomeMobileCardsProps) {
  const [dialogItem, setDialogItem] = useState<IncomeListItem | null>(null)

  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">No income records found.</p>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {canManage && (
                    <p className="font-medium text-sm truncate">{item.member_name ?? '—'}</p>
                  )}
                  <p className="text-sm truncate">{item.task_title ?? '—'}</p>
                  {item.project_name && (
                    <p className="text-xs text-muted-foreground truncate">{item.project_name}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-semibold text-sm">
                    {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{item.currency}</span>
                  </p>
                  <IncomeStatusBadge status={item.status} />
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Completed {formatDate(item.completed_at)}</span>
                {item.paid_at && <span>Paid {formatDate(item.paid_at)}</span>}
                {canManage && item.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2"
                    onClick={() => setDialogItem(item)}
                  >
                    Mark Paid
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
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
